import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const chatId = body.chatId;

    if (!chatId) {
      return NextResponse.json(
        { success: false, error: "chatId wajib diisi" },
        { status: 400 }
      );
    }

    const result = await sendTelegramMessage(
      chatId,
      "🔔 Test notifikasi StudyFlow berhasil!\n\nTelegram sudah terhubung dengan StudyFlow."
    );

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Telegram test error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
      { status: 500 }
    );
  }
}