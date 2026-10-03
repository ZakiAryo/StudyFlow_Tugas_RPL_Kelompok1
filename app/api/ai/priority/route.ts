import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  GeminiResponseError,
  generateGeminiJson,
  getGeminiErrorPayload,
} from "@/lib/gemini";

export const runtime = "nodejs";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

type RiskLevel = "low" | "medium" | "high";

type ActiveTask = {
  id: string;
  title: string;
  deadline: string;
  progress: number;
  priority: string;
  status: string;
};

type PriorityRecommendation = {
  task_id: string;
  reason: string;
  suggested_action: string;
  risk_level: RiskLevel;
};

type PriorityResponse = {
  recommendations: PriorityRecommendation[];
};

const allowedRiskLevels = new Set(["low", "medium", "high"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
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

function validatePriorityResponse(
  response: unknown,
  activeTaskIds: Set<string>,
): PriorityResponse {
  if (!isRecord(response) || !Array.isArray(response.recommendations)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini mengembalikan JSON priority assistant dengan format yang tidak sesuai.",
    );
  }

  const recommendations = response.recommendations.map((item) => {
    if (!isRecord(item)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Item rekomendasi dari Gemini tidak valid.",
      );
    }

    const taskId = readString(item.task_id);
    const reason = readString(item.reason);
    const suggestedAction = readString(item.suggested_action);
    const riskLevel = readString(item.risk_level).toLowerCase();

    if (
      !taskId ||
      !activeTaskIds.has(taskId) ||
      !reason ||
      !suggestedAction ||
      !allowedRiskLevels.has(riskLevel)
    ) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Rekomendasi Gemini wajib memakai task_id aktif, reason, suggested_action, dan risk_level valid.",
      );
    }

    return {
      task_id: taskId,
      reason,
      suggested_action: suggestedAction,
      risk_level: riskLevel as RiskLevel,
    };
  });

  if (recommendations.length === 0 && activeTaskIds.size > 0) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini tidak mengembalikan rekomendasi untuk tugas aktif.",
    );
  }

  return {
    recommendations,
  };
}

function buildPrompt(tasks: ActiveTask[]) {
  const context = JSON.stringify(
    {
      current_date: new Date().toISOString().slice(0, 10),
      active_tasks: tasks,
    },
    null,
    2,
  );

  return `
Kamu adalah AI Priority Assistant untuk mahasiswa.
Analisis daftar tugas aktif berikut dan urutkan berdasarkan urgency dan importance.

Konteks:
${context}

Pertimbangan ranking:
- Deadline paling dekat dan overdue memiliki urgency lebih tinggi.
- Priority urgent/high meningkatkan importance.
- Progress rendah dengan deadline dekat meningkatkan risiko.
- Status revision atau in_progress tetap perlu diprioritaskan jika deadline dekat.
- Abaikan tugas yang tidak ada di daftar.

Aturan output:
- Balas hanya JSON valid tanpa markdown.
- Gunakan task_id persis dari daftar.
- Urutkan recommendations dari yang paling perlu dikerjakan terlebih dahulu.
- reason dan suggested_action harus singkat, praktis, dan dalam bahasa Indonesia.
- risk_level hanya boleh "low", "medium", atau "high".
- Jangan menambahkan field di luar schema.

Schema JSON wajib:
{
  "recommendations": [
    {
      "task_id": "string",
      "reason": "string",
      "suggested_action": "string",
      "risk_level": "low | medium | high"
    }
  ]
}
`.trim();
}

function getGeminiStatus(code: string) {
  return code === "MISSING_GEMINI_API_KEY" ? 500 : 502;
}

export async function POST() {
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
      "Kamu harus login untuk menggunakan AI Priority Assistant.",
      "UNAUTHENTICATED",
      401,
    );
  }

  const { data: tasksData, error: tasksError } = await supabase
    .from("tasks")
    .select("id,title,deadline,progress,priority,status")
    .eq("user_id", user.id)
    .neq("status", "completed")
    .order("deadline", { ascending: true });

  if (tasksError) {
    return errorResponse(
      tasksError.message,
      "FAILED_TO_LOAD_ACTIVE_TASKS",
      500,
    );
  }

  const activeTasks = (tasksData ?? []) as ActiveTask[];

  if (activeTasks.length === 0) {
    return NextResponse.json({ recommendations: [] });
  }

  const prompt = buildPrompt(activeTasks);

  try {
    const aiResponse = await generateGeminiJson<unknown>({
      prompt,
      systemInstruction:
        "Kamu membantu mahasiswa menentukan tugas mana yang harus dikerjakan terlebih dahulu secara realistis.",
      config: {
        temperature: 0.2,
      },
    });

    const validatedResponse = validatePriorityResponse(
      aiResponse,
      new Set(activeTasks.map((task) => task.id)),
    );

    const { error: suggestionError } = await supabase
      .from("ai_suggestions")
      .insert({
        user_id: user.id,
        task_id: null,
        type: "priority",
        prompt,
        response: validatedResponse,
      });

    if (suggestionError) {
      return errorResponse(
        suggestionError.message,
        "FAILED_TO_SAVE_AI_SUGGESTION",
        500,
      );
    }

    return NextResponse.json(validatedResponse);
  } catch (error) {
    const payload = getGeminiErrorPayload(error);

    return NextResponse.json(payload, {
      status: getGeminiStatus(payload.code),
    });
  }
}
