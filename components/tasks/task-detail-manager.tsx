"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { DeadlineBadge } from "@/components/tasks/deadline-badge";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { TaskMaterialsManager } from "@/components/tasks/task-materials-manager";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getDeadlineLabel, getDeadlineState } from "@/lib/deadline";
import { createSupabaseClient } from "@/lib/supabase";
import { clamp, cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high" | "urgent";
type TaskStatus = "not_started" | "in_progress" | "revision" | "completed";

type CourseInfo = {
  id: string;
  name: string;
  color_label: string;
};

type Task = {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  description: string | null;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  created_at: string;
  updated_at: string;
};

type ChecklistItem = {
  id: string;
  user_id: string;
  task_id: string;
  item_text: string;
  is_done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

type TaskNote = {
  id: string;
  user_id: string;
  task_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type ScheduleSession = {
  id: string;
  user_id: string;
  course_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
  updated_at: string;
};

type AiChecklistPriority = "low" | "medium" | "high";

type AiChecklistItem = {
  title: string;
  estimated_minutes: number;
  priority: AiChecklistPriority;
};

type AiBreakdownResult = {
  summary: string;
  checklist: AiChecklistItem[];
};

type StudyPlanRisk = "low" | "medium" | "high";

type AiStudyPlanItem = {
  date: string;
  time_block: string;
  action: string;
  estimated_minutes: number;
};

type AiStudyPlanResult = {
  summary: string;
  plan: AiStudyPlanItem[];
  risk_level: StudyPlanRisk;
  suggestion: string;
};

type AiNotesSummaryResult = {
  summary: string;
  important_points: string[];
  suggested_next_actions: string[];
};

type StudyPlan = {
  id: string;
  user_id: string;
  task_id: string;
  title: string;
  summary: string | null;
  risk_level: StudyPlanRisk;
  suggestion: string | null;
  created_at: string;
};

type StudyPlanItem = {
  id: string;
  user_id: string;
  study_plan_id: string;
  date: string;
  time_block: string;
  action: string;
  estimated_minutes: number;
  is_done: boolean;
  position: number;
  created_at: string;
};

type StudyPlanWithItems = StudyPlan & {
  items: StudyPlanItem[];
};

type AiErrorResponse = {
  error?: string;
  code?: string;
};

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "revision", label: "Revision" },
  { value: "completed", label: "Completed" },
];

const dayLabels: Record<string, string> = {
  monday: "Senin",
  tuesday: "Selasa",
  wednesday: "Rabu",
  thursday: "Kamis",
  friday: "Jumat",
  saturday: "Sabtu",
  sunday: "Minggu",
};

const dayOrder = new Map(Object.keys(dayLabels).map((day, index) => [day, index]));

const riskStyles: Record<StudyPlanRisk, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  medium:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
};

function sortChecklist(a: ChecklistItem, b: ChecklistItem) {
  const positionDiff = a.position - b.position;

  if (positionDiff !== 0) {
    return positionDiff;
  }

  return a.created_at.localeCompare(b.created_at);
}

function sortNotes(a: TaskNote, b: TaskNote) {
  return b.updated_at.localeCompare(a.updated_at);
}

function sortScheduleSessions(a: ScheduleSession, b: ScheduleSession) {
  const dayDiff =
    (dayOrder.get(a.day_of_week) ?? 99) - (dayOrder.get(b.day_of_week) ?? 99);

  if (dayDiff !== 0) {
    return dayDiff;
  }

  return a.start_time.localeCompare(b.start_time);
}

function sortStudyPlanItems(a: StudyPlanItem, b: StudyPlanItem) {
  const dateDiff = a.date.localeCompare(b.date);

  if (dateDiff !== 0) {
    return dateDiff;
  }

  const positionDiff = a.position - b.position;

  if (positionDiff !== 0) {
    return positionDiff;
  }

  return a.created_at.localeCompare(b.created_at);
}

function sortStudyPlans(a: StudyPlanWithItems, b: StudyPlanWithItems) {
  return b.created_at.localeCompare(a.created_at);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function RiskBadge({ riskLevel }: { riskLevel: StudyPlanRisk }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-semibold capitalize",
        riskStyles[riskLevel],
      )}
    >
      {riskLevel} risk
    </span>
  );
}

