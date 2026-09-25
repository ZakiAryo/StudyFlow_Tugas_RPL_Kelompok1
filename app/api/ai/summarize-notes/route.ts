import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

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

type TaskContext = {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  priority: string;
  status: string;
  progress: number;
};

type TaskNoteContext = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type NotesSummaryResponse = {
  summary: string;
  important_points: string[];
  suggested_next_actions: string[];
};

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

function validateStringList(value: unknown, fieldName: string) {
  if (!Array.isArray(value)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      `Gemini tidak mengembalikan ${fieldName} dalam bentuk array.`,
    );
  }

  const items = value
    .map((item) => readString(item))
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      `Gemini tidak mengembalikan ${fieldName} yang valid.`,
    );
  }

  return items;
}

function validateNotesSummaryResponse(response: unknown): NotesSummaryResponse {
  if (!isRecord(response)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini mengembalikan JSON notes summarizer dengan format yang tidak sesuai.",
    );
  }

  const summary = readString(response.summary);

  if (!summary) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini tidak mengembalikan summary yang valid.",
    );
  }

  return {
    summary,
    important_points: validateStringList(
      response.important_points,
      "important_points",
    ),
    suggested_next_actions: validateStringList(
      response.suggested_next_actions,
      "suggested_next_actions",
    ),
  };
}

function buildPrompt(task: TaskContext, notes: TaskNoteContext[]) {
  const context = JSON.stringify(
    {
      task: {
        title: task.title,
        description: task.description || "Tidak diisi",
        deadline: task.deadline,
        priority: task.priority,
        status: task.status,
        progress: task.progress,
      },
      notes: notes.map((note, index) => ({
        number: index + 1,
        updated_at: note.updated_at,
        content: note.content,
      })),
    },
    null,
    2,
  );

  return `
Kamu adalah AI Notes Summarizer untuk mahasiswa.
Ringkas notes tugas berikut menjadi insight yang mudah dipakai untuk melanjutkan pekerjaan.

Konteks:
${context}

Aturan output:
- Balas hanya JSON valid tanpa markdown.
- Gunakan bahasa Indonesia yang ringkas dan jelas.
- summary harus merangkum isi notes secara padat.
- important_points berisi poin penting dari notes.
- suggested_next_actions berisi langkah konkret yang bisa dilakukan berikutnya.
- Jangan menambahkan field di luar schema.

Schema JSON wajib:
{
  "summary": "string",
  "important_points": [
    "string"
  ],
  "suggested_next_actions": [
    "string"
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
      "Kamu harus login untuk menggunakan AI Notes Summarizer.",
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

  const taskId = isRecord(body) ? readString(body.taskId) : "";

  if (!taskId) {
    return errorResponse("taskId wajib dikirim.", "MISSING_TASK_ID", 400);
  }

  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select("id,title,description,deadline,priority,status,progress")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (taskError) {
    return errorResponse(taskError.message, "FAILED_TO_LOAD_TASK", 500);
  }

  if (!taskData) {
    return errorResponse(
      "Tugas tidak ditemukan atau bukan milik akun ini.",
      "TASK_NOT_FOUND",
      404,
    );
  }

  const { data: notesData, error: notesError } = await supabase
    .from("task_notes")
    .select("id,content,created_at,updated_at")
    .eq("task_id", taskId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (notesError) {
    return errorResponse(notesError.message, "FAILED_TO_LOAD_TASK_NOTES", 500);
  }

  const notes = ((notesData ?? []) as TaskNoteContext[]).filter((note) =>
    note.content.trim(),
  );

  if (notes.length === 0) {
    return errorResponse(
      "Tugas ini belum memiliki notes untuk diringkas.",
      "EMPTY_TASK_NOTES",
      400,
    );
  }

  const task = taskData as TaskContext;
  const prompt = buildPrompt(task, notes);

  try {
    const aiResponse = await generateGeminiJson<unknown>({
      prompt,
      systemInstruction:
        "Kamu membantu mahasiswa merangkum catatan tugas menjadi ringkasan, poin penting, dan langkah berikutnya.",
      config: {
        temperature: 0.2,
      },
    });

    const validatedResponse = validateNotesSummaryResponse(aiResponse);

    const { error: suggestionError } = await supabase
      .from("ai_suggestions")
      .insert({
        user_id: user.id,
        task_id: task.id,
        type: "notes_summary",
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
