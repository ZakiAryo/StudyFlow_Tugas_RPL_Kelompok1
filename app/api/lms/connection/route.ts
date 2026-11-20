import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loginWithChallenge, openChallenge } from "@/lib/lms/direct";
import { encryptSessionReference } from "@/lib/lms/session-crypto";

export const runtime = "nodejs";

const CONNECTION_COLUMNS = `
  id,
  provider,
  status,
  lms_username,
  session_expires_at,
  last_synced_at,
  created_at,
  updated_at
`;

export async function GET() {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User belum login." },
        { status: 401 }
      );
    }

    // session_reference sengaja tidak pernah dipilih di sini.
    const { data, error } = await supabase
      .from("lms_connections")
      .select(CONNECTION_COLUMNS)
      .eq("user_id", user.id)
      .eq("provider", "unindra")
      .maybeSingle();

    if (error) {
      console.error("LMS connection GET error:", error);

      return NextResponse.json(
        { success: false, error: "Gagal mengambil koneksi LMS." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, connection: data });
  } catch (error) {
    console.error("LMS connection GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan.",
      },
      { status: 500 }
    );
  }
}

/**
 * Connect: login langsung ke LMS kampus memakai captcha yang dijawab user.
 * Body: { challenge, username, password, kapca }
 * Password hanya dipakai untuk request login dan tidak disimpan atau dicatat.
 * Sesi LMS disimpan terenkripsi.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User belum login." },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: "Format permintaan tidak valid." },
        { status: 400 }
      );
    }

    const challengeToken =
      typeof body.challenge === "string" ? body.challenge : "";
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const kapca = typeof body.kapca === "string" ? body.kapca.trim() : "";

    if (!username || !password || !kapca) {
      return NextResponse.json(
        {
          success: false,
          error: "Username, password, dan jawaban captcha wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (username.length > 64 || password.length > 128 || kapca.length > 10) {
      return NextResponse.json(
        { success: false, error: "Panjang input tidak valid." },
        { status: 400 }
      );
    }

    const challenge = openChallenge(challengeToken);

    if (!challenge || challenge.uid !== user.id) {
      return NextResponse.json(
        { success: false, error: "Captcha tidak valid. Muat ulang captcha." },
        { status: 400 }
      );
    }

    if (Date.now() > challenge.exp) {
      return NextResponse.json(
        { success: false, error: "Captcha kedaluwarsa. Muat ulang captcha." },
        { status: 400 }
      );
    }

    const login = await loginWithChallenge(
      challenge,
      username,
      password,
      kapca
    );

    if (!login.ok) {
      return NextResponse.json(
        { success: false, error: login.error },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("lms_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "unindra",
          status: "connected",
          lms_username: username,
          session_reference: encryptSessionReference(login.session, user.id),
          session_expires_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      )
      .select(CONNECTION_COLUMNS)
      .single();

    if (error) {
      console.error("LMS connection POST error:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Login LMS berhasil, tetapi koneksi gagal disimpan.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      connection: data,
      message: "LMS berhasil terhubung.",
    });
  } catch (error) {
    // Pesan error saja yang dicatat, tidak pernah isi permintaan.
    console.error(
      "LMS connect error:",
      error instanceof Error ? error.message : "unknown"
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menghubungkan LMS.",
      },
      { status: 502 }
    );
  }
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User belum login." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const lmsUsername =
      typeof body.lms_username === "string" ? body.lms_username.trim() : null;

    const status = typeof body.status === "string" ? body.status : "connecting";

    // Sesi LMS TIDAK boleh diatur dari browser. Hanya username dan status
    // yang diperbarui, session_reference tidak disentuh.
    const { data: existing } = await supabase
      .from("lms_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "unindra")
      .maybeSingle();

    const saved = existing
      ? await supabase
          .from("lms_connections")
          .update({
            status,
            lms_username: lmsUsername,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .select(CONNECTION_COLUMNS)
          .single()
      : await supabase
          .from("lms_connections")
          .insert({
            user_id: user.id,
            provider: "unindra",
            status,
            lms_username: lmsUsername,
          })
          .select(CONNECTION_COLUMNS)
          .single();

    const { data, error } = saved;

    if (error) {
      console.error("LMS connection PUT error:", error);

      return NextResponse.json(
        { success: false, error: "Gagal menyimpan koneksi LMS." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, connection: data });
  } catch (error) {
    console.error("LMS connection PUT error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User belum login." },
        { status: 401 }
      );
    }

    // Menghapus baris berarti sesi LMS tersimpan ikut terhapus.
    const { error } = await supabase
      .from("lms_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "unindra");

    if (error) {
      console.error("LMS connection DELETE error:", error);

      return NextResponse.json(
        { success: false, error: "Gagal memutus koneksi LMS." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Koneksi LMS berhasil diputus.",
    });
  } catch (error) {
    console.error("LMS connection DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan.",
      },
      { status: 500 }
    );
  }
}
