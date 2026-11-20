import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  fetchLMSContents,
  fetchLMSDashboard,
  fetchLMSMeetings,
} from "@/lib/lms/client";
import { mockLMSCourses } from "@/lib/lms/mock";
import { decryptSessionReference } from "@/lib/lms/session-crypto";
import {
  syncLMSCourse,
  syncLMSMeeting,
  syncLMSContent,
} from "@/lib/lms/sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "User belum login.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    /*
     * ============================================================
     * MOCK LMS SYNC
     * ============================================================
     *
     * Bisa dijalankan di production hanya jika secret cocok.
     * Jangan pernah menyimpan secret langsung di source code.
     */
    if (mode === "mock") {
      const mockSecret = request.headers.get("x-lms-mock-secret");

      if (
        !process.env.LMS_MOCK_SECRET ||
        mockSecret !== process.env.LMS_MOCK_SECRET
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid mock secret.",
          },
          { status: 403 }
        );
      }

      // Buat / update koneksi demo.
      const { data: connection, error: connectionError } =
        await supabase
          .from("lms_connections")
          .upsert(
            {
              user_id: user.id,
              provider: "unindra",
              status: "connected",
              lms_username: "demo-user",
              session_reference: "development-mock-session",
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,provider",
            }
          )
          .select()
          .single();

      if (connectionError || !connection) {
        console.error("Mock LMS connection error:", connectionError);

        return NextResponse.json(
          {
            success: false,
            error: "Gagal membuat koneksi LMS demo.",
            detail: connectionError?.message ?? null,
          },
          { status: 500 }
        );
      }

      let courseCount = 0;
      let meetingCount = 0;
      let contentCount = 0;

      for (const course of mockLMSCourses) {
        const savedCourse = await syncLMSCourse(
          supabase,
          user.id,
          connection.id,
          course
        );

        courseCount += 1;

        for (const meeting of course.meetings) {
          const savedMeeting = await syncLMSMeeting(
            supabase,
            user.id,
            savedCourse.id,
            meeting
          );

          meetingCount += 1;

          const contents = course.contents[meeting.url] ?? [];

          for (const content of contents) {
            await syncLMSContent(
              supabase,
              user.id,
              savedMeeting.id,
              content
            );

            contentCount += 1;
          }
        }
      }

      const { error: logError } = await supabase
        .from("lms_sync_logs")
        .insert({
          user_id: user.id,
          lms_connection_id: connection.id,
          sync_type: "full",
          status: "success",
          items_synced:
            courseCount + meetingCount + contentCount,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
        });

      if (logError) {
        console.warn("Mock LMS sync log error:", logError);
      }

      return NextResponse.json({
        success: true,
        mode: "mock",
        message: "Demo LMS berhasil disinkronkan.",
        summary: {
          courses: courseCount,
          meetings: meetingCount,
          contents: contentCount,
        },
      });
    }

    /*
     * ============================================================
     * LMS ASLI
     * ============================================================
     *
     * Bagian ini belum menjalankan sinkronisasi LMS asli karena
     * session adapter belum tersedia.
     */

    const { data: connection, error: connectionError } =
      await supabase
        .from("lms_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", "unindra")
        .maybeSingle();

    if (connectionError) {
      console.error("LMS connection error:", connectionError);

      return NextResponse.json(
        {
          success: false,
          error: "Gagal mengambil koneksi LMS.",
        },
        { status: 500 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error: "LMS belum terhubung.",
        },
        { status: 400 }
      );
    }

    if (connection.status !== "connected") {
      return NextResponse.json(
        {
          success: false,
          error: `Status koneksi LMS adalah "${connection.status}".`,
        },
        { status: 400 }
      );
    }

    if (!connection.session_reference) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Session LMS belum tersedia. Hubungkan akun LMS terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    let session: Record<string, unknown>;

    try {
      // Sesi disimpan terenkripsi dan terikat ke user id.
      session = decryptSessionReference(
        connection.session_reference,
        user.id
      );
    } catch (decryptError) {
      return NextResponse.json(
        {
          success: false,
          error:
            decryptError instanceof Error
              ? decryptError.message
              : "Session LMS tidak valid. Silakan disconnect lalu connect kembali.",
        },
        { status: 400 }
      );
    }

    if (
      !session ||
      typeof session !== "object" ||
      typeof session.ci_session !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Session LMS tidak valid. Silakan disconnect lalu connect kembali.",
        },
        { status: 400 }
      );
    }

    const startedAt = new Date().toISOString();
    let courseCount = 0;
    let meetingCount = 0;
    let contentCount = 0;

    try {
      const dashboard = await fetchLMSDashboard(session);

      if (!dashboard.success) {
        throw new Error(
          dashboard.error || "Gagal mengambil dashboard LMS."
        );
      }

      const courses = dashboard.data?.courses ?? [];

      for (const course of courses) {
        const savedCourse = await syncLMSCourse(
          supabase,
          user.id,
          connection.id,
          course
        );

        courseCount += 1;

        const meetingsResponse = await fetchLMSMeetings(
          session,
          course.url
        );

        if (!meetingsResponse.success) {
          throw new Error(
            meetingsResponse.error ||
              `Gagal mengambil pertemuan untuk ${course.matkul}.`
          );
        }

        for (const meeting of meetingsResponse.data ?? []) {
          const savedMeeting = await syncLMSMeeting(
            supabase,
            user.id,
            savedCourse.id,
            meeting
          );

          meetingCount += 1;

          const contentsResponse = await fetchLMSContents(
            session,
            meeting.url
          );

          if (!contentsResponse.success) {
            throw new Error(
              contentsResponse.error ||
                `Gagal mengambil materi untuk ${meeting.name}.`
            );
          }

          for (const content of contentsResponse.data ?? []) {
            await syncLMSContent(
              supabase,
              user.id,
              savedMeeting.id,
              content
            );

            contentCount += 1;
          }
        }
      }

      const now = new Date().toISOString();

      await supabase
        .from("lms_connections")
        .update({
          status: "connected",
          last_synced_at: now,
          updated_at: now,
        })
        .eq("id", connection.id)
        .eq("user_id", user.id);

      await supabase.from("lms_sync_logs").insert({
        user_id: user.id,
        lms_connection_id: connection.id,
        sync_type: "full",
        status: "success",
        items_synced: courseCount + meetingCount + contentCount,
        started_at: startedAt,
        finished_at: now,
      });

      return NextResponse.json({
        success: true,
        mode: "real",
        message: "LMS berhasil disinkronkan.",
        summary: {
          courses: courseCount,
          meetings: meetingCount,
          contents: contentCount,
        },
      });
    } catch (syncError) {
      const finishedAt = new Date().toISOString();
      const errorMessage =
        syncError instanceof Error
          ? syncError.message
          : "Sinkronisasi LMS gagal.";

      await supabase.from("lms_sync_logs").insert({
        user_id: user.id,
        lms_connection_id: connection.id,
        sync_type: "full",
        status: "failed",
        items_synced: courseCount + meetingCount + contentCount,
        error_message: errorMessage,
        started_at: startedAt,
        finished_at: finishedAt,
      });

      // Jika session sudah tidak diterima LMS, tandai expired agar UI
      // meminta user melakukan Connect kembali.
      if (
        /session|login|unauthorized|unauthenticated|expired/i.test(
          errorMessage
        )
      ) {
        await supabase
          .from("lms_connections")
          .update({
            status: "expired",
            updated_at: finishedAt,
          })
          .eq("id", connection.id)
          .eq("user_id", user.id);
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          summary: {
            courses: courseCount,
            meetings: meetingCount,
            contents: contentCount,
          },
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("LMS sync error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat melakukan sinkronisasi LMS.",
      },
      { status: 500 }
    );
  }
}