import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LMSDashboardCourse,
  LMSMeeting,
  LMSContent,
} from "./types";

/**
 * Menyimpan / memperbarui data mata kuliah LMS.
 *
 * Untuk sementara external_id menggunakan course.url
 * karena response LMS yang kita lihat belum memberikan ID course.
 */
export async function syncLMSCourse(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
  course: LMSDashboardCourse
) {
  const externalId = course.url;

  const { data, error } = await supabase
    .from("lms_courses")
    .upsert(
      {
        user_id: userId,
        lms_connection_id: connectionId,
        external_id: externalId,
        course_name: course.matkul,
        lecturer_name: course.dosen,
        class_info: course.info ?? null,
        course_url: course.url,
        photo_url: course.photo ?? null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "lms_connection_id,external_id",
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal sync course: ${error.message}`);
  }

  return data;
}

/**
 * Menyimpan / memperbarui data pertemuan LMS.
 *
 * Response LMS yang kita lihat tidak mempunyai meeting ID,
 * sehingga meeting.url digunakan sebagai external_id.
 */
export async function syncLMSMeeting(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
  meeting: LMSMeeting
) {
  const externalId = meeting.url;

  const { data, error } = await supabase
    .from("lms_meetings")
    .upsert(
      {
        user_id: userId,
        lms_course_id: courseId,
        external_id: externalId,
        meeting_name: meeting.name,
        meeting_url: meeting.url,
        meeting_date: parseLMSDate(meeting.date),
        description: meeting.desc ?? null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "lms_course_id,external_id",
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal sync meeting: ${error.message}`);
  }

  return data;
}

/**
 * Menyimpan data materi / tugas dari LMS.
 */
export async function syncLMSContent(
  supabase: SupabaseClient,
  userId: string,
  meetingId: string,
  content: LMSContent
) {
  const contentUrl = content.url ?? null;

  let existingQuery = supabase
    .from("lms_contents")
    .select("id")
    .eq("user_id", userId)
    .eq("lms_meeting_id", meetingId)
    .eq("content_name", content.name)
    .limit(1);

  if (contentUrl) {
    existingQuery = existingQuery.eq("content_url", contentUrl);
  }

  const { data: existing, error: existingError } =
    await existingQuery.maybeSingle();

  if (existingError) {
    throw new Error(`Gagal mencari content LMS: ${existingError.message}`);
  }

  const payload = {
    user_id: userId,
    lms_meeting_id: meetingId,
    content_type: content.type,
    content_name: content.name,
    content_url: contentUrl,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("lms_contents")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Gagal memperbarui content LMS: ${error.message}`);
    }

    return data;
  }

  const { data, error } = await supabase
    .from("lms_contents")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Gagal sync content: ${error.message}`);
  }

  return data;
}

/**
 * Mengubah tanggal dari format LMS:
 *
 * "08 September 2026"
 *
 * menjadi:
 *
 * "2026-09-08"
 */
function parseLMSDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(
    /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const [, day, monthName, year] = match;

  const months: Record<string, number> = {
    Januari: 1,
    Februari: 2,
    Maret: 3,
    April: 4,
    Mei: 5,
    Juni: 6,
    Juli: 7,
    Agustus: 8,
    September: 9,
    Oktober: 10,
    November: 11,
    Desember: 12,
  };

  const month = months[monthName];

  if (!month) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(
    Number(day)
  ).padStart(2, "0")}`;
}