export function TaskDetailManager({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [courseSchedule, setCourseSchedule] = useState<ScheduleSession[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlanWithItems[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<TaskStatus>("not_started");
  const [progressDraft, setProgressDraft] = useState(0);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [busyChecklistId, setBusyChecklistId] = useState<string | null>(null);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiBreakdownResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGeneratingBreakdown, setIsGeneratingBreakdown] = useState(false);
  const [isSavingAiChecklist, setIsSavingAiChecklist] = useState(false);
  const [aiStudyPlanResult, setAiStudyPlanResult] =
    useState<AiStudyPlanResult | null>(null);
  const [aiStudyPlanError, setAiStudyPlanError] = useState<string | null>(null);
  const [isStudyPlanModalOpen, setIsStudyPlanModalOpen] = useState(false);
  const [isGeneratingStudyPlan, setIsGeneratingStudyPlan] = useState(false);
  const [isSavingStudyPlan, setIsSavingStudyPlan] = useState(false);
  const [busyStudyPlanItemId, setBusyStudyPlanItemId] = useState<string | null>(
    null,
  );
  const [aiNotesSummaryResult, setAiNotesSummaryResult] =
    useState<AiNotesSummaryResult | null>(null);
  const [aiNotesSummaryError, setAiNotesSummaryError] = useState<string | null>(
    null,
  );
  const [isNotesSummaryModalOpen, setIsNotesSummaryModalOpen] = useState(false);
  const [isSummarizingNotes, setIsSummarizingNotes] = useState(false);

  const sortedChecklists = useMemo(
    () => [...checklists].sort(sortChecklist),
    [checklists],
  );

  const sortedNotes = useMemo(() => [...notes].sort(sortNotes), [notes]);

  const sortedStudyPlans = useMemo(
    () =>
      studyPlans
        .map((plan) => ({
          ...plan,
          items: [...plan.items].sort(sortStudyPlanItems),
        }))
        .sort(sortStudyPlans),
    [studyPlans],
  );

  const completedChecklistCount = sortedChecklists.filter(
    (item) => item.is_done,
  ).length;

  const totalStudyPlanItemCount = sortedStudyPlans.reduce(
    (total, plan) => total + plan.items.length,
    0,
  );

  const completedStudyPlanItemCount = sortedStudyPlans.reduce(
    (total, plan) =>
      total + plan.items.filter((item) => item.is_done).length,
    0,
  );

  const studyPlanProgress =
    totalStudyPlanItemCount > 0
      ? Math.round((completedStudyPlanItemCount / totalStudyPlanItemCount) * 100)
      : 0;

  const checklistProgress =
    sortedChecklists.length > 0
      ? Math.round((completedChecklistCount / sortedChecklists.length) * 100)
      : 0;

  const allChecklistDone =
    sortedChecklists.length > 0 &&
    completedChecklistCount === sortedChecklists.length;

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);

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

      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select(
          "id,user_id,course_id,title,description,deadline,priority,status,progress,created_at,updated_at",
        )
        .eq("id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (taskError) {
        throw taskError;
      }

      if (!taskData) {
        setTask(null);
        setCourse(null);
        setChecklists([]);
        setNotes([]);
        setCourseSchedule([]);
        setStudyPlans([]);
        setNotFound(true);
        return;
      }

      const loadedTask = taskData as Task;

      const [
        courseResult,
        checklistResult,
        notesResult,
        scheduleResult,
        studyPlansResult,
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("id,name,color_label")
          .eq("id", loadedTask.course_id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("task_checklists")
          .select(
            "id,user_id,task_id,item_text,is_done,position,created_at,updated_at",
          )
          .eq("task_id", loadedTask.id)
          .eq("user_id", user.id)
          .order("position", { ascending: true }),
        supabase
          .from("task_notes")
          .select("id,user_id,task_id,content,created_at,updated_at")
          .eq("task_id", loadedTask.id)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("schedule_sessions")
          .select(
            "id,user_id,course_id,day_of_week,start_time,end_time,room,created_at,updated_at",
          )
          .eq("course_id", loadedTask.course_id)
          .eq("user_id", user.id)
          .order("start_time", { ascending: true }),
        supabase
          .from("study_plans")
          .select(
            "id,user_id,task_id,title,summary,risk_level,suggestion,created_at",
          )
          .eq("task_id", loadedTask.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (courseResult.error) {
        throw courseResult.error;
      }

      if (checklistResult.error) {
        throw checklistResult.error;
      }

      if (notesResult.error) {
        throw notesResult.error;
      }

      if (scheduleResult.error) {
        throw scheduleResult.error;
      }

      if (studyPlansResult.error) {
        throw studyPlansResult.error;
      }

      const loadedStudyPlans = (studyPlansResult.data ?? []) as StudyPlan[];
      let loadedStudyPlanItems: StudyPlanItem[] = [];

      if (loadedStudyPlans.length > 0) {
        const { data: studyPlanItemsData, error: studyPlanItemsError } =
          await supabase
            .from("study_plan_items")
            .select(
              "id,user_id,study_plan_id,date,time_block,action,estimated_minutes,is_done,position,created_at",
            )
            .in(
              "study_plan_id",
              loadedStudyPlans.map((plan) => plan.id),
            )
            .eq("user_id", user.id)
            .order("date", { ascending: true })
            .order("position", { ascending: true });

        if (studyPlanItemsError) {
          throw studyPlanItemsError;
        }

        loadedStudyPlanItems = (studyPlanItemsData ?? []) as StudyPlanItem[];
      }

      const loadedStudyPlansWithItems = loadedStudyPlans
        .map((plan) => ({
          ...plan,
          items: loadedStudyPlanItems
            .filter((item) => item.study_plan_id === plan.id)
            .sort(sortStudyPlanItems),
        }))
        .sort(sortStudyPlans);

      setTask(loadedTask);
      setCourse((courseResult.data as CourseInfo | null) ?? null);
      setStatusDraft(loadedTask.status);
      setProgressDraft(loadedTask.progress);
      setChecklists(((checklistResult.data ?? []) as ChecklistItem[]).sort(sortChecklist));
      setNotes(((notesResult.data ?? []) as TaskNote[]).sort(sortNotes));
      setCourseSchedule(
        ((scheduleResult.data ?? []) as ScheduleSession[]).sort(
          sortScheduleSessions,
        ),
      );
      setStudyPlans(loadedStudyPlansWithItems);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat detail tugas.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [router, taskId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function updateTaskMeta(nextStatus = statusDraft, nextProgress = progressDraft) {
    if (!task || !userId) {
      setError("Session tidak ditemukan. Silakan login ulang.");
      router.replace("/login");
      return;
    }

    const progress = clamp(Number(nextProgress), 0, 100);

    setIsSavingTask(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: updateError } = await supabase
        .from("tasks")
        .update({
          status: nextStatus,
          progress,
        })
        .eq("id", task.id)
        .eq("user_id", userId)
        .select(
          "id,user_id,course_id,title,description,deadline,priority,status,progress,created_at,updated_at",
        )
        .single();

      if (updateError) {
        throw updateError;
      }

      const updatedTask = data as Task;
      setTask(updatedTask);
      setStatusDraft(updatedTask.status);
      setProgressDraft(updatedTask.progress);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Gagal memperbarui status tugas.",
      );
    } finally {
      setIsSavingTask(false);
    }
  }

  async function addChecklistItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!task || !userId) {
      return;
    }

    const itemText = newChecklistText.trim();

    if (!itemText) {
      setError("Checklist tidak boleh kosong.");
      return;
    }

    const nextPosition =
      sortedChecklists.length > 0
        ? Math.max(...sortedChecklists.map((item) => item.position)) + 1
        : 0;

    setIsAddingChecklist(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: insertError } = await supabase
        .from("task_checklists")
        .insert({
          user_id: userId,
          task_id: task.id,
          item_text: itemText,
          is_done: false,
          position: nextPosition,
        })
        .select("id,user_id,task_id,item_text,is_done,position,created_at,updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setChecklists((current) =>
        [...current, data as ChecklistItem].sort(sortChecklist),
      );
      setNewChecklistText("");
    } catch (insertError) {
      setError(
        insertError instanceof Error
          ? insertError.message
          : "Gagal menambahkan checklist.",
      );
    } finally {
      setIsAddingChecklist(false);
    }
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    setBusyChecklistId(item.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: updateError } = await supabase
        .from("task_checklists")
        .update({ is_done: !item.is_done })
        .eq("id", item.id)
        .eq("user_id", item.user_id)
        .eq("task_id", item.task_id)
        .select("id,user_id,task_id,item_text,is_done,position,created_at,updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setChecklists((current) =>
        current
          .map((checklistItem) =>
            checklistItem.id === item.id ? (data as ChecklistItem) : checklistItem,
          )
          .sort(sortChecklist),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Gagal memperbarui checklist.",
      );
    } finally {
      setBusyChecklistId(null);
    }
  }

  async function deleteChecklistItem(item: ChecklistItem) {
    const confirmed = window.confirm(`Hapus checklist "${item.item_text}"?`);

    if (!confirmed) {
      return;
    }

    setBusyChecklistId(item.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("task_checklists")
        .delete()
        .eq("id", item.id)
        .eq("user_id", item.user_id)
        .eq("task_id", item.task_id);

      if (deleteError) {
        throw deleteError;
      }

      setChecklists((current) =>
        current.filter((checklistItem) => checklistItem.id !== item.id),
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus checklist.",
      );
    } finally {
      setBusyChecklistId(null);
    }
  }

  async function moveChecklistItem(item: ChecklistItem, direction: -1 | 1) {
    const currentIndex = sortedChecklists.findIndex(
      (checklistItem) => checklistItem.id === item.id,
    );
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedChecklists.length) {
      return;
    }

    const reordered = [...sortedChecklists];
    const [movedItem] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movedItem);
    const normalized = reordered.map((checklistItem, index) => ({
      ...checklistItem,
      position: index,
    }));

    setBusyChecklistId(item.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const updates = await Promise.all(
        normalized.map((checklistItem) =>
          supabase
            .from("task_checklists")
            .update({ position: checklistItem.position })
            .eq("id", checklistItem.id)
            .eq("user_id", checklistItem.user_id)
            .eq("task_id", checklistItem.task_id),
        ),
      );

      const failedUpdate = updates.find((result) => result.error);

      if (failedUpdate?.error) {
        throw failedUpdate.error;
      }

      setChecklists(normalized);
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Gagal mengurutkan checklist.",
      );
    } finally {
      setBusyChecklistId(null);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!task || !userId) {
      return;
    }

    const content = newNoteContent.trim();

    if (!content) {
      setError("Notes tidak boleh kosong.");
      return;
    }

    setIsAddingNote(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: insertError } = await supabase
        .from("task_notes")
        .insert({
          user_id: userId,
          task_id: task.id,
          content,
        })
        .select("id,user_id,task_id,content,created_at,updated_at")
        .single();

      if (insertError) {
        throw insertError;
      }

      setNotes((current) => [data as TaskNote, ...current].sort(sortNotes));
      setNewNoteContent("");
    } catch (insertError) {
      setError(
        insertError instanceof Error
          ? insertError.message
          : "Gagal menambahkan notes.",
      );
    } finally {
      setIsAddingNote(false);
    }
  }

  function startEditNote(note: TaskNote) {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setEditingNoteContent("");
  }

  async function saveNote(note: TaskNote) {
    const content = editingNoteContent.trim();

    if (!content) {
      setError("Notes tidak boleh kosong.");
      return;
    }

    setBusyNoteId(note.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: updateError } = await supabase
        .from("task_notes")
        .update({ content })
        .eq("id", note.id)
        .eq("user_id", note.user_id)
        .eq("task_id", note.task_id)
        .select("id,user_id,task_id,content,created_at,updated_at")
        .single();

      if (updateError) {
        throw updateError;
      }

      setNotes((current) =>
        current
          .map((currentNote) =>
            currentNote.id === note.id ? (data as TaskNote) : currentNote,
          )
          .sort(sortNotes),
      );
      cancelEditNote();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Gagal menyimpan notes.",
      );
    } finally {
      setBusyNoteId(null);
    }
  }

  async function deleteNote(note: TaskNote) {
    const confirmed = window.confirm("Hapus notes ini?");

    if (!confirmed) {
      return;
    }

    setBusyNoteId(note.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("task_notes")
        .delete()
        .eq("id", note.id)
        .eq("user_id", note.user_id)
        .eq("task_id", note.task_id);

      if (deleteError) {
        throw deleteError;
      }

      setNotes((current) => current.filter((item) => item.id !== note.id));

      if (editingNoteId === note.id) {
        cancelEditNote();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Gagal menghapus notes.",
      );
    } finally {
      setBusyNoteId(null);
    }
  }

  async function handleBreakdownWithAi() {
    if (!task) {
      return;
    }

    const title = task.title.trim();
    const description = task.description?.trim() ?? "";

    setIsAiModalOpen(true);
    setIsStudyPlanModalOpen(false);
    setIsNotesSummaryModalOpen(false);
    setAiResult(null);
    setAiError(null);

    if (!title) {
      setAiError("Judul tugas tidak boleh kosong.");
      return;
    }

    if (!description) {
      setAiError(
        "Deskripsi tugas tidak boleh kosong. Tambahkan deskripsi dulu agar AI bisa membuat breakdown yang relevan.",
      );
      return;
    }

    setIsGeneratingBreakdown(true);

    try {
      const response = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          courseName: course?.name ?? "",
          deadline: task.deadline,
          priority: task.priority,
          status: task.status,
          progress: task.progress,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (Partial<AiBreakdownResult> & AiErrorResponse)
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Gagal membuat breakdown tugas dengan AI.",
        );
      }

      if (
        !payload ||
        typeof payload.summary !== "string" ||
        !Array.isArray(payload.checklist)
      ) {
        throw new Error("Response AI tidak sesuai format yang dibutuhkan.");
      }

      setAiResult({
        summary: payload.summary,
        checklist: payload.checklist,
      });
    } catch (breakdownError) {
      setAiError(
        breakdownError instanceof Error
          ? breakdownError.message
          : "Gagal membuat breakdown tugas dengan AI.",
      );
    } finally {
      setIsGeneratingBreakdown(false);
    }
  }

  async function saveAiChecklist() {
    if (!task || !userId || !aiResult) {
      return;
    }

    const generatedItems = aiResult.checklist.filter((item) =>
      item.title.trim(),
    );

    if (generatedItems.length === 0) {
      setAiError("Tidak ada checklist dari AI yang bisa disimpan.");
      return;
    }

    const nextPosition =
      sortedChecklists.length > 0
        ? Math.max(...sortedChecklists.map((item) => item.position)) + 1
        : 0;

    setIsSavingAiChecklist(true);
    setAiError(null);

    try {
      const supabase = createSupabaseClient();

      const { error: suggestionError } = await supabase
        .from("ai_suggestions")
        .insert({
          user_id: userId,
          task_id: task.id,
          type: "task_breakdown",
          prompt: JSON.stringify({
            title: task.title,
            description: task.description,
            course_name: course?.name ?? null,
            deadline: task.deadline,
            priority: task.priority,
            status: task.status,
            progress: task.progress,
          }),
          response: aiResult,
        });

      if (suggestionError) {
        throw suggestionError;
      }

      const { data, error: checklistError } = await supabase
        .from("task_checklists")
        .insert(
          generatedItems.map((item, index) => ({
            user_id: userId,
            task_id: task.id,
            item_text: item.title.trim(),
            is_done: false,
            position: nextPosition + index,
          })),
        )
        .select(
          "id,user_id,task_id,item_text,is_done,position,created_at,updated_at",
        );

      if (checklistError) {
        throw checklistError;
      }

      setChecklists((current) =>
        [...current, ...((data ?? []) as ChecklistItem[])].sort(sortChecklist),
      );
      setIsAiModalOpen(false);
      setAiResult(null);
      setAiError(null);
    } catch (saveError) {
      setAiError(
        saveError instanceof Error
          ? saveError.message
          : "Gagal menyimpan checklist dari AI.",
      );
    } finally {
      setIsSavingAiChecklist(false);
    }
  }

  async function handleGenerateStudyPlan() {
    if (!task) {
      return;
    }

    setIsStudyPlanModalOpen(true);
    setIsAiModalOpen(false);
    setIsNotesSummaryModalOpen(false);
    setAiStudyPlanResult(null);
    setAiStudyPlanError(null);

    if (!task.deadline) {
      setAiStudyPlanError("Tugas harus memiliki deadline untuk membuat AI Study Plan.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(`${task.deadline}T00:00:00`);

    if (deadlineDate < today) {
      setAiStudyPlanError(
        "Deadline tugas sudah lewat. AI Study Plan hanya bisa dibuat untuk deadline yang belum lewat.",
      );
      return;
    }

    setIsGeneratingStudyPlan(true);

    try {
      const response = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: task.title.trim(),
          description: task.description?.trim() ?? "",
          courseName: course?.name ?? "",
          deadline: task.deadline,
          priority: task.priority,
          status: task.status,
          progress: task.progress,
          checklist: sortedChecklists.map((item) => ({
            text: item.item_text,
            is_done: item.is_done,
            position: item.position,
          })),
          schedule: courseSchedule.map((session) => ({
            day_of_week: dayLabels[session.day_of_week] ?? session.day_of_week,
            start_time: formatTime(session.start_time),
            end_time: formatTime(session.end_time),
            room: session.room ?? "",
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (Partial<AiStudyPlanResult> & AiErrorResponse)
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Gagal membuat study plan dengan AI.",
        );
      }

      if (
        !payload ||
        typeof payload.summary !== "string" ||
        !Array.isArray(payload.plan) ||
        typeof payload.risk_level !== "string" ||
        typeof payload.suggestion !== "string"
      ) {
        throw new Error("Response AI tidak sesuai format study plan.");
      }

      setAiStudyPlanResult({
        summary: payload.summary,
        plan: payload.plan,
        risk_level: payload.risk_level as StudyPlanRisk,
        suggestion: payload.suggestion,
      });
    } catch (studyPlanError) {
      setAiStudyPlanError(
        studyPlanError instanceof Error
          ? studyPlanError.message
          : "Gagal membuat study plan dengan AI.",
      );
    } finally {
      setIsGeneratingStudyPlan(false);
    }
  }

  async function saveAiStudyPlan() {
    if (!task || !userId || !aiStudyPlanResult) {
      return;
    }

    const generatedItems = aiStudyPlanResult.plan.filter((item) =>
      item.action.trim(),
    );

    if (generatedItems.length === 0) {
      setAiStudyPlanError("Tidak ada item study plan yang bisa disimpan.");
      return;
    }

    setIsSavingStudyPlan(true);
    setAiStudyPlanError(null);

    try {
      const supabase = createSupabaseClient();
      const promptPayload = {
        title: task.title,
        description: task.description,
        course_name: course?.name ?? null,
        deadline: task.deadline,
        priority: task.priority,
        status: task.status,
        progress: task.progress,
        checklist: sortedChecklists.map((item) => ({
          text: item.item_text,
          is_done: item.is_done,
          position: item.position,
        })),
        schedule: courseSchedule.map((session) => ({
          day_of_week: dayLabels[session.day_of_week] ?? session.day_of_week,
          start_time: formatTime(session.start_time),
          end_time: formatTime(session.end_time),
          room: session.room ?? null,
        })),
      };

      const { error: suggestionError } = await supabase
        .from("ai_suggestions")
        .insert({
          user_id: userId,
          task_id: task.id,
          type: "study_plan",
          prompt: JSON.stringify(promptPayload),
          response: aiStudyPlanResult,
        });

      if (suggestionError) {
        throw suggestionError;
      }

      const { data: studyPlanData, error: studyPlanError } = await supabase
        .from("study_plans")
        .insert({
          user_id: userId,
          task_id: task.id,
          title: `AI Study Plan - ${task.title}`,
          summary: aiStudyPlanResult.summary,
          risk_level: aiStudyPlanResult.risk_level,
          suggestion: aiStudyPlanResult.suggestion,
        })
        .select("id,user_id,task_id,title,summary,risk_level,suggestion,created_at")
        .single();

      if (studyPlanError) {
        throw studyPlanError;
      }

      const savedPlan = studyPlanData as StudyPlan;

      const { data: itemData, error: itemError } = await supabase
        .from("study_plan_items")
        .insert(
          generatedItems.map((item, index) => ({
            user_id: userId,
            study_plan_id: savedPlan.id,
            date: item.date,
            time_block: item.time_block,
            action: item.action,
            estimated_minutes: item.estimated_minutes,
            is_done: false,
            position: index,
          })),
        )
        .select(
          "id,user_id,study_plan_id,date,time_block,action,estimated_minutes,is_done,position,created_at",
        );

      if (itemError) {
        throw itemError;
      }

      const savedItems = ((itemData ?? []) as StudyPlanItem[]).sort(
        sortStudyPlanItems,
      );

      setStudyPlans((current) =>
        [{ ...savedPlan, items: savedItems }, ...current].sort(sortStudyPlans),
      );
      setIsStudyPlanModalOpen(false);
      setAiStudyPlanResult(null);
      setAiStudyPlanError(null);
    } catch (saveError) {
      setAiStudyPlanError(
        saveError instanceof Error
          ? saveError.message
          : "Gagal menyimpan AI Study Plan.",
      );
    } finally {
      setIsSavingStudyPlan(false);
    }
  }

  async function toggleStudyPlanItem(item: StudyPlanItem) {
    setBusyStudyPlanItemId(item.id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: updateError } = await supabase
        .from("study_plan_items")
        .update({ is_done: !item.is_done })
        .eq("id", item.id)
        .eq("user_id", item.user_id)
        .eq("study_plan_id", item.study_plan_id)
        .select(
          "id,user_id,study_plan_id,date,time_block,action,estimated_minutes,is_done,position,created_at",
        )
        .single();

      if (updateError) {
        throw updateError;
      }

      const updatedItem = data as StudyPlanItem;

      setStudyPlans((current) =>
        current
          .map((plan) =>
            plan.id === updatedItem.study_plan_id
              ? {
                  ...plan,
                  items: plan.items
                    .map((currentItem) =>
                      currentItem.id === updatedItem.id
                        ? updatedItem
                        : currentItem,
                    )
                    .sort(sortStudyPlanItems),
                }
              : plan,
          )
          .sort(sortStudyPlans),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Gagal memperbarui study plan item.",
      );
    } finally {
      setBusyStudyPlanItemId(null);
    }
  }

  async function handleSummarizeNotes() {
    if (!task) {
      return;
    }

    setIsNotesSummaryModalOpen(true);
    setIsAiModalOpen(false);
    setIsStudyPlanModalOpen(false);
    setAiNotesSummaryResult(null);
    setAiNotesSummaryError(null);

    const hasNotes = sortedNotes.some((note) => note.content.trim());

    if (!hasNotes) {
      setAiNotesSummaryError(
        "Tugas ini belum memiliki notes untuk diringkas.",
      );
      return;
    }

    setIsSummarizingNotes(true);

    try {
      const response = await fetch("/api/ai/summarize-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (Partial<AiNotesSummaryResult> & AiErrorResponse)
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Gagal merangkum notes dengan AI.",
        );
      }

      if (
        !payload ||
        typeof payload.summary !== "string" ||
        !Array.isArray(payload.important_points) ||
        !Array.isArray(payload.suggested_next_actions)
      ) {
        throw new Error("Response AI tidak sesuai format ringkasan notes.");
      }

      setAiNotesSummaryResult({
        summary: payload.summary,
        important_points: payload.important_points,
        suggested_next_actions: payload.suggested_next_actions,
      });
    } catch (summarizeError) {
      setAiNotesSummaryError(
        summarizeError instanceof Error
          ? summarizeError.message
          : "Gagal merangkum notes dengan AI.",
      );
    } finally {
      setIsSummarizingNotes(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Tugas tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tugas ini tidak ada atau bukan milik akun yang sedang login.
        </p>
        <Link
          href="/tasks"
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke tugas
        </Link>
      </div>
    );
  }

  const completed = task.status === "completed";
  const deadlineLabel = getDeadlineLabel(task.deadline, completed);
  const overdue = getDeadlineState(task.deadline, completed) === "overdue";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke tugas
          </Link>
          <div className="mt-4 flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: course?.color_label ?? "#64748b" }}
            />
            <p className="text-sm text-muted-foreground">
              {course?.name ?? "Mata kuliah tidak ditemukan"}
            </p>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            {task.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {task.description || "Tugas ini belum memiliki deskripsi."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <button
            onClick={() => void handleBreakdownWithAi()}
            disabled={isGeneratingBreakdown}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGeneratingBreakdown ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Break Down with AI
          </button>
          <button
            onClick={() => void handleGenerateStudyPlan()}
            disabled={isGeneratingStudyPlan}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGeneratingStudyPlan ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="h-4 w-4" />
            )}
            Generate AI Plan
          </button>
          <button
            onClick={() => void loadDetail()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <TaskMaterialsManager
        courseName={course?.name ?? "Mata kuliah"}
        taskId={task.id}
        taskTitle={task.title}
        userId={userId ?? task.user_id}
      />

      <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-4">
          <article
            className={cn(
              "rounded-lg border bg-card p-5 shadow-soft",
              overdue && "border-rose-200 dark:border-rose-900",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <DeadlineBadge label={deadlineLabel} />
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Deadline</dt>
                <dd className="mt-1 font-medium">{formatDate(task.deadline)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Checklist</dt>
                <dd className="mt-1 font-medium">
                  {completedChecklistCount}/{sortedChecklists.length} selesai
                </dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progress tugas</span>
                <span className="text-muted-foreground">{task.progress}%</span>
              </div>
              <ProgressBar value={task.progress} />
            </div>

            {sortedChecklists.length > 0 ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progress checklist</span>
                  <span className="text-muted-foreground">
                    {checklistProgress}%
                  </span>
                </div>
                <ProgressBar value={checklistProgress} />
              </div>
            ) : null}
          </article>

          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Status & progress</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Status</span>
                <select
                  value={statusDraft}
                  onChange={(event) =>
                    setStatusDraft(event.target.value as TaskStatus)
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Progress</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progressDraft}
                  onChange={(event) =>
                    setProgressDraft(clamp(Number(event.target.value), 0, 100))
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <ProgressBar value={progressDraft} />

              <button
                onClick={() => void updateTaskMeta()}
                disabled={isSavingTask}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Simpan status
              </button>
            </div>
          </article>
        </div>

        <div className="space-y-4">
          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Checklist</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {completedChecklistCount}/{sortedChecklists.length}
              </span>
            </div>

            {allChecklistDone && task.status !== "completed" ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                <p className="font-medium">Semua checklist sudah selesai.</p>
                <p className="mt-1">
                  Kamu bisa menandai tugas ini sebagai completed.
                </p>
                <button
                  onClick={() => void updateTaskMeta("completed", 100)}
                  className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as completed
                </button>
              </div>
            ) : null}

            <form onSubmit={addChecklistItem} className="mt-5 flex gap-2">
              <input
                value={newChecklistText}
                onChange={(event) => setNewChecklistText(event.target.value)}
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Tambah checklist..."
              />
              <button
                disabled={isAddingChecklist}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAddingChecklist ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add
              </button>
            </form>

            {sortedChecklists.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed p-6 text-center">
                <p className="font-medium">Belum ada checklist</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tambahkan langkah kecil agar progress tugas lebih mudah
                  dipantau.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {sortedChecklists.map((item, index) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.is_done}
                        onChange={() => void toggleChecklistItem(item)}
                        disabled={busyChecklistId === item.id}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <p
                        className={cn(
                          "min-w-0 flex-1 text-sm leading-6",
                          item.is_done &&
                            "text-muted-foreground line-through decoration-2",
                        )}
                      >
                        {item.item_text}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void moveChecklistItem(item, -1)}
                        disabled={index === 0 || busyChecklistId === item.id}
                        className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        Up
                      </button>
                      <button
                        onClick={() => void moveChecklistItem(item, 1)}
                        disabled={
                          index === sortedChecklists.length - 1 ||
                          busyChecklistId === item.id
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        Down
                      </button>
                      <button
                        onClick={() => void deleteChecklistItem(item)}
                        disabled={busyChecklistId === item.id}
                        className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950"
                      >
                        {busyChecklistId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Study Plan</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {completedStudyPlanItemCount}/{totalStudyPlanItemCount}
              </span>
            </div>

            {totalStudyPlanItemCount > 0 ? (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Progress study plan</span>
                  <span className="text-muted-foreground">
                    {studyPlanProgress}%
                  </span>
                </div>
                <ProgressBar value={studyPlanProgress} />
              </div>
            ) : null}

            {sortedStudyPlans.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed p-6 text-center">
                <p className="font-medium">Belum ada study plan</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Generate AI Plan untuk menyusun langkah belajar sebelum
                  deadline.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {sortedStudyPlans.map((plan) => {
                  const doneCount = plan.items.filter((item) => item.is_done).length;
                  const planProgress =
                    plan.items.length > 0
                      ? Math.round((doneCount / plan.items.length) * 100)
                      : 0;

                  return (
                    <section key={plan.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <RiskBadge riskLevel={plan.risk_level} />
                        <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {doneCount}/{plan.items.length} done
                        </span>
                      </div>
                      <h3 className="mt-3 font-semibold">{plan.title}</h3>
                      {plan.summary ? (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {plan.summary}
                        </p>
                      ) : null}
                      {plan.suggestion ? (
                        <p className="mt-3 rounded-md bg-muted p-3 text-sm leading-6">
                          {plan.suggestion}
                        </p>
                      ) : null}

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Progress plan</span>
                          <span className="text-muted-foreground">
                            {planProgress}%
                          </span>
                        </div>
                        <ProgressBar value={planProgress} />
                      </div>

                      <div className="mt-4 space-y-3">
                        {plan.items.map((item) => (
                          <div key={item.id} className="rounded-lg border p-3">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={item.is_done}
                                onChange={() => void toggleStudyPlanItem(item)}
                                disabled={busyStudyPlanItemId === item.id}
                                className="mt-1 h-4 w-4 accent-primary"
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    "text-sm font-medium leading-6",
                                    item.is_done &&
                                      "text-muted-foreground line-through decoration-2",
                                  )}
                                >
                                  {item.action}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {formatDate(item.date)}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {item.time_block}
                                  </span>
                                  <span className="rounded-md border px-2 py-1">
                                    {item.estimated_minutes} menit
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </article>

          <article className="rounded-lg border bg-card p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Notes</h2>
              </div>
              <button
                onClick={() => void handleSummarizeNotes()}
                disabled={isSummarizingNotes || sortedNotes.length === 0}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSummarizingNotes ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Summarize Notes
              </button>
            </div>

            <form onSubmit={addNote} className="mt-5 space-y-3">
              <textarea
                value={newNoteContent}
                onChange={(event) => setNewNoteContent(event.target.value)}
                className="min-h-28 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Tulis notes untuk tugas ini..."
              />
              <button
                disabled={isAddingNote}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAddingNote ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Tambah notes
              </button>
            </form>

            {sortedNotes.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed p-6 text-center">
                <p className="font-medium">Belum ada notes</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Simpan referensi, ide, atau catatan revisi untuk tugas ini.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {sortedNotes.map((note) => (
                  <article key={note.id} className="rounded-lg border p-4">
                    {editingNoteId === note.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingNoteContent}
                          onChange={(event) =>
                            setEditingNoteContent(event.target.value)
                          }
                          className="min-h-28 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => void saveNote(note)}
                            disabled={busyNoteId === note.id}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {busyNoteId === note.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Simpan
                          </button>
                          <button
                            onClick={cancelEditNote}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
                          >
                            <X className="h-4 w-4" />
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap text-sm leading-6">
                          {note.content}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Updated {new Date(note.updated_at).toLocaleString("id-ID")}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => startEditNote(note)}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted"
                          >
                            <FileText className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => void deleteNote(note)}
                            disabled={busyNoteId === note.id}
                            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70 dark:text-rose-300 dark:hover:bg-rose-950"
                          >
                            {busyNoteId === note.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Hapus
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      {isAiModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">AI Task Breakdown</h2>
                  <p className="text-sm text-muted-foreground">
                    Review hasilnya sebelum disimpan ke checklist.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-muted"
                aria-label="Tutup modal AI"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              {isGeneratingBreakdown ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="mt-3 text-sm font-medium">
                    Membuat breakdown tugas...
                  </p>
                </div>
              ) : null}

              {aiError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                  {aiError}
                </div>
              ) : null}

              {aiResult ? (
                <>
                  <section className="rounded-lg border p-4">
                    <h3 className="text-sm font-semibold">Summary</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {aiResult.summary}
                    </p>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">
                        Generated checklist
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {aiResult.checklist.length} items
                      </span>
                    </div>
                    <div className="space-y-3">
                      {aiResult.checklist.map((item, index) => (
                        <article
                          key={`${item.title}-${index}`}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-6">
                                {item.title}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <PriorityBadge priority={item.priority} />
                                <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                  {item.estimated_minutes} menit
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => setIsAiModalOpen(false)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
              >
                Batal
              </button>
              <button
                onClick={() => void saveAiChecklist()}
                disabled={!aiResult || isGeneratingBreakdown || isSavingAiChecklist}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingAiChecklist ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save to Checklist
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isStudyPlanModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">AI Study Plan</h2>
                  <p className="text-sm text-muted-foreground">
                    Review rencana belajar sebelum disimpan.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStudyPlanModalOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-muted"
                aria-label="Tutup modal study plan"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              {isGeneratingStudyPlan ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="mt-3 text-sm font-medium">
                    Membuat AI Study Plan...
                  </p>
                </div>
              ) : null}

              {aiStudyPlanError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                  {aiStudyPlanError}
                </div>
              ) : null}

              {aiStudyPlanResult ? (
                <>
                  <section className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskBadge riskLevel={aiStudyPlanResult.risk_level} />
                      <span className="rounded-md border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {aiStudyPlanResult.plan.length} steps
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold">Summary</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {aiStudyPlanResult.summary}
                    </p>
                    <h3 className="mt-4 text-sm font-semibold">Suggestion</h3>
                    <p className="mt-2 rounded-md bg-muted p-3 text-sm leading-6">
                      {aiStudyPlanResult.suggestion}
                    </p>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">Generated plan</h3>
                      <span className="text-xs text-muted-foreground">
                        Deadline {formatDate(task.deadline)}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {aiStudyPlanResult.plan.map((item, index) => (
                        <article
                          key={`${item.date}-${item.time_block}-${index}`}
                          className="rounded-lg border p-4"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-6">
                                {item.action}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {formatDate(item.date)}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {item.time_block}
                                </span>
                                <span className="rounded-md border px-2 py-1">
                                  {item.estimated_minutes} menit
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-card p-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => setIsStudyPlanModalOpen(false)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted"
              >
                Batal
              </button>
              <button
                onClick={() => void saveAiStudyPlan()}
                disabled={
                  !aiStudyPlanResult ||
                  isGeneratingStudyPlan ||
                  isSavingStudyPlan
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSavingStudyPlan ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save as Study Plan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isNotesSummaryModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border bg-card shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">AI Notes Summary</h2>
                  <p className="text-sm text-muted-foreground">
                    Ringkasan otomatis dari notes tugas ini.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNotesSummaryModalOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-muted"
                aria-label="Tutup modal notes summary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              {isSummarizingNotes ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="mt-3 text-sm font-medium">
                    Merangkum notes...
                  </p>
                </div>
              ) : null}

              {aiNotesSummaryError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
                  {aiNotesSummaryError}
                </div>
              ) : null}

              {aiNotesSummaryResult ? (
                <>
                  <section className="rounded-lg border p-4">
                    <h3 className="text-sm font-semibold">Summary</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {aiNotesSummaryResult.summary}
                    </p>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <h3 className="text-sm font-semibold">
                        Important points
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {aiNotesSummaryResult.important_points.map(
                          (point, index) => (
                            <li
                              key={`${point}-${index}`}
                              className="flex gap-2 text-sm leading-6"
                            >
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{point}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div className="rounded-lg border p-4">
                      <h3 className="text-sm font-semibold">
                        Suggested next actions
                      </h3>
                      <ul className="mt-3 space-y-2">
                        {aiNotesSummaryResult.suggested_next_actions.map(
                          (action, index) => (
                            <li
                              key={`${action}-${index}`}
                              className="flex gap-2 text-sm leading-6"
                            >
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              <span>{action}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  </section>

                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                    Raw response AI sudah disimpan ke ai_suggestions.
                  </p>
                </>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex justify-end border-t bg-card p-4">
              <button
                onClick={() => setIsNotesSummaryModalOpen(false)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
