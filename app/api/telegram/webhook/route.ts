import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const update = await request.json();
    const message = update?.message;

    if (!message?.chat?.id || !message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text).trim();

    // Hanya proses /start TOKEN
    if (!text.startsWith("/start")) {
      return NextResponse.json({ ok: true });
    }

    const token = text.replace(/^\/start\s*/, "").trim();

    if (!token) {
      await sendTelegramMessage(
        chatId,
        "👋 Silakan hubungkan Telegram melalui StudyFlow terlebih dahulu.",
      );

      return NextResponse.json({ ok: true });
    }

    const supabase = createSupabaseAdminClient();

    // Cari token yang masih pending
    const { data: connection, error: connectionError } = await supabase
      .from("telegram_connections")
      .select("*")
      .eq("connection_token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (connectionError) {
      console.error(
        "Telegram connection lookup error:",
        connectionError,
      );

      await sendTelegramMessage(
        chatId,
        "❌ Terjadi kesalahan saat memproses koneksi Telegram.",
      );

      return NextResponse.json({ ok: true });
    }

    if (!connection) {
      await sendTelegramMessage(
        chatId,
        "❌ Token koneksi tidak valid atau sudah digunakan.",
      );

      return NextResponse.json({ ok: true });
    }

    // Cek expiry token
    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at).getTime() < Date.now()
    ) {
      await supabase
        .from("telegram_connections")
        .update({
          status: "expired",
        })
        .eq("user_id", connection.user_id)
        .eq("connection_token", token);

      await sendTelegramMessage(
        chatId,
        [
          "⏰ Token koneksi sudah kedaluwarsa.",
          "",
          "Silakan kembali ke StudyFlow dan klik Connect Telegram lagi.",
        ].join("\n"),
      );

      return NextResponse.json({ ok: true });
    }

    const telegramUsername =
      message.from?.username
        ? String(message.from.username)
        : null;

    const telegramFirstName =
      message.from?.first_name
        ? String(message.from.first_name)
        : null;

    // Simpan informasi Telegram + tandai koneksi berhasil
    const { error: connectionUpdateError } = await supabase
      .from("telegram_connections")
      .update({
        telegram_chat_id: chatId,
        telegram_username: telegramUsername,
        telegram_first_name: telegramFirstName,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        status: "connected",
      })
      .eq("user_id", connection.user_id)
      .eq("connection_token", token);

    if (connectionUpdateError) {
      console.error(
        "Telegram connection update error:",
        connectionUpdateError,
      );

      await sendTelegramMessage(
        chatId,
        "❌ Gagal menyimpan koneksi Telegram.",
      );

      return NextResponse.json({ ok: true });
    }

    // Aktifkan Telegram di notification settings
    const { error: settingsError } = await supabase
      .from("user_notification_settings")
      .upsert(
        {
          user_id: connection.user_id,
          telegram_chat_id: chatId,
          telegram_enabled: true,
        },
        {
          onConflict: "user_id",
        },
      );

    if (settingsError) {
      console.error(
        "Telegram notification settings update error:",
        settingsError,
      );

      await sendTelegramMessage(
        chatId,
        "⚠️ Telegram terhubung, tetapi pengaturan reminder belum berhasil diperbarui.",
      );

      return NextResponse.json({ ok: true });
    }

    await sendTelegramMessage(
      chatId,
      [
        "✅ Telegram berhasil terhubung!",
        "",
        `👤 Akun:  ${telegramFirstName || "Pengguna Telegram"}`,
        "🔔 Reminder Telegram:  Aktif",
        "",
        "StudyFlow sekarang dapat mengirimkan reminder tugas dan jadwal kuliah ke Telegram ini.",
      ].join("\n"),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    return NextResponse.json(
      { ok: false },
      { status: 500 },
    );
  }
}