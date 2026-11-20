import {
  parseContentsHTML,
  parseDashboardHTML,
  parseMeetingsHTML,
} from "./parser";
import type {
  LMSContentsResponse,
  LMSDashboardResponse,
  LMSMeetingsResponse,
} from "./types";

export const LMS_BASE = "https://lms.unindra.ac.id";

/**
 * Mengonversi session object (atau string) menjadi cookie header format "ci_session=...; ..."
 */
export function sessionToCookie(session: unknown): string {
  if (typeof session === "string") {
    try {
      const parsed = JSON.parse(session);
      if (typeof parsed === "object" && parsed !== null) {
        return sessionToCookie(parsed);
      }
    } catch {
      if (session.includes("ci_session=")) {
        return session;
      }
      return `ci_session=${session}`;
    }
  }

  if (typeof session === "object" && session !== null) {
    const entries = Object.entries(session as Record<string, unknown>);
    return entries
      .filter(([_, v]) => typeof v === "string" && (v as string).length > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  return "";
}

/**
 * Mengambil konten HTML halaman LMS Unindra langsung menggunakan cookie sesi
 */
async function fetchLMSPage(
  urlOrPath: string,
  cookieHeader: string
): Promise<string> {
  let targetUrl = urlOrPath;
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = `${LMS_BASE}${targetUrl.startsWith("/") ? "" : "/"}${targetUrl}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: `${LMS_BASE}/member`,
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    const finalUrl = response.url || targetUrl;
    if (
      finalUrl.includes("/login") ||
      (finalUrl.endsWith("/") && !targetUrl.endsWith("/"))
    ) {
      throw new Error(
        "Sesi LMS kedaluwarsa. Silakan putuskan koneksi lalu hubungkan kembali."
      );
    }

    if (!response.ok && response.status !== 200) {
      throw new Error(
        `Gagal membuka halaman LMS (${response.status} ${response.statusText})`
      );
    }

    const html = await response.text();

    if (
      html.includes('name="pswd"') ||
      html.includes('name="kapca"') ||
      html.includes("/login_new")
    ) {
      throw new Error(
        "Sesi LMS kedaluwarsa. Silakan putuskan koneksi lalu hubungkan kembali."
      );
    }

    return html;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mengambil daftar mata kuliah langsung dari /member LMS Unindra
 */
export async function fetchLMSDashboard(
  session: Record<string, unknown>
): Promise<LMSDashboardResponse> {
  const cookie = sessionToCookie(session);
  if (!cookie) {
    return {
      success: false,
      error: "Cookie sesi LMS tidak ditemukan.",
    };
  }

  try {
    const html = await fetchLMSPage("/member", cookie);
    return parseDashboardHTML(html);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengambil dashboard LMS.",
    };
  }
}

/**
 * Mengambil daftar pertemuan langsung dari URL mata kuliah LMS Unindra
 */
export async function fetchLMSMeetings(
  session: Record<string, unknown>,
  courseUrl: string
): Promise<LMSMeetingsResponse> {
  const cookie = sessionToCookie(session);
  if (!cookie) {
    return {
      success: false,
      error: "Cookie sesi LMS tidak ditemukan.",
    };
  }

  try {
    const html = await fetchLMSPage(courseUrl, cookie);
    return parseMeetingsHTML(html);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengambil pertemuan LMS.",
    };
  }
}

/**
 * Mengambil materi dan tugas langsung dari URL pertemuan LMS Unindra
 */
export async function fetchLMSContents(
  session: Record<string, unknown>,
  meetingUrl: string
): Promise<LMSContentsResponse> {
  const cookie = sessionToCookie(session);
  if (!cookie) {
    return {
      success: false,
      error: "Cookie sesi LMS tidak ditemukan.",
    };
  }

  try {
    const html = await fetchLMSPage(meetingUrl, cookie);
    return parseContentsHTML(html);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengambil materi/tugas LMS.",
    };
  }
}

/**
 * Placeholder login untuk kompatibilitas ke belakang (aplikasi sekarang login via direct.ts)
 */
export async function loginToLMS(): Promise<Record<string, unknown>> {
  throw new Error(
    "Login LMS sekarang menggunakan direct challenge authentication."
  );
}
