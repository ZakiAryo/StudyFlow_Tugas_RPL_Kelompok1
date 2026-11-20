import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: "Mata kuliah tidak ditemukan." },
        { status: 404 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "User belum login." },
        { status: 401 }
      );
    }

    // 1. Mata kuliah (harus milik user yang login)
    const { data: course, error: courseError } = await supabase
      .from("lms_courses")
      .select("id, course_name, lecturer_name, class_info, course_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (courseError) {
      console.error("LMS course detail error:", courseError);
      return NextResponse.json(
        { success: false, error: "Gagal mengambil data mata kuliah." },
        { status: 500 }
      );
    }

    if (!course) {
      return NextResponse.json(
        { success: false, error: "Mata kuliah tidak ditemukan." },
        { status: 404 }
      );
    }

    // 2. Pertemuan milik mata kuliah ini
    const { data: meetings, error: meetingsError } = await supabase
      .from("lms_meetings")
      .select("id, meeting_name, meeting_url, meeting_date, description")
      .eq("lms_course_id", id)
      .eq("user_id", user.id)
      .order("meeting_date", { ascending: true })
      .order("meeting_name", { ascending: true });

    if (meetingsError) {
      console.error("LMS meetings error:", meetingsError);
      return NextResponse.json(
        { success: false, error: "Gagal mengambil data pertemuan." },
        { status: 500 }
      );
    }

    const meetingIds = (meetings ?? []).map((meeting) => meeting.id);

    // 3. Materi & tugas dari semua pertemuan tersebut
    let contents: {
      id: string;
      lms_meeting_id: string;
      content_type: string;
      content_name: string;
      content_url: string | null;
    }[] = [];

    if (meetingIds.length > 0) {
      const { data, error: contentsError } = await supabase
        .from("lms_contents")
        .select("id, lms_meeting_id, content_type, content_name, content_url")
        .in("lms_meeting_id", meetingIds)
        .eq("user_id", user.id)
        .order("content_name", { ascending: true });

      if (contentsError) {
        console.error("LMS contents error:", contentsError);
        return NextResponse.json(
          { success: false, error: "Gagal mengambil materi dan tugas." },
          { status: 500 }
        );
      }

      contents = data ?? [];
    }

    // 4. Tugas yang sudah ditambahkan ke Tugas Saya
    let addedIds = new Set<string>();

    if (contents.length > 0) {
      const { data: addedTasks, error: addedError } = await supabase
        .from("tasks")
        .select("lms_content_id")
        .eq("user_id", user.id)
        .in(
          "lms_content_id",
          contents.map((content) => content.id)
        );

      if (addedError) {
        console.error("LMS added tasks error:", addedError);
      } else {
        addedIds = new Set(
          (addedTasks ?? []).map((task) => task.lms_content_id as string)
        );
      }
    }

    // 5. Gabungkan: setiap pertemuan membawa daftar content-nya
    const meetingsWithContents = (meetings ?? []).map((meeting) => ({
      ...meeting,
      contents: contents
        .filter((content) => content.lms_meeting_id === meeting.id)
        .map((content) => ({ ...content, added: addedIds.has(content.id) })),
    }));

    return NextResponse.json({
      success: true,
      course,
      meetings: meetingsWithContents,
    });
  } catch (error) {
    console.error("LMS course detail API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengambil detail mata kuliah.",
      },
      { status: 500 }
    );
  }
}
