"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileQuestion,
  FileText,
  Loader2,
  RefreshCw,
  Trophy,
  X,
} from "lucide-react";

import { createSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type TaskMaterial = {
  id: string;
  user_id: string;
  task_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

type TaskInfo = {
  id: string;
  title: string;
  course_id: string;
  deadline: string;
  status: string;
  progress: number;
};

type CourseInfo = {
  id: string;
  name: string;
  color_label: string;
};

type QuizAttempt = {
  id: string;
  material_id: string;
  score: number;
  total_questions: number;
  created_at: string;
};

type QuizMaterial = TaskMaterial & {
  task: TaskInfo | null;
  course: CourseInfo | null;
  latestAttempt: QuizAttempt | null;
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

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function QuizSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-56 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function QuizManager() {
  const router = useRouter();
  const [materials, setMaterials] = useState<QuizMaterial[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [quizMaterial, setQuizMaterial] = useState<QuizMaterial | null>(null);
  const [quizResult, setQuizResult] = useState<MaterialQuizResult | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [busyMaterialId, setBusyMaterialId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalAttempts = useMemo(
    () => materials.filter((material) => material.latestAttempt).length,
    [materials],
  );

  const averageScore = useMemo(() => {
    const attempts = materials
      .map((material) => material.latestAttempt)
      .filter((attempt): attempt is QuizAttempt => Boolean(attempt));

    if (attempts.length === 0) {
      return 0;
    }

    const total = attempts.reduce(
      (sum, attempt) => sum + attempt.score / attempt.total_questions,
      0,
    );

    return Math.round((total / attempts.length) * 100);
  }, [materials]);

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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data: materialData, error: materialError } = await supabase
        .from("task_materials")
        .select("id,user_id,task_id,file_name,mime_type,file_size,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (materialError) {
        throw materialError;
      }

      const loadedMaterials = (materialData ?? []) as TaskMaterial[];

      if (loadedMaterials.length === 0) {
        setMaterials([]);
        return;
      }

      const taskIds = [...new Set(loadedMaterials.map((item) => item.task_id))];
      const [tasksResult, attemptsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,course_id,deadline,status,progress")
          .eq("user_id", user.id)
          .in("id", taskIds),
        supabase
          .from("material_quiz_attempts")
          .select("id,material_id,score,total_questions,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (attemptsResult.error) {
        throw attemptsResult.error;
      }

      const tasks = (tasksResult.data ?? []) as TaskInfo[];
      const courseIds = [...new Set(tasks.map((task) => task.course_id))];
      let courses: CourseInfo[] = [];

      if (courseIds.length > 0) {
        const { data: courseData, error: courseError } = await supabase
          .from("courses")
          .select("id,name,color_label")
          .eq("user_id", user.id)
          .in("id", courseIds);

        if (courseError) {
          throw courseError;
        }

        courses = (courseData ?? []) as CourseInfo[];
      }

      const taskById = new Map(tasks.map((task) => [task.id, task]));
      const courseById = new Map(courses.map((course) => [course.id, course]));
      const latestAttemptByMaterialId = new Map<string, QuizAttempt>();

      ((attemptsResult.data ?? []) as QuizAttempt[]).forEach((attempt) => {
        if (!latestAttemptByMaterialId.has(attempt.material_id)) {
          latestAttemptByMaterialId.set(attempt.material_id, attempt);
        }
      });

      setMaterials(
        loadedMaterials.map((material) => {
          const task = taskById.get(material.task_id) ?? null;

          return {
            ...material,
            task,
            course: task ? courseById.get(task.course_id) ?? null : null,
            latestAttempt:
              latestAttemptByMaterialId.get(material.id) ?? null,
          };
        }),
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Gagal memuat daftar quiz."));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  async function generateQuiz(material: QuizMaterial) {
    if (!material.task) {
      setError("Tugas untuk materi ini tidak ditemukan.");
      return;
    }

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
          taskId: material.task_id,
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
    if (!quizResult || !quizMaterial || !userId) {
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
      const { data, error: insertError } = await supabase
        .from("material_quiz_attempts")
        .insert({
          user_id: userId,
          task_id: quizMaterial.task_id,
          material_id: quizMaterial.id,
          score,
          total_questions: quizResult.questions.length,
          user_answers: quizAnswers,
          correct_answers: correctAnswers,
        })
        .select("id,material_id,score,total_questions,created_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setQuizSubmitted(true);
      setMaterials((current) =>
        current.map((material) =>
          material.id === quizMaterial.id
            ? {
                ...material,
                latestAttempt: data as QuizAttempt,
              }
            : material,
        ),
      );
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Gagal menyimpan hasil quiz."));
    } finally {
      setIsSavingAttempt(false);
    }
  }

  if (isLoading) {
    return <QuizSkeleton />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-lg border bg-card p-5 shadow-soft lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Latihan mandiri</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Quiz</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Generate quiz dari materi tugas yang sudah kamu upload. Setelah
            submit, StudyFlow menampilkan skor dan jawaban benar.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">Materi</p>
            <p className="mt-1 text-2xl font-semibold">{materials.length}</p>
          </div>
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">Pernah dikerjakan</p>
            <p className="mt-1 text-2xl font-semibold">{totalAttempts}</p>
          </div>
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs text-muted-foreground">Rata-rata</p>
            <p className="mt-1 text-2xl font-semibold">{averageScore}%</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Materi tersedia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pilih materi untuk membuat quiz baru.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <span className="font-medium">Jumlah soal</span>
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
                className="h-9 w-20 rounded-md border bg-background px-2 outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <button
              onClick={() => void loadMaterials()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {materials.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed p-8 text-center">
            <FileText className="mx-auto h-7 w-7 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">Belum ada materi quiz</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Upload PDF, TXT, atau Markdown dari halaman detail tugas terlebih
              dahulu. Setelah itu materi akan muncul di menu Quiz.
            </p>
            <Link
              href="/tasks"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Buka tugas
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {materials.map((material) => (
              <article
                key={material.id}
                className="flex min-h-64 flex-col rounded-lg border bg-background p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FileQuestion className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">
                      {material.file_name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFileSize(material.file_size)} - {material.mime_type}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Tugas</p>
                    {material.task ? (
                      <Link
                        href={`/tasks/${material.task.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {material.task.title}
                      </Link>
                    ) : (
                      <p className="font-medium">Tugas tidak ditemukan</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          material.course?.color_label ?? "#64748b",
                      }}
                    />
                    <span className="text-muted-foreground">
                      {material.course?.name ?? "Mata kuliah"}
                    </span>
                  </div>
                </div>

                {material.latestAttempt ? (
                  <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <Trophy className="h-4 w-4" />
                      Skor terakhir: {material.latestAttempt.score}/
                      {material.latestAttempt.total_questions}
                    </div>
                    <p className="mt-1 text-xs">
                      {formatDateTime(material.latestAttempt.created_at)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Belum pernah dikerjakan.
                  </div>
                )}

                <button
                  onClick={() => void generateQuiz(material)}
                  disabled={isGeneratingQuiz}
                  className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isGeneratingQuiz && busyMaterialId === material.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileQuestion className="h-4 w-4" />
                  )}
                  Mulai quiz
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {quizMaterial ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card p-4">
              <div>
                <h2 className="font-semibold">Quiz Materi</h2>
                <p className="text-sm text-muted-foreground">
                  {quizMaterial.file_name}
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
                aria-label="Tutup quiz"
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
                    <div className="flex items-center gap-2">
                      <FileQuestion className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{quizResult.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {quizResult.questions.length} soal pilihan ganda.
                    </p>
                  </section>

                  <div className="space-y-4">
                    {quizResult.questions.map((question, questionIndex) => (
                      <section
                        key={question.id}
                        className="rounded-lg border p-4"
                      >
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
    </div>
  );
}
