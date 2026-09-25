import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  try {
    // Ambil user yang sedang login
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Telegram disconnect auth error:", userError);

      return NextResponse.json(
        { error: "Gagal memeriksa session user." },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Kamu harus login terlebih dahulu." },
        { status: 401 },
      );
    }

    // Gunakan admin client agar update tetap bisa dilakukan
    // walaupun RLS telegram_connections membatasi update.
    const admin = createSupabaseAdminClient();

    const disconnectedAt = new Date().toISOString();

    // Putuskan koneksi Telegram
    const { error: connectionError } = await admin
      .from("telegram_connections")
      .update({
        status: "disconnected",
        disconnected_at: disconnectedAt,
      })
      .eq("user_id", user.id)
      .eq("status", "connected");

    if (connectionError) {
      console.error(
        "Telegram disconnect connection error:",
        connectionError,
      );

      return NextResponse.json(
        { error: "Gagal memutus koneksi Telegram." },
        { status: 500 },
      );
    }

    // Nonaktifkan reminder Telegram
    const { error: settingsError } = await admin
      .from("user_notification_settings")
      .update({
        telegram_enabled: false,
        telegram_chat_id: null,
      })
      .eq("user_id", user.id);

    if (settingsError) {
      console.error(
        "Telegram disconnect settings error:",
        settingsError,
      );

      return NextResponse.json(
        {
          error:
            "Koneksi Telegram sudah diputus, tetapi pengaturan reminder gagal diperbarui.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Telegram berhasil diputuskan.",
    });
  } catch (error) {
    console.error("Telegram disconnect unexpected error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan saat memutus koneksi Telegram." },
      { status: 500 },
    );
  }
}