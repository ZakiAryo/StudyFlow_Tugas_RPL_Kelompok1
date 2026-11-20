import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

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

    const { data, error } = await supabase
      .from("lms_courses")
      .select(
        "id, course_name, lecturer_name, class_info, course_url, photo_url, last_synced_at"
      )
      .eq("user_id", user.id)
      .order("course_name", { ascending: true });

    if (error) {
      console.error("LMS courses error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Gagal mengambil data mata kuliah LMS.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      courses: data ?? [],
    });
  } catch (error) {
    console.error("LMS courses API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengambil data LMS.",
      },
      { status: 500 }
    );
  }
}