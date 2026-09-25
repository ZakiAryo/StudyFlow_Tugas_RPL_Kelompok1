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

type RiskLevel = "low" | "medium" | "high";

type ChecklistContext = {
  text: string;
  is_done: boolean;
  position: number;
};

type ScheduleContext = {
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
};

type StudyPlanInput = {
  title: string;
  description: string;
  courseName: string;
  deadline: string;
  priority: string;
  status: string;
  progress: number;
  checklist: ChecklistContext[];
  schedule: ScheduleContext[];
};

type StudyPlanResponse = {
  summary: string;
  plan: {
    date: string;
    time_block: string;
    action: string;
    estimated_minutes: number;
  }[];
  risk_level: RiskLevel;
  suggestion: string;
};

const allowedTaskPriorities = new Set(["low", "medium", "high", "urgent"]);
const allowedTaskStatuses = new Set([
  "not_started",
  "in_progress",
  "revision",
  "completed",
]);
const allowedRiskLevels = new Set(["low", "medium", "high"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

function getTodayDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function isIsoDate(value: string) {
  if (!isoDatePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && value === date.toISOString().slice(0, 10);
}

function parseChecklist(value: unknown): ChecklistContext[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      const text = readString(item.text);

      if (!text) {
        return null;
      }

      return {
        text,
        is_done: Boolean(item.is_done),
        position: Number.isFinite(Number(item.position))
          ? Number(item.position)
          : index,
      };
    })
    .filter((item): item is ChecklistContext => item !== null);
}

function parseSchedule(value: unknown): ScheduleContext[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const dayOfWeek = readString(item.day_of_week);
      const startTime = readString(item.start_time);
      const endTime = readString(item.end_time);

      if (!dayOfWeek || !startTime || !endTime) {
        return null;
      }

      return {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room: readString(item.room),
      };
    })
    .filter((item): item is ScheduleContext => item !== null);
}

function parseStudyPlanInput(body: unknown): StudyPlanInput | NextResponse {
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

  if (!deadline) {
    return errorResponse(
      "Tugas harus memiliki deadline untuk membuat AI Study Plan.",
      "MISSING_TASK_DEADLINE",
      400,
    );
  }

  if (!isIsoDate(deadline)) {
    return errorResponse("Format deadline tidak valid.", "INVALID_DEADLINE", 400);
  }

  if (deadline < getTodayDateString()) {
    return errorResponse(
      "Deadline tugas sudah lewat. AI Study Plan hanya bisa dibuat untuk deadline yang belum lewat.",
      "DEADLINE_ALREADY_PASSED",
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
    checklist: parseChecklist(body.checklist),
    schedule: parseSchedule(body.schedule),
  };
}

function validateStudyPlanResponse(
  response: unknown,
  deadline: string,
): StudyPlanResponse {
  if (!isRecord(response)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini mengembalikan JSON dengan format yang tidak sesuai.",
    );
  }

  const summary = readString(response.summary);
  const suggestion = readString(response.suggestion);
  const riskLevel = readString(response.risk_level).toLowerCase();

  if (!summary || !suggestion || !allowedRiskLevels.has(riskLevel)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini tidak mengembalikan summary, suggestion, atau risk_level yang valid.",
    );
  }

  if (!Array.isArray(response.plan) || response.plan.length === 0) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini tidak mengembalikan plan yang valid.",
    );
  }

  const plan = response.plan.map((item) => {
    if (!isRecord(item)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Item study plan dari Gemini tidak valid.",
      );
    }

    const date = readString(item.date);
    const timeBlock = readString(item.time_block);
    const action = readString(item.action);
    const estimatedMinutes = Number(item.estimated_minutes);

    if (
      !isIsoDate(date) ||
      date > deadline ||
      !timeBlock ||
      !action ||
      !Number.isFinite(estimatedMinutes)
    ) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Item study plan wajib memiliki date, time_block, action, dan estimated_minutes yang valid.",
      );
    }

    return {
      date,
      time_block: timeBlock,
      action,
      estimated_minutes: Math.max(1, Math.round(estimatedMinutes)),
    };
  });

  return {
    summary,
    plan,
    risk_level: riskLevel as RiskLevel,
    suggestion,
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

function buildPrompt(input: StudyPlanInput) {
  const context = JSON.stringify(
    {
      title: input.title,
      description: input.description || "Tidak diisi",
      course_name: input.courseName || "Tidak diisi",
      deadline: input.deadline,
      priority: input.priority,
      status: input.status,
      progress: input.progress,
      existing_checklist: input.checklist,
      course_schedule: input.schedule,
    },
    null,
    2,
  );

  return `
Kamu adalah asisten akademik untuk mahasiswa.
Buat rencana belajar dan pengerjaan tugas yang realistis sebelum deadline.

Konteks tugas:
${context}

Aturan output:
- Balas hanya JSON valid tanpa markdown.
- Gunakan bahasa Indonesia yang ringkas.
- Buat plan bertahap dari hari ini sampai paling lambat tanggal deadline.
- Jangan membuat item dengan date setelah deadline.
- Pertimbangkan progress, priority, status, checklist yang sudah ada, dan jadwal kuliah jika relevan.
- time_block boleh memakai format natural seperti "19:00-20:30" atau "Setelah kelas".
- estimated_minutes harus berupa angka integer.
- risk_level hanya boleh "low", "medium", atau "high".
- Jangan menambahkan field di luar schema.

Schema JSON wajib:
{
  "summary": "string",
  "plan": [
    {
      "date": "YYYY-MM-DD",
      "time_block": "string",
      "action": "string",
      "estimated_minutes": number
    }
  ],
  "risk_level": "low | medium | high",
  "suggestion": "string"
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
      "Kamu harus login untuk menggunakan AI Study Plan.",
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

  const parsedInput = parseStudyPlanInput(body);

  if (parsedInput instanceof NextResponse) {
    return parsedInput;
  }

  try {
    const aiResponse = await generateGeminiJson<unknown>({
      prompt: buildPrompt(parsedInput),
      systemInstruction:
        "Kamu membantu mahasiswa membuat rencana belajar yang realistis, spesifik, dan selesai sebelum deadline.",
      config: {
        temperature: 0.25,
      },
    });

    return NextResponse.json(
      validateStudyPlanResponse(aiResponse, parsedInput.deadline),
    );
  } catch (error) {
    const payload = getGeminiErrorPayload(error);

    return NextResponse.json(payload, {
      status: getGeminiStatus(payload.code),
    });
  }
}
