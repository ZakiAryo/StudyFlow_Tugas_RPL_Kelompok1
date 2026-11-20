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
  Sparkles,
  Zap,
  Play,
  Target,
  ArrowRight,
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

  const closeQuiz = () => {
    setQuizMaterial(null);
    setQuizResult(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary/15 via-card to-violet-500/10 p-6 shadow-sm sm:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Smart quiz mode
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              Jangan cuma baca, <span className="text-primary">tapi pahami!</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Uji pemahaman kamu dari materi kuliah yang sudah di-upload dan lihat seberapa jauh kamu benar-benar menguasainya.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border bg-background/50 px-4 py-3 text-sm font-semibold shadow-sm backdrop-blur">
              <Zap className="h-4 w-4 text-primary" />
              Pilih materi, generate quiz, lalu gas.
            </div>
          </div>

          <div className="relative hidden h-40 w-52 overflow-hidden rounded-[2rem] border bg-background/40 p-5 shadow-xl backdrop-blur sm:block">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-500/20 blur-2xl" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-primary/10 p-2 text-primary"><Target className="h-5 w-5" /></span>
                <span className="text-xs font-black text-muted-foreground">READY?</span>
              </div>
              <div>
                <p className="text-2xl font-black">+ XP</p>
                <p className="mt-1 text-xs text-muted-foreground">Every question counts.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-background/55 p-4 backdrop-blur">
            <p className="text-xs font-semibold text-muted-foreground">Materi tersedia</p>
            <p className="mt-1 text-2xl font-black">{materials.length}</p>
          </div>
          <div className="rounded-2xl border bg-background/55 p-4 backdrop-blur">
            <p className="text-xs font-semibold text-muted-foreground">Quiz selesai</p>
            <p className="mt-1 text-2xl font-black">{totalAttempts}</p>
          </div>
          <div className="rounded-2xl border bg-background/55 p-4 backdrop-blur">
            <p className="text-xs font-semibold text-muted-foreground">Rata-rata skor</p>
            <p className="mt-1 text-2xl font-black text-primary">{averageScore}%</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-300/50 bg-rose-500/5 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:text-rose-300">
          <p>{error}</p>
          <button onClick={() => void loadMaterials()} className="shrink-0 rounded-xl border bg-background px-3 py-2 text-xs font-bold hover:bg-muted/70">Coba lagi</button>
        </div>
      ) : null}

      <section className="rounded-[2rem] border bg-card/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileQuestion className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-black">Quiz tersedia</h2>
                <p className="text-sm text-muted-foreground">Pilih materi yang mau kamu taklukkan.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-xs font-semibold">
              <span>Jumlah soal</span>
              <input
                type="number"
                min={3}
                max={10}
                value={questionCount}
                onChange={(event) => setQuestionCount(Math.min(Math.max(Number(event.target.value), 3), 10))}
                className="w-10 bg-transparent text-center font-black outline-none"
              />
            </label>
            <button onClick={() => void loadMaterials()} className="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold hover:bg-muted/70">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {materials.length === 0 ? (
          <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed bg-background/40 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><FileText className="h-8 w-8" /></div>
            <h3 className="mt-5 text-lg font-black">Belum ada materi quiz</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Upload PDF, TXT, atau Markdown dari halaman detail tugas terlebih dahulu.</p>
            <Link href="/tasks" className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
              Buka tugas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {materials.map((material) => {
              const hasAttempt = Boolean(material.latestAttempt);
              const scorePercent = material.latestAttempt && material.latestAttempt.total_questions > 0
                ? Math.round((material.latestAttempt.score / material.latestAttempt.total_questions) * 100)
                : 0;

              return (
                <article key={material.id} className="group relative flex min-h-72 flex-col overflow-hidden rounded-[1.75rem] border bg-background/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                  <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 text-primary">
                        <FileQuestion className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-black">{material.file_name}</h3>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{formatFileSize(material.file_size)} · {material.mime_type}</p>
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", hasAttempt ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-violet-500/10 text-violet-600 dark:text-violet-300")}>
                      {hasAttempt ? "Selesai" : "New"}
                    </span>
                  </div>

                  <div className="relative mt-5 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mata kuliah</p>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: material.course?.color_label ?? "#64748b" }} />
                      <span className="truncate">{material.course?.name ?? "Mata kuliah"}</span>
                    </div>
                    {material.task ? <Link href={`/tasks/${material.task.id}`} className="block truncate text-xs text-muted-foreground hover:text-primary">{material.task.title}</Link> : <p className="text-xs text-muted-foreground">Tugas tidak ditemukan</p>}
                  </div>

                  <div className="relative mt-5 rounded-2xl border bg-card/60 p-3">
                    {hasAttempt ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-bold"><Trophy className="h-4 w-4 text-primary" /> Skor terakhir</div>
                          <span className="text-lg font-black text-primary">{scorePercent}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${scorePercent}%` }} /></div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Target className="h-4 w-4 text-primary" /> Belum pernah dikerjakan. Siap coba?</div>
                    )}
                  </div>

                  <button onClick={() => void generateQuiz(material)} disabled={isGeneratingQuiz} className="relative mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-primary-foreground shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70">
                    {isGeneratingQuiz && busyMaterialId === material.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                    {hasAttempt ? "Coba lagi" : "Mulai quiz"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {quizMaterial ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border bg-card shadow-2xl">
            <div className="relative shrink-0 overflow-hidden border-b bg-gradient-to-r from-primary/10 via-card to-violet-500/10 p-5 sm:p-6">
              <div className="absolute -right-10 -top-16 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary"><Zap className="h-3 w-3" /> Quiz mode</div>
                  <h2 className="truncate text-xl font-black sm:text-2xl">{quizResult?.title ?? "Menyiapkan quiz..."}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{quizMaterial.file_name}</p>
                </div>
                <button onClick={closeQuiz} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-background/60 hover:bg-muted" aria-label="Tutup quiz"><X className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {isGeneratingQuiz ? (
                <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed bg-background/40 p-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><Loader2 className="h-7 w-7 animate-spin" /></div>
                  <p className="mt-5 text-lg font-black">Membuat quiz...</p>
                  <p className="mt-2 text-sm text-muted-foreground">StudyFlow sedang menyusun pertanyaan dari materi kamu.</p>
                </div>
              ) : null}

              {quizResult ? (
                <div className="space-y-5">
                  <section className="rounded-3xl border bg-background/50 p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Progress</p><p className="mt-1 font-black">{quizResult.questions.length} soal pilihan ganda</p></div>
                      <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-black text-primary">{Object.keys(quizAnswers).length}/{quizResult.questions.length} dijawab</div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((Object.keys(quizAnswers).length / Math.max(quizResult.questions.length, 1)) * 100)}%` }} /></div>
                  </section>

                  <div className="space-y-4">
                    {quizResult.questions.map((question, questionIndex) => (
                      <section key={question.id} className="rounded-[1.5rem] border bg-background/50 p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{questionIndex + 1}</span>
                          <p className="pt-1 text-sm font-bold leading-6 sm:text-base">{question.question}</p>
                        </div>
                        <div className="mt-4 grid gap-2.5">
                          {question.options.map((option, optionIndex) => {
                            const selected = quizAnswers[question.id] === optionIndex;
                            const correct = quizSubmitted && question.correct_answer_index === optionIndex;
                            const selectedWrong = quizSubmitted && selected && !correct;
                            return (
                              <label key={`${question.id}-${optionIndex}`} className={cn("group flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition-all", !quizSubmitted && "hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5", selected && !quizSubmitted && "border-primary bg-primary/5 ring-2 ring-primary/10", correct && "border-emerald-300 bg-emerald-500/10 text-emerald-800 dark:border-emerald-900 dark:text-emerald-200", selectedWrong && "border-rose-300 bg-rose-500/10 text-rose-800 dark:border-rose-900 dark:text-rose-200")}>
                                <input type="radio" name={question.id} checked={selected} disabled={quizSubmitted} onChange={() => setQuizAnswers((current) => ({ ...current, [question.id]: optionIndex }))} className="mt-1 h-4 w-4 accent-primary" />
                                <span className="flex min-w-0 flex-1 items-center justify-between gap-3"><span className="min-w-0">{option}</span>{correct ? <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-600 dark:text-emerald-300">BENAR</span> : null}{selectedWrong ? <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-600 dark:text-rose-300">PILIHAN KAMU</span> : null}</span>
                              </label>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>

                  {quizSubmitted ? (
                    <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary/10 via-card to-violet-500/10 p-5 sm:p-6">
                      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
                      <div className="relative flex flex-col items-center text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><Trophy className="h-8 w-8" /></div>
                        <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-primary">Quiz selesai!</p>
                        <h3 className="mt-2 text-4xl font-black">{Math.round(quizScoreRatio * 100)}%</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{quizScore} dari {quizResult.questions.length} jawaban benar</p>
                      </div>
                      <div className="relative mt-6 space-y-3">
                        {quizResult.questions.map((question, index) => {
                          const selectedAnswer = quizAnswers[question.id];
                          const isCorrect = selectedAnswer === question.correct_answer_index;
                          return (
                            <div key={question.id} className="rounded-2xl border bg-background/60 p-4 text-sm">
                              <div className="flex items-start gap-3"><span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black", isCorrect ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>{index + 1}</span><p className="font-semibold leading-5">{question.question}</p></div>
                              <p className="mt-3 text-emerald-700 dark:text-emerald-300"><span className="font-bold">Jawaban benar:</span> {question.options[question.correct_answer_index]}</p>
                              {!isCorrect ? <p className="mt-1 text-rose-700 dark:text-rose-300"><span className="font-bold">Jawaban kamu:</span> {selectedAnswer === undefined ? "Belum dijawab" : question.options[selectedAnswer]}</p> : null}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t bg-card/95 p-4 backdrop-blur sm:p-5">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button onClick={closeQuiz} className="inline-flex h-11 items-center justify-center rounded-2xl border px-5 text-sm font-bold hover:bg-muted/70">Tutup</button>
                <button onClick={() => void submitQuiz()} disabled={!quizResult || quizSubmitted || isSavingAttempt || isGeneratingQuiz} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSavingAttempt ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Submit quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
