import { NextResponse } from "next/server";
import crypto from "crypto";

import { createSupabaseServerClient } from "@/lib/supabase-server";

const TOKEN_EXPIRY_MINUTES = 10;

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Telegram connect auth error:", userError);

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

    const botUsername = process.env.TELEGRAM_BOT_USERNAME;

    if (!botUsername) {
      console.error("TELEGRAM_BOT_USERNAME belum diatur.");

      return NextResponse.json(
        { error: "Konfigurasi Telegram bot belum lengkap." },
        { status: 500 },
      );
    }

    // Generate token baru untuk setiap proses Connect / Reconnect.
    const connectionToken = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    /*
     * Jika user belum punya record:
     *   → INSERT
     *
     * Jika user sudah punya record:
     *   → UPDATE
     *
     * Ini mencegah duplicate key ketika user melakukan reconnect.
     */
    const { error: upsertError } = await supabase
      .from("telegram_connections")
      .upsert(
        {
          user_id: user.id,
          connection_token: connectionToken,
          token_expires_at: expiresAt,
          status: "pending",

          // Reset data koneksi lama.
          telegram_chat_id: null,
          telegram_username: null,
          telegram_first_name: null,
          connected_at: null,
        },
        {
          onConflict: "user_id",
        },
      );

    if (upsertError) {
      console.error("Telegram connect upsert error:", {
        message: upsertError.message,
        code: upsertError.code,
        details: upsertError.details,
        hint: upsertError.hint,
      });

      return NextResponse.json(
        {
          error: "Gagal membuat token koneksi Telegram.",
          debug: {
            message: upsertError.message,
            code: upsertError.code,
            details: upsertError.details,
            hint: upsertError.hint,
          },
        },
        { status: 500 },
      );
    }

    const telegramUrl = `https://t.me/${botUsername}?start=${connectionToken}`;

    return NextResponse.json({
      success: true,
      telegramUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("Telegram connect unexpected error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan saat membuat koneksi Telegram." },
      { status: 500 },
    );
  }
}