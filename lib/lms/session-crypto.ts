import crypto from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.LMS_SESSION_SECRET;

  if (!raw) {
    throw new Error("LMS_SESSION_SECRET belum diatur di environment.");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("LMS_SESSION_SECRET harus 32 byte (base64).");
  }

  return key;
}

/**
 * Mengenkripsi sesi LMS (AES-256-GCM) sebelum disimpan ke database.
 * userId dipakai sebagai data tambahan terautentikasi: hasil enkripsi
 * milik satu user tidak bisa disalin ke baris user lain.
 */
export function encryptSessionReference(
  session: Record<string, unknown>,
  userId: string
): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);

  return (
    PREFIX +
    Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")
  );
}

export function decryptSessionReference(
  value: string,
  userId: string
): Record<string, unknown> {
  const invalid = new Error(
    "Session LMS tidak valid. Silakan disconnect lalu connect kembali."
  );

  if (!value.startsWith(PREFIX)) {
    throw invalid;
  }

  try {
    const data = Buffer.from(value.slice(PREFIX.length), "base64url");

    if (data.length < 29) throw invalid;

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      data.subarray(0, 12)
    );
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(data.subarray(12, 28));

    const decrypted = Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final(),
    ]).toString("utf8");

    const parsed: unknown = JSON.parse(decrypted);

    if (typeof parsed !== "object" || parsed === null) throw invalid;

    return parsed as Record<string, unknown>;
  } catch {
    throw invalid;
  }
}
