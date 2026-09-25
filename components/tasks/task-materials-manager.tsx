"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  FileQuestion,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react";

import { PriorityBadge } from "@/components/tasks/priority-badge";
import { createSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type MaterialChecklistPriority = "low" | "medium" | "high";

type MaterialBreakdownResult = {
  summary: string;
  key_points: string[];
  concepts: Array<{
    term: string;
    explanation: string;
  }>;
  suggested_checklist: Array<{
    title: string;
    estimated_minutes: number;
    priority: MaterialChecklistPriority;
  }>;
};

type TaskMaterial = {
  id: string;
  user_id: string;
  task_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  ai_breakdown: MaterialBreakdownResult | null;
  created_at: string;
  updated_at: string;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_answer_index: number;
};

type MaterialQuizResult = {
  title: string;
  questions: QuizQuestion[];
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
};

const bucketName = "task-materials";
const maxFileSize = 10 * 1024 * 1024;
const acceptedMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function inferMimeType(file: File) {
  const lowerName = file.name.toLowerCase();

  if (acceptedMimeTypes.has(file.type)) {
    return file.type;
  }

  if (lowerName.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lowerName.endsWith(".md")) {
    return "text/markdown";
  }

  if (lowerName.endsWith(".txt")) {
    return "text/plain";
  }

  return file.type;
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function getUploadErrorMessage(error: unknown) {
  const message = getErrorMessage(error, "Gagal upload materi tugas.");
  const normalized = message.toLowerCase();

  if (normalized.includes("bucket") || normalized.includes("not found")) {
    return "Gagal upload: bucket Supabase Storage `task-materials` belum ada. Jalankan ulang database/schema.sql di Supabase SQL Editor.";
  }

  if (
    normalized.includes("row-level") ||
    normalized.includes("policy") ||
    normalized.includes("permission") ||
    normalized.includes("unauthorized")
  ) {
    return "Gagal upload: policy Supabase Storage belum mengizinkan user mengupload file. Jalankan ulang database/schema.sql dan pastikan user sudah login.";
  }

  return message;
}

function MaterialSkeleton() {
  return (
    <article className="rounded-lg border bg-card p-5 shadow-soft">
      <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </article>
  );
}

export function TaskMaterialsManager({
  courseName,
  taskId,
  taskTitle,
  userId,
}: {
  courseName: string;
  taskId: string;
  taskTitle: string;
  userId: string;
}) {
  const [materials, setMaterials] = useState<TaskMaterial[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBreakdownId, setSelectedBreakdownId] = useState<string | null>(
    null,
  );
  const [quizMaterial, setQuizMaterial] = useState<TaskMaterial | null>(null);
  const [quizResult, setQuizResult] = useState<MaterialQuizResult | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingBreakdown, setIsGeneratingBreakdown] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [busyMaterialId, setBusyMaterialId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedMaterials = useMemo(
    () => [...materials].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [materials],
  );

  const selectedBreakdown = selectedBreakdownId
    ? materials.find((material) => material.id === selectedBreakdownId)
        ?.ai_breakdown ?? null
    : null;

  const quizScore = useMemo(() => {
    if (!quizResult || !quizSubmitted) {
      return 0;
    }

    return quizResult.questions.reduce((score, question) => {
      return quizAnswers[question.id] === question.correct_answer_index
        ? score + 1
        : score;
    }, 0);
  }, [quizAnswers, quizResult, quizSubmitted]);
  const quizTotal = quizResult?.questions.length ?? 0;
  const quizScoreRatio = quizTotal > 0 ? quizScore / quizTotal : 0;

  const loadMaterials = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: loadError } = await supabase
        .from("task_materials")
        .select(
          "id,user_id,task_id,file_name,storage_path,mime_type,file_size,ai_breakdown,created_at,updated_at",
        )
        .eq("task_id", taskId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (loadError) {
        throw loadError;
      }

      setMaterials((data ?? []) as TaskMaterial[]);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Gagal memuat materi tugas."));
    } finally {
      setIsLoading(false);
    }
  }, [taskId, userId]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  async function handleUpload() {
    if (!selectedFile) {
      setError("Pilih file materi terlebih dahulu.");
      return;
    }

    const mimeType = inferMimeType(selectedFile);

    if (!acceptedMimeTypes.has(mimeType)) {
      setError("Format file belum didukung. Gunakan PDF, TXT, atau Markdown.");
      return;
    }

    if (selectedFile.size > maxFileSize) {
      setError("Ukuran file maksimal 10 MB.");
      return;
    }

    setIsUploading(true);
    setError(null);

    const supabase = createSupabaseClient();
    const safeName = sanitizeFileName(selectedFile.name);
    const storagePath = `${userId}/${taskId}/${crypto.randomUUID()}-${safeName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, selectedFile, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data, error: insertError } = await supabase
        .from("task_materials")
        .insert({
          user_id: userId,
          task_id: taskId,
          file_name: selectedFile.name,
          storage_path: storagePath,
          mime_type: mimeType,
          file_size: selectedFile.size,
        })
        .select(
          "id,user_id,task_id,file_name,storage_path,mime_type,file_size,ai_breakdown,created_at,updated_at",
        )
        .single();

      if (insertError) {
        await supabase.storage.from(bucketName).remove([storagePath]);
        throw insertError;
      }

      setMaterials((current) => [data as TaskMaterial, ...current]);
      setSelectedFile(null);
    } catch (uploadError) {
      setError(getUploadErrorMessage(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteMaterial(material: TaskMaterial) {
    const confirmed = window.confirm(`Hapus materi "${material.file_name}"?`);

    if (!confirmed) {
      return;
    }

    setBusyMaterialId(material.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([material.storage_path]);

      if (storageError) {
        throw storageError;
      }

      const { error: deleteError } = await supabase
        .from("task_materials")
        .delete()
        .eq("id", material.id)
        .eq("user_id", userId);

      if (deleteError) {
        throw deleteError;
      }

      setMaterials((current) =>
        current.filter((item) => item.id !== material.id),
      );

      if (selectedBreakdownId === material.id) {
        setSelectedBreakdownId(null);
      }
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Gagal menghapus materi tugas."));
    } finally {
      setBusyMaterialId(null);
    }
  }

  async function generateBreakdown(material: TaskMaterial) {
    setIsGeneratingBreakdown(true);
    setBusyMaterialId(material.id);
    setError(null);
    setSelectedBreakdownId(material.id);

    try {
      const response = await fetch("/api/ai/material-breakdown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          materialId: material.id,
        }),
      });
      const payload = (await response.json()) as
        | MaterialBreakdownResult
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? payload.error ?? "Gagal membuat breakdown materi."
            : "Gagal membuat breakdown materi.",
        );
      }

      const breakdown = payload as MaterialBreakdownResult;
      setMaterials((current) =>
        current.map((item) =>
          item.id === material.id
            ? {
                ...item,
                ai_breakdown: breakdown,
              }
            : item,
        ),
      );
    } catch (breakdownError) {
      setError(
        getErrorMessage(breakdownError, "Gagal membuat breakdown materi."),
      );
    } finally {
      setIsGeneratingBreakdown(false);
      setBusyMaterialId(null);
    }
  }

  async function generateQuiz(material: TaskMaterial) {
    setIsGeneratingQuiz(true);
    setBusyMaterialId(material.id);
    setError(null);
    setQuizMaterial(material);
    setQuizResult(null);
    setQuizAnswers({});
    setQuizSubmitted(false);

    try {
      const response = await fetch("/api/ai/material-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          materialId: material.id,
          questionCount,
        }),
      });
      const payload = (await response.json()) as
        | MaterialQuizResult
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? payload.error ?? "Gagal membuat quiz materi."
            : "Gagal membuat quiz materi.",
        );
      }

      setQuizResult(payload as MaterialQuizResult);
    } catch (quizError) {
      setError(getErrorMessage(quizError, "Gagal membuat quiz materi."));
      setQuizMaterial(null);
    } finally {
      setIsGeneratingQuiz(false);
      setBusyMaterialId(null);
    }
  }

  async function submitQuiz() {
    if (!quizResult || !quizMaterial) {
      return;
    }

    const answeredCount = quizResult.questions.filter(
      (question) => typeof quizAnswers[question.id] === "number",
    ).length;

    if (answeredCount < quizResult.questions.length) {
      setError("Jawab semua pertanyaan sebelum submit quiz.");
      return;
    }

    setIsSavingAttempt(true);
    setError(null);

    const score = quizResult.questions.reduce((total, question) => {
      return quizAnswers[question.id] === question.correct_answer_index
        ? total + 1
        : total;
    }, 0);
    const correctAnswers = quizResult.questions.map((question) => ({
      question_id: question.id,
      question: question.question,
      correct_answer: question.options[question.correct_answer_index],
    }));

    try {
      const supabase = createSupabaseClient();
      const { error: insertError } = await supabase
        .from("material_quiz_attempts")
        .insert({
          user_id: userId,
          task_id: taskId,
          material_id: quizMaterial.id,
          score,
          total_questions: quizResult.questions.length,
          user_answers: quizAnswers,
          correct_answers: correctAnswers,
        });

      if (insertError) {
        throw insertError;
      }

      setQuizSubmitted(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Gagal menyimpan hasil quiz."));
    } finally {
      setIsSavingAttempt(false);
    }
  }

  if (isLoading) {
    return <MaterialSkeleton />;
  }

  return (
    <article className="rounded-lg border bg-card p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Materi Tugas</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Upload PDF atau dokumen teks untuk dibuat breakdown dan quiz oleh
            AI berdasarkan materi.
          </p>
        </div>
        <button
          onClick={() => void loadMaterials()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh materi
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border bg-background p-4">
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Upload materi</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              className="w-full rounded-md border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-foreground"
            />
            <span className="block text-xs leading-5 text-muted-foreground">
              Format: PDF, TXT, atau Markdown. Maksimal 10 MB.
            </span>
          </label>

          {selectedFile ? (
            <div className="mt-4 rounded-lg border p-3 text-sm">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={isUploading || !selectedFile}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload materi
          </button>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Jumlah soal quiz</span>
              <input
                type="number"
                min={3}
                max={10}
                value={questionCount}
                onChange={(event) =>
                  setQuestionCount(
                    Math.min(Math.max(Number(event.target.value), 3), 10),
                  )
                }
                className="h-10 w-full rounded-md border bg-card px-3 outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        </div>

        <div>
          {sortedMaterials.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 font-medium">Belum ada materi</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload materi tugas agar AI bisa membantu membuat breakdown dan
                quiz.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMaterials.map((material) => (
                <section key={material.id} className="rounded-lg border p-4">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <h3 className="truncate text-sm font-semibold">
                          {material.file_name}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatFileSize(material.file_size)} -{" "}
                        {material.mime_type}
                      </p>
                    </div>
                    <button
                      onClick={() => void deleteMaterial(material)}
                      disabled={busyMaterialId === material.id}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950"
                    >
                      {busyMaterialId === material.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Hapus
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => void generateBreakdown(material)}
                      disabled={isGeneratingBreakdown || isGeneratingQuiz}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isGeneratingBreakdown &&
                      busyMaterialId === material.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                      Breakdown materi
                    </button>
                    <button
                      onClick={() => void generateQuiz(material)}
                      disabled={isGeneratingQuiz || isGeneratingBreakdown}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isGeneratingQuiz && busyMaterialId === material.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileQuestion className="h-4 w-4" />
                      )}
                      Generate quiz
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedBreakdown ? (
        <section className="mt-5 rounded-lg border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">AI Breakdown Materi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Hasil analisis dari materi yang dipilih.
              </p>
            </div>
            <button
              onClick={() => setSelectedBreakdownId(null)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border hover:bg-muted"
              aria-label="Tutup breakdown materi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Summary</h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedBreakdown.summary}
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Key points</h4>
              <ul className="mt-3 space-y-2">
                {selectedBreakdown.key_points.map((point, index) => (
                  <li key={`${point}-${index}`} className="flex gap-2 text-sm">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Konsep utama</h4>
              <div className="mt-3 space-y-3">
                {selectedBreakdown.concepts.map((concept) => (
                  <div key={concept.term} className="rounded-md bg-muted p-3">
                    <p className="text-sm font-semibold">{concept.term}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {concept.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">Suggested checklist</h4>
              <div className="mt-3 space-y-3">
                {selectedBreakdown.suggested_checklist.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {item.estimated_minutes} menit
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {quizMaterial ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card p-4">
              <div>
                <h2 className="font-semibold">Quiz Materi</h2>
                <p className="text-sm text-muted-foreground">
                  {quizMaterial.file_name} - {taskTitle} - {courseName}
                </p>
              </div>
              <button
                onClick={() => {
                  setQuizMaterial(null);
                  setQuizResult(null);
                  setQuizAnswers({});
                  setQuizSubmitted(false);
                }}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-muted"
                aria-label="Tutup quiz materi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              {isGeneratingQuiz ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="mt-3 text-sm font-medium">
                    Membuat quiz dari materi...
                  </p>
                </div>
              ) : null}

              {quizResult ? (
                <>
                  <section className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileQuestion className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{quizResult.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {quizResult.questions.length} soal pilihan ganda.
                    </p>
                  </section>

                  <div className="space-y-4">
                    {quizResult.questions.map((question, questionIndex) => (
                      <section key={question.id} className="rounded-lg border p-4">
                        <p className="text-sm font-semibold leading-6">
                          {questionIndex + 1}. {question.question}
                        </p>
                        <div className="mt-3 grid gap-2">
                          {question.options.map((option, optionIndex) => {
                            const selected =
                              quizAnswers[question.id] === optionIndex;
                            const correct =
                              quizSubmitted &&
                              question.correct_answer_index === optionIndex;
                            const selectedWrong =
                              quizSubmitted && selected && !correct;

                            return (
                              <label
                                key={`${question.id}-${optionIndex}`}
                                className={cn(
                                  "flex items-start gap-3 rounded-md border p-3 text-sm transition",
                                  !quizSubmitted && "hover:bg-muted",
                                  selected && !quizSubmitted && "border-primary",
                                  correct &&
                                    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
                                  selectedWrong &&
                                    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
                                )}
                              >
                                <input
                                  type="radio"
                                  name={question.id}
                                  checked={selected}
                                  disabled={quizSubmitted}
                                  onChange={() =>
                                    setQuizAnswers((current) => ({
                                      ...current,
                                      [question.id]: optionIndex,
                                    }))
                                  }
                                  className="mt-1 h-4 w-4 accent-primary"
                                />
                                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                  <span className="min-w-0 flex-1">{option}</span>
                                  {correct ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                                      Benar
                                    </span>
                                  ) : null}
                                  {selectedWrong ? (
                                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900 dark:text-rose-200">
                                      Pilihan kamu
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>

                  {quizSubmitted ? (
                    <section className="rounded-lg border p-4">
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-md border p-3",
                          quizScoreRatio >= 0.8 &&
                            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
                          quizScoreRatio >= 0.5 &&
                            quizScoreRatio < 0.8 &&
                            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
                          quizScoreRatio < 0.5 &&
                            "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
                        )}
                      >
                        <Trophy className="h-5 w-5 shrink-0" />
                        <h3 className="font-semibold">
                          Skor: {quizScore}/{quizResult.questions.length}
                        </h3>
                      </div>
                      <div className="mt-4 space-y-3">
                        <p className="text-sm font-semibold">Jawaban benar</p>
                        {quizResult.questions.map((question, index) => {
                          const selectedAnswer = quizAnswers[question.id];
                          const isCorrect =
                            selectedAnswer === question.correct_answer_index;

                          return (
                            <div
                              key={question.id}
                              className="rounded-md bg-muted/60 p-3 text-sm"
                            >
                              <p className="font-medium">
                                {index + 1}. {question.question}
                              </p>
                              <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                                <span className="font-semibold">
                                  Jawaban benar:
                                </span>{" "}
                                {
                                  question.options[
                                    question.correct_answer_index
                                  ]
                                }
                              </p>
                              {!isCorrect ? (
                                <p className="mt-1 text-rose-700 dark:text-rose-300">
                                  <span className="font-semibold">
                                    Jawaban kamu:
                                  </span>{" "}
                                  {selectedAnswer === undefined
                                    ? "Belum dijawab"
                                    : question.options[selectedAnswer]}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  setQuizMaterial(null);
                  setQuizResult(null);
                  setQuizAnswers({});
                  setQuizSubmitted(false);
                }}
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
              >
                Tutup
              </button>
              <button
                onClick={() => void submitQuiz()}
                disabled={
                  !quizResult ||
                  quizSubmitted ||
                  isSavingAttempt ||
                  isGeneratingQuiz
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingAttempt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Submit quiz
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
