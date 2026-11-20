import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ["low", "medium", "high", "urgent"];

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("User belum login.", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Format permintaan tidak valid.", 400);
    }

    const input = (body ?? {}) as Record<string, unknown>;
    const lmsContentId =
      typeof input.lms_content_id === "string" ? input.lms_content_id : "";
    const deadline =
      typeof input.deadline === "string" ? input.deadline : "";
    const priority =
      typeof input.priority === "string" ? input.priority : "medium";

    if (!UUID_REGEX.test(lmsContentId)) {
      return fail("Content LMS tidak valid.", 400);
    }

    if (!DATE_REGEX.test(deadline) || Number.isNaN(Date.parse(deadline))) {
      return fail("Deadline wajib diisi dengan tanggal yang valid.", 400);
    }

    if (!PRIORITIES.includes(priority)) {
      return fail("Prioritas tidak valid.", 400);
    }

    // 1. Content LMS (harus milik user dan bertipe tugas)
    const { data: content, error: contentError } = await supabase
      .from("lms_contents")
      .select("id, content_type, content_name, lms_meeting_id")
      .eq("id", lmsContentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (contentError) {
      console.error("LMS task content error:", contentError);
      return fail("Gagal membaca data tugas LMS.", 500);
    }

    if (!content) {
      return fail("Tugas LMS tidak ditemukan.", 404);
    }

    if (content.content_type !== "tugas") {
      return fail("Hanya content bertipe tugas yang bisa ditambahkan.", 400);
    }

    // 2. Cegah duplikat
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("lms_content_id", content.id)
      .maybeSingle();

    if (existingTask) {
      return fail("Tugas ini sudah ada di Tugas Saya.", 409);
    }

    // 3. Pertemuan dan mata kuliah LMS asalnya
    const { data: meeting, error: meetingError } = await supabase
      .from("lms_meetings")
      .select("id, meeting_name, lms_course_id")
      .eq("id", content.lms_meeting_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (meetingError || !meeting) {
      console.error("LMS task meeting error:", meetingError);
      return fail("Pertemuan untuk tugas ini tidak ditemukan.", 404);
    }

    const { data: lmsCourse, error: lmsCourseError } = await supabase
      .from("lms_courses")
      .select("id, course_name, lecturer_name")
      .eq("id", meeting.lms_course_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lmsCourseError || !lmsCourse) {
      console.error("LMS task course error:", lmsCourseError);
      return fail("Mata kuliah untuk tugas ini tidak ditemukan.", 404);
    }

    // 4. Cari mata kuliah StudyFlow dengan nama yang sama, kalau tidak ada buat baru
    const { data: userCourses, error: coursesError } = await supabase
      .from("courses")
      .select("id, name")
      .eq("user_id", user.id);

    if (coursesError) {
      console.error("StudyFlow courses error:", coursesError);
      return fail("Gagal membaca mata kuliah StudyFlow.", 500);
    }

    const target = normalizeName(lmsCourse.course_name);
    let courseId =
      (userCourses ?? []).find((course) => normalizeName(course.name) === target)
        ?.id ?? null;

    if (!courseId) {
      const { data: newCourse, error: newCourseError } = await supabase
        .from("courses")
        .insert({
          user_id: user.id,
          name: lmsCourse.course_name.trim(),
          lecturer_name: lmsCourse.lecturer_name,
        })
        .select("id")
        .single();

      if (newCourseError || !newCourse) {
        console.error("Create StudyFlow course error:", newCourseError);
        return fail("Gagal membuat mata kuliah di StudyFlow.", 500);
      }

      courseId = newCourse.id;
    }

    // 5. Buat task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        course_id: courseId,
        title: content.content_name,
        description: `Dari LMS: ${meeting.meeting_name}`,
        deadline,
        priority,
        status: "not_started",
        progress: 0,
        lms_content_id: content.id,
      })
      .select("id")
      .single();

    if (taskError) {
      // 23505 = unique violation (tugas ini sudah ditambahkan di waktu bersamaan)
      if (taskError.code === "23505") {
        return fail("Tugas ini sudah ada di Tugas Saya.", 409);
      }

      console.error("Create task error:", taskError);
      return fail("Gagal menambahkan tugas.", 500);
    }

    return NextResponse.json({ success: true, task_id: task.id });
  } catch (error) {
    console.error("LMS add task API error:", error);

    return fail(
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat menambahkan tugas.",
      500
    );
  }
}
