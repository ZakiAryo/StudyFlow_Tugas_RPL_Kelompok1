import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  GeminiResponseError,
  generateGeminiJson,
  getGeminiErrorPayload,
} from "@/lib/gemini";
import { clamp } from "@/lib/utils";

export const runtime = "nodejs";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

type BreakdownPriority = "low" | "medium" | "high";

type BreakdownInput = {
  title: string;
  description: string;
  courseName: string;
  deadline: string;
  priority: string;
  status: string;
  progress: number;
};

type BreakdownResponse = {
  summary: string;
  checklist: {
    title: string;
    estimated_minutes: number;
    priority: BreakdownPriority;
  }[];
};

const allowedTaskPriorities = new Set(["low", "medium", "high", "urgent"]);
const allowedTaskStatuses = new Set([
  "not_started",
  "in_progress",
  "revision",
  "completed",
]);
const allowedBreakdownPriorities = new Set(["low", "medium", "high"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

function parseBreakdownInput(body: unknown): BreakdownInput | NextResponse {
  if (!isRecord(body)) {
    return errorResponse(
      "Request body harus berupa JSON object.",
      "INVALID_REQUEST_BODY",
      400,
    );
  }

  const title = readString(body.title);
  const description = readString(body.description);
  const courseName = readString(body.courseName);
  const deadline = readString(body.deadline);
  const priority = readString(body.priority);
  const status = readString(body.status);
  const rawProgress = Number(body.progress);

  if (!title) {
    return errorResponse("Judul tugas tidak boleh kosong.", "EMPTY_TASK_TITLE", 400);
  }

  if (!description) {
    return errorResponse(
      "Deskripsi tugas tidak boleh kosong.",
      "EMPTY_TASK_DESCRIPTION",
      400,
    );
  }

  if (priority && !allowedTaskPriorities.has(priority)) {
    return errorResponse(
      "Priority tugas tidak valid.",
      "INVALID_TASK_PRIORITY",
      400,
    );
  }

  if (status && !allowedTaskStatuses.has(status)) {
    return errorResponse("Status tugas tidak valid.", "INVALID_TASK_STATUS", 400);
  }

  return {
    title,
    description,
    courseName,
    deadline,
    priority: priority || "medium",
    status: status || "not_started",
    progress: Number.isFinite(rawProgress) ? clamp(rawProgress, 0, 100) : 0,
  };
}

function validateBreakdownResponse(response: unknown): BreakdownResponse {
  if (!isRecord(response)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini mengembalikan JSON dengan format yang tidak sesuai.",
    );
  }

  const summary = readString(response.summary);

  if (!summary) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini tidak mengembalikan summary yang valid.",
    );
  }

  if (!Array.isArray(response.checklist) || response.checklist.length === 0) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini tidak mengembalikan checklist yang valid.",
    );
  }

  const checklist = response.checklist.map((item) => {
    if (!isRecord(item)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Item checklist dari Gemini tidak valid.",
      );
    }

    const title = readString(item.title);
    const estimatedMinutes = Number(item.estimated_minutes);
    const priority = readString(item.priority).toLowerCase();

    if (!title || !Number.isFinite(estimatedMinutes)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Item checklist dari Gemini wajib memiliki title dan estimated_minutes.",
      );
    }

    if (!allowedBreakdownPriorities.has(priority)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Priority checklist dari Gemini harus low, medium, atau high.",
      );
    }

    return {
      title,
      estimated_minutes: Math.max(1, Math.round(estimatedMinutes)),
      priority: priority as BreakdownPriority,
    };
  });

  return {
    summary,
    checklist,
  };
}

async function createAuthenticatedSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

function buildPrompt(input: BreakdownInput) {
  const context = JSON.stringify(
    {
      title: input.title,
      description: input.description,
      course_name: input.courseName || "Tidak diisi",
      deadline: input.deadline || "Tidak diisi",
      priority: input.priority,
      status: input.status,
      progress: input.progress,
    },
    null,
    2,
  );

  return `
Kamu adalah asisten akademik untuk mahasiswa.
Buat breakdown tugas menjadi langkah-langkah kecil yang realistis dan bisa langsung dikerjakan.

Konteks tugas:
${context}

Aturan output:
- Balas hanya JSON valid tanpa markdown.
- Gunakan bahasa Indonesia yang ringkas.
- Buat 4 sampai 8 checklist.
- estimated_minutes harus berupa angka integer.
- priority checklist hanya boleh "low", "medium", atau "high".
- Jangan menambahkan field di luar schema.

Schema JSON wajib:
{
  "summary": "string",
  "checklist": [
    {
      "title": "string",
      "estimated_minutes": number,
      "priority": "low | medium | high"
    }
  ]
}
`.trim();
}

function getGeminiStatus(code: string) {
  return code === "MISSING_GEMINI_API_KEY" ? 500 : 502;
}

export async function POST(request: NextRequest) {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    return errorResponse(
      "Environment Supabase belum lengkap.",
      "MISSING_SUPABASE_ENV",
      500,
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "Kamu harus login untuk menggunakan AI Task Breakdown.",
      "UNAUTHENTICATED",
      401,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("JSON request tidak valid.", "INVALID_JSON_BODY", 400);
  }

  const parsedInput = parseBreakdownInput(body);

  if (parsedInput instanceof NextResponse) {
    return parsedInput;
  }

  try {
    const aiResponse = await generateGeminiJson<unknown>({
      prompt: buildPrompt(parsedInput),
      systemInstruction:
        "Kamu membantu mahasiswa memecah tugas akademik menjadi checklist yang jelas, realistis, dan terstruktur.",
      config: {
        temperature: 0.25,
      },
    });

    return NextResponse.json(validateBreakdownResponse(aiResponse));
  } catch (error) {
    const payload = getGeminiErrorPayload(error);

    return NextResponse.json(payload, {
      status: getGeminiStatus(payload.code),
    });
  }
}
