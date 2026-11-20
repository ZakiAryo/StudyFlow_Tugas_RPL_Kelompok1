import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "TELEGRAM_BOT_TOKEN belum dikonfigurasi" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.description || "Gagal mengambil Telegram updates",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updates: data.result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}