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

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_answer_index: number;
};

type MaterialQuizResponse = {
  title: string;
  questions: QuizQuestion[];
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

function validateQuizResponse(response: unknown): MaterialQuizResponse {
  if (!isRecord(response) || !Array.isArray(response.questions)) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Gemini mengembalikan JSON quiz dengan format tidak valid.",
    );
  }

  const title = readString(response.title);

  if (!title) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Quiz wajib memiliki title.",
    );
  }

  const questions = response.questions.map((item, index) => {
    if (!isRecord(item)) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Question dari Gemini tidak valid.",
      );
    }

    const id = readString(item.id) || `q${index + 1}`;
    const question = readString(item.question);

    if (!question || !Array.isArray(item.options) || item.options.length !== 4) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "Setiap question wajib memiliki pertanyaan dan 4 options.",
      );
    }

    const options = item.options.map((option) => {
      const text = readString(option);

      if (!text) {
        throw new GeminiResponseError(
          "INVALID_GEMINI_JSON",
          "Options quiz tidak boleh kosong.",
        );
      }

      return text;
    });
    const correctAnswerIndex = Number(item.correct_answer_index);

    if (
      !Number.isInteger(correctAnswerIndex) ||
      correctAnswerIndex < 0 ||
      correctAnswerIndex > 3
    ) {
      throw new GeminiResponseError(
        "INVALID_GEMINI_JSON",
        "correct_answer_index wajib berupa angka 0 sampai 3.",
      );
    }

    return {
      id,
      question,
      options,
      correct_answer_index: correctAnswerIndex,
    };
  });

  if (questions.length === 0) {
    throw new GeminiResponseError(
      "INVALID_GEMINI_JSON",
      "Quiz wajib memiliki minimal satu pertanyaan.",
    );
  }

  return { title, questions };
}

function clampQuestionCount(value: unknown) {
  const count = Number(value);

  if (!Number.isFinite(count)) {
    return 5;
  }

  return Math.min(Math.max(Math.round(count), 3), 10);
}

function buildPrompt({
  courseName,
  fileName,
  questionCount,
  taskDescription,
  taskTitle,
}: {
  courseName: string;
  fileName: string;
  questionCount: number;
  taskDescription: string | null;
  taskTitle: string;
}) {
  return `
Kamu adalah StudyFlow AI Quiz Generator untuk mahasiswa.
Buat quiz pilihan ganda berdasarkan dokumen materi yang dilampirkan.

Konteks:
- Tugas: ${taskTitle}
- Deskripsi tugas: ${taskDescription || "Tidak ada deskripsi"}
- Mata kuliah: ${courseName}
- Nama file: ${fileName}
- Jumlah pertanyaan: ${questionCount}

Aturan quiz:
- Semua pertanyaan harus berdasarkan isi dokumen.
- Gunakan Bahasa Indonesia.
- Setiap pertanyaan memiliki 4 pilihan jawaban.
- Hanya ada satu jawaban benar.
- correct_answer_index memakai angka 0, 1, 2, atau 3.
- Jangan menambahkan penjelasan di luar JSON.
- Jangan membuat pertanyaan yang terlalu ambigu.

Schema JSON wajib:
{
  "title": "string",
  "questions": [
    {
      "id": "string",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correct_answer_index": number
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
      "Kamu harus login untuk membuat quiz materi.",
      "UNAUTHENTICATED",
      401,
    );
  }

  const body = (await request.json().catch(() => null)) as {
    taskId?: unknown;
    materialId?: unknown;
    questionCount?: unknown;
  } | null;
  const taskId = readString(body?.taskId);
  const materialId = readString(body?.materialId);
  const questionCount = clampQuestionCount(body?.questionCount);

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
      questionCount,
      taskDescription: context.task.description,
      taskTitle: context.task.title,
    });

    const aiResponse = await generateGeminiJsonWithInlineFile<unknown>({
      prompt,
      file: context.file,
      systemInstruction:
        "Kamu membuat quiz belajar yang akurat berdasarkan dokumen yang diupload user.",
      config: {
        temperature: 0.35,
      },
    });
    const validatedResponse = validateQuizResponse(aiResponse);

    const { error: suggestionError } = await supabase
      .from("ai_suggestions")
      .insert({
        user_id: user.id,
        task_id: context.task.id,
        type: "material_quiz",
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

    if (payload.code !== "UNKNOWN_GEMINI_ERROR") {
      return NextResponse.json(payload, {
        status: getGeminiStatus(payload.code),
      });
    }

    return errorResponse(
      error instanceof Error ? error.message : "Gagal membuat quiz materi.",
      "FAILED_TO_GENERATE_MATERIAL_QUIZ",
      500,
    );
  }
}
