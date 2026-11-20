import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  cookiesToHeader,
  lmsFetch,
  openChallenge,
  readSetCookies,
} from "@/lib/lms/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ROUTE SEMENTARA UNTUK PENGUJIAN.
// Mengirim login ke LMS lalu mengembalikan DIAGNOSIS SAJA.
// Tidak menyimpan apa pun, tidak mengembalikan nilai cookie atau password,
// dan tidak mencatat isi permintaan ke log.

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function stripTags(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return fail("User belum login.", 401);
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("Format permintaan tidak valid.", 400);
    }

    const challengeToken =
      typeof body.challenge === "string" ? body.challenge : "";
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const kapca = typeof body.kapca === "string" ? body.kapca : "";

    if (!username || !password || !kapca) {
      return fail("Username, password, dan jawaban captcha wajib diisi.", 400);
    }

    if (username.length > 64 || password.length > 128 || kapca.length > 10) {
      return fail("Panjang input tidak valid.", 400);
    }

    const challenge = openChallenge(challengeToken);

    if (!challenge || challenge.uid !== user.id) {
      return fail("Captcha tidak valid. Muat ulang captcha.", 400);
    }

    if (Date.now() > challenge.exp) {
      return fail("Captcha kedaluwarsa. Muat ulang captcha.", 400);
    }

    // Form yang sama dengan form login LMS. "login-check" (Remember me)
    // sengaja tidak dikirim.
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
        origin: "https://lms.unindra.ac.id",
        referer: "https://lms.unindra.ac.id/",
      },
      body: form.toString(),
    });

    const location = response.headers.get("location");
    let locationPath: string | null = null;

    if (location) {
      try {
        locationPath = new URL(location, "https://lms.unindra.ac.id").pathname;
      } catch {
        locationPath = "(tidak terbaca)";
      }
    }

    const text = await response.text();

    const alertMatch = text.match(
      /<div[^>]*class=["'][^"']*alert[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );

    const newCookies = readSetCookies(response);

    const looksSuccessful =
      [301, 302, 303].includes(response.status) &&
      !!locationPath &&
      !/login/i.test(locationPath) &&
      locationPath !== "/";

    // Verifikasi: apakah cookie sesi yang sama benar-benar diterima
    // sebagai sesi login? Hanya status dan bentuk halaman yang dilaporkan,
    // isi halaman (data pribadi) tidak dikembalikan.
    let memberCheck: Record<string, unknown> | null = null;

    if (looksSuccessful && locationPath) {
      const jar: Record<string, string> = {};

      for (const pair of challenge.cookie.split("; ")) {
        const index = pair.indexOf("=");

        if (index > 0) {
          jar[pair.slice(0, index)] = pair.slice(index + 1);
        }
      }

      Object.assign(jar, newCookies);

      const member = await lmsFetch(locationPath, {
        headers: { cookie: cookiesToHeader(jar) },
      });

      const memberLocation = member.headers.get("location");
      let memberLocationPath: string | null = null;

      if (memberLocation) {
        try {
          memberLocationPath = new URL(
            memberLocation,
            "https://lms.unindra.ac.id"
          ).pathname;
        } catch {
          memberLocationPath = "(tidak terbaca)";
        }
      }

      const memberText = await member.text();

      memberCheck = {
        status: member.status,
        location_path: memberLocationPath,
        content_type: member.headers.get("content-type"),
        body_length: memberText.length,
        has_login_form: /name=["']pswd["']/i.test(memberText),
        set_cookie_names: Object.keys(readSetCookies(member)),
      };
    }

    return NextResponse.json({
      success: true,
      status: response.status,
      location_path: locationPath,
      set_cookie_names: Object.keys(newCookies),
      body_length: text.length,
      body_has_login_form: /name=["']pswd["']/i.test(text),
      alert_text: alertMatch ? stripTags(alertMatch[1]) : null,
      looks_successful: looksSuccessful,
      member_check: memberCheck,
    });
  } catch (error) {
    console.error("LMS login-test error:", error);

    return fail(
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat menguji login.",
      502
    );
  }
}
