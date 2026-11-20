import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  cookiesToHeader,
  lmsFetch,
  parseHiddenFields,
  readSetCookies,
  sealChallenge,
} from "@/lib/lms/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "User belum login." },
        { status: 401 }
      );
    }

    // 1. Buka halaman login: ambil cookie sesi dan field tersembunyi
    const page = await lmsFetch("/");
    const html = await page.text();
    const cookies = readSetCookies(page);

    if (Object.keys(cookies).length === 0) {
      throw new Error("LMS tidak mengeluarkan cookie sesi.");
    }

    const hidden = parseHiddenFields(html);

    // 2. Ambil gambar captcha dengan cookie yang sama
    const captcha = await lmsFetch("/kapca", {
      headers: { cookie: cookiesToHeader(cookies) },
    });

    if (!captcha.ok) {
      throw new Error(`Gambar captcha gagal diambil (${captcha.status}).`);
    }

    Object.assign(cookies, readSetCookies(captcha));

    const mime = (captcha.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .replace("image/jpg", "image/jpeg");

    const image = Buffer.from(await captcha.arrayBuffer()).toString("base64");

    // 3. Bungkus cookie dan token jadi tantangan terenkripsi
    const challenge = sealChallenge({
      uid: user.id,
      exp: Date.now() + CHALLENGE_TTL_MS,
      cookie: cookiesToHeader(cookies),
      hidden,
    });

    return NextResponse.json({
      success: true,
      challenge,
      image: `data:${mime};base64,${image}`,
    });
  } catch (error) {
    console.error("LMS captcha error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil captcha dari LMS.",
      },
      { status: 502 }
    );
  }
}
