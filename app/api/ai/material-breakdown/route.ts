import { NextResponse } from "next/server";

import {
  createAuthenticatedSupabaseClient,
  loadMaterialDocumentContext,
} from "@/lib/material-ai-server";
import {
  GeminiResponseError,
  generateGeminiJsonWithInlineFile,
  getGeminiErrorPayload,
} from "@/lib/gemini";

export const runtime = "nodejs";

type MaterialBreakdownItem = {
  title: string;
  estimated_minutes: number;
  priority: "low" | "medium" | "high";
};

type MaterialBreakdownResponse = {
  summary: string;
  key_points: string[];
  concepts: Array<{
    term: string;
    explanation: string;
  }>;
  suggested_checklist: MaterialBreakdownItem[];
};

const allowedPriorities = new Set(["low", "medium", "high"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

function validateStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      `Gemini wajib mengembalikan ${label}.`,
    );
  }

  return value.map((item) => {
    const text = readString(item);

    if (!text) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        `${label} berisi item yang tidak valid.`,
      );
    }

    return text;
  });
}

function validateBreakdownResponse(
  response: unknown,
): MaterialBreakdownResponse {
  if (!isRecord(response)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini mengembalikan JSON breakdown materi dengan format tidak valid.",
    );
  }

  const summary = readString(response.summary);

  if (!summary) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Summary materi tidak boleh kosong.",
    );
  }

  const keyPoints = validateStringArray(response.key_points, "key_points");

  if (!Array.isArray(response.concepts)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini wajib mengembalikan concepts.",
    );
  }

  const concepts = response.concepts.map((concept) => {
    if (!isRecord(concept)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Concept dari Gemini tidak valid.",
      );
    }

    const term = readString(concept.term);
    const explanation = readString(concept.explanation);

    if (!term || !explanation) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Concept wajib memiliki term dan explanation.",
      );
    }

    return { term, explanation };
  });

  if (!Array.isArray(response.suggested_checklist)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini wajib mengembalikan suggested_checklist.",
    );
  }

  const suggestedChecklist = response.suggested_checklist.map((item) => {
    if (!isRecord(item)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Checklist dari Gemini tidak valid.",
      );
    }

    const title = readString(item.title);
    const estimatedMinutes = Number(item.estimated_minutes);
    const priority = readString(item.priority).toLowerCase();

    if (
      !title ||
      !Number.isFinite(estimatedMinutes) ||
      estimatedMinutes <= 0 ||
      !allowedPriorities.has(priority)
    ) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Checklist materi wajib memiliki title, estimated_minutes, dan priority valid.",
      );
    }

    return {
      title,
      estimated_minutes: Math.round(estimatedMinutes),
      priority: priority as MaterialBreakdownItem["priority"],
    };
  });

  return {
    summary,
    key_points: keyPoints,
    concepts,
    suggested_checklist: suggestedChecklist,
  };
}

function buildPrompt({
  courseName,
  fileName,
  taskDescription,
  taskTitle,
}: {
  courseName: string;
  fileName: string;
  taskDescription: string | null;
  taskTitle: string;
}) {
  return `
Kamu adalah StudyFlow AI, asisten belajar mahasiswa.
Analisis dokumen materi yang dilampirkan untuk membantu user memahami tugas akademik.

Konteks:
- Tugas: ${taskTitle}
- Deskripsi tugas: ${taskDescription || "Tidak ada deskripsi"}
- Mata kuliah: ${courseName}
- Nama file: ${fileName}

Tugasmu:
- Ringkas isi materi.
- Ambil poin penting yang relevan dengan tugas.
- Jelaskan konsep utama secara ringkas.
- Buat checklist belajar/kerja dari materi.

Aturan output:
- Balas hanya JSON valid tanpa markdown.
- Semua teks dalam Bahasa Indonesia.
- Jangan menambahkan field di luar schema.
- Jika materi tidak relevan, tetap berikan ringkasan isi materi dan beri checklist yang realistis.

Schema JSON wajib:
{
  "summary": "string",
  "key_points": ["string"],
  "concepts": [
    {
      "term": "string",
      "explanation": "string"
    }
  ],
  "suggested_checklist": [
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

export async function POST(request: Request) {
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
      "Kamu harus login untuk memakai AI breakdown materi.",
      "UNAUTHENTICATED",
      401,
    );
  }

  const body = (await request.json().catch(() => null)) as {
    taskId?: unknown;
    materialId?: unknown;
  } | null;
  const taskId = readString(body?.taskId);
  const materialId = readString(body?.materialId);

  if (!taskId || !materialId) {
    return errorResponse(
      "taskId dan materialId wajib diisi.",
      "MISSING_MATERIAL_INPUT",
      400,
    );
  }

  try {
    const context = await loadMaterialDocumentContext({
      taskId,
      materialId,
      userId: user.id,
    });
    const prompt = buildPrompt({
      courseName: context.course?.name ?? "Mata kuliah",
      fileName: context.material.file_name,
      taskDescription: context.task.description,
      taskTitle: context.task.title,
    });

    const aiResponse = await generateGeminiJsonWithInlineFile<unknown>({
      prompt,
      file: context.file,
      systemInstruction:
        "Kamu membantu mahasiswa memahami materi kuliah dari dokumen yang diupload.",
      config: {
        temperature: 0.25,
      },
    });
    const validatedResponse = validateBreakdownResponse(aiResponse);

    const [materialUpdateResult, suggestionResult] = await Promise.all([
      supabase
        .from("task_materials")
        .update({ ai_breakdown: validatedResponse })
        .eq("id", context.material.id)
        .eq("user_id", user.id),
      supabase.from("ai_suggestions").insert({
        user_id: user.id,
        task_id: context.task.id,
        type: "material_breakdown",
        prompt,
        response: validatedResponse,
      }),
    ]);

    if (materialUpdateResult.error) {
      return errorResponse(
        materialUpdateResult.error.message,
        "FAILED_TO_SAVE_MATERIAL_BREAKDOWN",
        500,
      );
    }

    if (suggestionResult.error) {
      return errorResponse(
        suggestionResult.error.message,
        "FAILED_TO_SAVE_AI_SUGGESTION",
        500,
      );
    }

    return NextResponse.json(validatedResponse);
  } catch (error) {
    const payload = getGeminiErrorPayload(error);

    if (payload.code !== "UNKNOWN_GEMINI_ERROR") {
      return NextResponse.json(payload, {
        status: getGeminiStatus(payload.code),
      });
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Gagal membuat breakdown materi.",
      "FAILED_TO_BREAKDOWN_MATERIAL",
      500,
    );
  }
}
