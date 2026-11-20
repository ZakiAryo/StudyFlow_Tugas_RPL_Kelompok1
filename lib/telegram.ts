const TELEGRAM_API_URL = "https://api.telegram.org";

type TelegramResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export async function sendTelegramMessage(
  chatId: string | number,
  message: string
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum dikonfigurasi");
  }

  const response = await fetch(
    `${TELEGRAM_API_URL}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    }
  );

  const data = (await response.json()) as TelegramResponse;

  if (!response.ok || !data.ok) {
    throw new Error(
      data.description || "Gagal mengirim pesan Telegram"
    );
  }

  return data.result;
}