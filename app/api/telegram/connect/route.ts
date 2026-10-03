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

    // Token acak yang aman untuk proses koneksi Telegram.
    const connectionToken = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    // Hapus token pending lama milik user.
    const { error: deleteError } = await supabase
      .from("telegram_connections")
      .delete()
      .eq("user_id", user.id)
      .in("status", ["pending", "disconnected"]);

    if (deleteError) {
      console.error(
        "Telegram connect delete pending error:",
        deleteError,
      );

      return NextResponse.json(
        { error: "Gagal membersihkan koneksi Telegram sebelumnya." },
        { status: 500 },
      );
    }

    const { error: insertError } = await supabase
      .from("telegram_connections")
      .insert({
        user_id: user.id,
        connection_token: connectionToken,
        token_expires_at: expiresAt,
        status: "pending",
      });

    if (insertError) {
      console.error("Telegram connect insert error:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });

      return NextResponse.json(
        { 
            error: "Gagal membuat token koneksi Telegram.",
            debug: {
                message: insertError.message,
                code: insertError.code,
                details: insertError.details,
                hint: insertError.hint,
            },
        },    
        { status: 500 },
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