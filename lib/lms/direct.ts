import crypto from "crypto";

export const LMS_BASE = "https://lms.unindra.ac.id";

export type LoginChallenge = {
  uid: string; // id user StudyFlow pemilik tantangan ini
  exp: number; // waktu kedaluwarsa (ms)
  cookie: string; // cookie sesi LMS sebelum login
  hidden: Record<string, string>; // field tersembunyi form login (token)
};

function getKey(): Buffer {
  const raw = process.env.LMS_CHALLENGE_SECRET;

  if (!raw) {
    throw new Error("LMS_CHALLENGE_SECRET belum diatur di environment.");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("LMS_CHALLENGE_SECRET harus 32 byte (base64).");
  }

  return key;
}

// Tantangan dienkripsi (AES-256-GCM) supaya cookie sesi LMS tidak
// pernah terbaca atau bisa diubah di browser.
export function sealChallenge(payload: LoginChallenge): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url"
  );
}

export function openChallenge(token: string): LoginChallenge | null {
  try {
    const data = Buffer.from(token, "base64url");

    if (data.length < 29) return null;

    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");

    const parsed = JSON.parse(decrypted) as LoginChallenge;

    if (
      typeof parsed.uid !== "string" ||
      typeof parsed.exp !== "number" ||
      typeof parsed.cookie !== "string" ||
      typeof parsed.hidden !== "object" ||
      parsed.hidden === null
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function lmsFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    return await fetch(`${LMS_BASE}${path}`, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// name -> value dari header Set-Cookie
export function readSetCookies(res: Response): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of res.headers.getSetCookie?.() ?? []) {
    const pair = line.split(";")[0];
    const index = pair.indexOf("=");

    if (index > 0) {
      result[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
    }
  }

  return result;
}

export function cookiesToHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

// Membaca semua <input type="hidden"> beserta nilainya.
export function parseHiddenFields(html: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];

    if (!/type=["']hidden["']/i.test(tag)) continue;

    const name = tag.match(/name=["']([^"']+)["']/i)?.[1];
    const value = tag.match(/value=["']([^"']*)["']/i)?.[1] ?? "";

    if (name) {
      result[name] = value.replace(/&amp;/g, "&");
    }
  }

  return result;
}

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const pair of header.split("; ")) {
    const index = pair.indexOf("=");

    if (index > 0) {
      result[pair.slice(0, index)] = pair.slice(index + 1);
    }
  }

  return result;
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function pathOf(location: string | null): string | null {
  if (!location) return null;

  try {
    return new URL(location, LMS_BASE).pathname;
  } catch {
    return null;
  }
}

export type DirectLoginResult =
  | { ok: true; session: Record<string, string> }
  | { ok: false; error: string };

/**
 * Login langsung ke LMS memakai tantangan captcha yang sudah dijawab user.
 * Mengembalikan cookie sesi hanya jika /member benar-benar terbuka.
 * "Remember me" sengaja tidak dikirim.
 */
export async function loginWithChallenge(
  challenge: LoginChallenge,
  username: string,
  password: string,
  kapca: string
): Promise<DirectLoginResult> {
  const form = new URLSearchParams({
    ...challenge.hidden,
    username,
    pswd: password,
    kapca,
  });

  const response = await lmsFetch("/login_new", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: challenge.cookie,
      origin: LMS_BASE,
      referer: `${LMS_BASE}/`,
    },
    body: form.toString(),
  });

  const locationPath = pathOf(response.headers.get("location"));

  const redirected =
    [301, 302, 303].includes(response.status) &&
    !!locationPath &&
    !/login/i.test(locationPath) &&
    locationPath !== "/";

  if (!redirected || !locationPath) {
    const text = await response.text();

    const alertMatch = text.match(
      /<div[^>]*class=["'][^"']*alert[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );

    const detail = alertMatch ? stripTags(alertMatch[1]) : "";

    return {
      ok: false,
      error: detail
        ? `Login LMS ditolak: ${detail}`
        : "Login LMS ditolak. Periksa username, password, dan jawaban captcha.",
    };
  }

  const jar = {
    ...parseCookieHeader(challenge.cookie),
    ...readSetCookies(response),
  };

  // Pastikan sesi benar-benar diterima sebagai sesi login.
  const member = await lmsFetch(locationPath, {
    headers: { cookie: cookiesToHeader(jar) },
  });

  const memberText = await member.text();

  if (member.status !== 200 || /name=["']pswd["']/i.test(memberText)) {
    return {
      ok: false,
      error: "Login tampak berhasil, tetapi sesi LMS tidak diterima. Coba lagi.",
    };
  }

  Object.assign(jar, readSetCookies(member));

  if (!jar.ci_session) {
    return { ok: false, error: "Sesi LMS tidak ditemukan setelah login." };
  }

  return { ok: true, session: jar };
}
