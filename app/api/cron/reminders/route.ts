import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

type NotificationSetting = {
  user_id: string;
  telegram_chat_id: string | null;
  telegram_enabled: boolean;
  remind_deadline_tomorrow: boolean;
  remind_deadline_today: boolean;
  remind_overdue_tasks: boolean;
  remind_today_schedule: boolean;
  reminder_time: string;
  timezone: string;
};

type TaskRecord = {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  status: string;
  progress: number;
  courses?: unknown;
};

type ScheduleSessionRecord = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  courses?: unknown;
};

type ReminderType =
  | "deadline_tomorrow"
  | "deadline_today"
  | "overdue_task"
  | "today_schedule";

type ReminderCandidate = {
  userId: string;
  taskId?: string;
  reminderType: ReminderType;
  reminderDate: string;
  telegramChatId: string;
  message: string;
  templateParameters: string[];
};

const defaultTimeZone = "Asia/Jakarta";
const dayVariants: Record<number, string[]> = {
  0: ["sunday", "minggu"],
  1: ["monday", "senin"],
  2: ["tuesday", "selasa"],
  3: ["wednesday", "rabu"],
  4: ["thursday", "kamis"],
  5: ["friday", "jumat", "jum'at"],
  6: ["saturday", "sabtu"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readCourseName(value: unknown) {
  const course = Array.isArray(value) ? value[0] : value;
  if (!isRecord(course)) return "Mata kuliah";
  return readString(course.name) || "Mata kuliah";
}

function getSafeTimeZone(timeZone: string | null | undefined) {
  const candidate = timeZone?.trim() || defaultTimeZone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return defaultTimeZone;
  }
}

function getDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function toDateString({ year, month, day }: ReturnType<typeof getDateParts>) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysToDateString(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getLocalContext(timeZone: string) {
  const now = new Date();
  const parts = getDateParts(now, timeZone);
  const today = toDateString(parts);
  return {
    today,
    tomorrow: addDaysToDateString(today, 1),
    dayValues: new Set(dayVariants[new Date(`${today}T00:00:00Z`).getUTCDay()]),
    hour: parts.hour,
  };
}

function shouldRunForReminderTime(reminderTime: string, localHour: number) {
  const [hourValue] = reminderTime.split(":");
  const reminderHour = Number(hourValue);
  if (!Number.isInteger(reminderHour)) return true;
  return reminderHour === localHour;
}

function formatDateId(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function buildTaskMessage({
  task,
  courseName,
  reminderType,
}: {
  task: TaskRecord;
  courseName: string;
  reminderType: ReminderType;
}) {
  const headerByType = {
    deadline_tomorrow:
      "⏰ Deadline Besok",
    deadline_today:
      "🚨 Deadline Hari Ini",
    overdue_task:
      "⚠️ Tugas Terlambat",
  } as const;

  const actionByType = {
    deadline_tomorrow:
      "Jangan lupa siapkan dan selesaikan tugas ini sebelum deadline.",
    deadline_today:
      "Deadline-nya hari ini. Pastikan tugas sudah selesai sebelum waktunya.",
    overdue_task:
      "Tugas ini sudah melewati deadline. Segera selesaikan atau perbarui statusnya.",
  } as const;

  if (
    reminderType !== "deadline_tomorrow" &&
    reminderType !== "deadline_today" &&
    reminderType !== "overdue_task"
  ) {
    throw new Error (`Invalid task reminder type: ${reminderType}`);
  }

  return [
    "StudyFlow Reminder",
    "",
    headerByType[reminderType],
    "",
    `📌 Tugas: ${task.title}`,
    `📚 Mata kuliah: ${courseName}`,
    `📅 Deadline: ${formatDateId(task.deadline)}`,
    `🎯 Prioritas: ${task.priority}`,
    `📊 Progress: ${task.progress}%`,
    "",
    actionByType[reminderType],
    "",
    "- StudyFlow AI",
  ].join("\n");
}

function buildScheduleMessage(sessions: ScheduleSessionRecord[]) {
  const lines = sessions.map((session, index) => {
    const courseName = readCourseName(session.courses);
    const room = session.room?.trim() || "Ruang belum diisi";
    return `${index + 1}. ${courseName}, ${formatTime(session.start_time)}-${formatTime(session.end_time)}, ${room}`;
  });

  return [
    "StudyFlow Reminder",
    "",
    "Jadwal kuliah hari ini:",
    ...lines,
    "",
    "Semoga sesi kuliahnya lancar.",
  ].join("\n");
}

function normalizeDay(value: string) {
  return value.trim().toLowerCase();
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const expectedAuthorization = cronSecret ? `Bearer ${cronSecret}` : null;

  console.log("CRON DEBUG:", {
    hasSecret: Boolean(cronSecret),
    secretLength: cronSecret?.length ?? 0,
    hasAuthorization: Boolean(authorization),
    authorizationLength: authorization?.length ?? 0,
    expectedAuthorizationLength: expectedAuthorization?.length ?? 0,
    matches: authorization === expectedAuthorization,
  });

  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return authorization === `Bearer ${cronSecret}`;
}

async function reserveReminder(
  supabase: SupabaseClient,
  candidate: ReminderCandidate,
) {
  const { data, error } = await supabase
    .from("notification_logs")
    .insert({
      user_id: candidate.userId,
      task_id: candidate.taskId ?? null,
      schedule_session_id: null,
      reminder_type: candidate.reminderType,
      reminder_date: candidate.reminderDate,
      recipient: candidate.telegramChatId,
      telegram_chat_id: candidate.telegramChatId,
      message: candidate.message,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function markReminderSent(
  supabase: SupabaseClient,
  logId: string,
  providerMessageId: string | null,
) {
  await supabase
    .from("notification_logs")
    .update({
      status: "sent",
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
    })
    .eq("id", logId);
}

async function markReminderFailed(
  supabase: SupabaseClient,
  logId: string,
  error: unknown,
) {
  const message =
    error instanceof Error
      ? error.message
      : "Gagal mengirim reminder Telegram.";

  await supabase
    .from("notification_logs")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
    })
    .eq("id", logId);
}

async function buildTaskReminders(
  supabase: SupabaseClient,
  setting: NotificationSetting,
  today: string,
  tomorrow: string,
): Promise<ReminderCandidate[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,deadline,priority,status,progress,courses(name)")
    .eq("user_id", setting.user_id)
    .neq("status", "completed")
    .order("deadline", { ascending: true })
    .limit(50);

  if (error) throw error;

  const tasks = (data ?? []) as TaskRecord[];
  const candidates: ReminderCandidate[] = [];
  const telegramChatId = setting.telegram_chat_id ?? "";

  tasks.forEach((task) => {
    let reminderType: ReminderType | null = null;

    if (task.deadline === tomorrow && setting.remind_deadline_tomorrow) {
      reminderType = "deadline_tomorrow";
    } else if (task.deadline === today && setting.remind_deadline_today) {
      reminderType = "deadline_today";
    } else if (task.deadline < today && setting.remind_overdue_tasks) {
      reminderType = "overdue_task";
    }

    if (!reminderType) return;

    const courseName = readCourseName(task.courses);
    const message = buildTaskMessage({ task, courseName, reminderType });

    candidates.push({
      userId: setting.user_id,
      taskId: task.id,
      reminderType,
      reminderDate: today,
      telegramChatId,
      message,
      templateParameters: [
        task.title,
        courseName,
        formatDateId(task.deadline),
        `${task.progress}%`,
      ],
    });
  });

  return candidates;
}

async function buildScheduleReminder(
  supabase: SupabaseClient,
  setting: NotificationSetting,
  today: string,
  dayValues: Set<string>,
): Promise<ReminderCandidate[]> {
  if (!setting.remind_today_schedule) return [];

  const { data, error } = await supabase
    .from("schedule_sessions")
    .select("id,day_of_week,start_time,end_time,room,courses(name)")
    .eq("user_id", setting.user_id)
    .order("start_time", { ascending: true });

  if (error) throw error;

  const sessions = ((data ?? []) as ScheduleSessionRecord[]).filter((session) =>
    dayValues.has(normalizeDay(session.day_of_week)),
  );

  if (sessions.length === 0) return [];

  const message = buildScheduleMessage(sessions);

  return [
    {
      userId: setting.user_id,
      reminderType: "today_schedule" as const,
      reminderDate: today,
      telegramChatId: setting.telegram_chat_id ?? "",
      message,
      templateParameters: [
        "Jadwal kuliah hari ini",
        String(sessions.length),
        formatDateId(today),
        "Cek detail jadwal di StudyFlow.",
      ],
    },
  ];
}

async function buildReminderCandidates(
  supabase: SupabaseClient,
  setting: NotificationSetting,
): Promise<ReminderCandidate[]> {
  const timeZone = getSafeTimeZone(setting.timezone);
  const { today, tomorrow, dayValues, hour } = getLocalContext(timeZone);

  console.log("REMINDER DEBUG:", {
    userId: setting.user_id,
    timezone: timeZone,
    today,
    tomorrow,
    currentHour: hour,
    reminderTime: setting.reminder_time,
    remind_deadline_tomorrow: setting.remind_deadline_tomorrow,
    remind_deadline_today: setting.remind_deadline_today,
    remind_overdue_tasks: setting.remind_overdue_tasks,
    remind_today_schedule: setting.remind_today_schedule,
    telegram_enabled: setting.telegram_enabled,
    telegram_chat_id: setting.telegram_chat_id,
  });

  if (!shouldRunForReminderTime(setting.reminder_time, hour)) {
    console.log("REMINDER DEBUG: blocked by reminder_time");
    return [];
  }

  const [taskReminders, scheduleReminders] = await Promise.all([
    buildTaskReminders(supabase, setting, today, tomorrow),
    buildScheduleReminder(supabase, setting, today, dayValues),
  ]);

  console.log("REMINDER DEBUG RESULT:", {
    taskReminders: taskReminders.length,
    scheduleReminders: scheduleReminders.length,
  });

  return [...taskReminders, ...scheduleReminders];
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Cron tidak terotorisasi.", code: "UNAUTHORIZED_CRON" },
      { status: 401 },
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_notification_settings")
      .select(
        "user_id,telegram_chat_id,telegram_enabled,remind_deadline_tomorrow,remind_deadline_today,remind_overdue_tasks,remind_today_schedule,reminder_time,timezone",
      )
      .eq("telegram_enabled", true)
      .not("telegram_chat_id", "is", null);

    if (error) throw error;

    const settings = (data ?? []) as NotificationSetting[];
    const summary = {
      checked_users: settings.length,
      candidates: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      dry_run: dryRun,
    };
    const dryRunSamples: Array<{
      type: ReminderType;
      user_id: string;
      message: string;
    }> = [];

    for (const setting of settings) {
      const candidates = await buildReminderCandidates(supabase, setting);
      summary.candidates += candidates.length;

      for (const candidate of candidates) {
        if (dryRun) {
          dryRunSamples.push({
            type: candidate.reminderType,
            user_id: candidate.userId,
            message: candidate.message,
          });
          continue;
        }

        let logId: string | null = null;

        try {
          console.log("TELEGRAM DEBUG: reserving reminder", {
            userId: candidate.userId,
            taskId: candidate.taskId,
            chatId: candidate.telegramChatId,
          });

          logId = await reserveReminder(supabase, candidate);
          console.log("TELEGRAM DEBUG: reserve result", { logId });
        } catch (error) {
          console.error("TELEGRAM DEBUG: reserveReminder FAILED", error);
          throw error;
        }

        if (!logId) {
          summary.skipped += 1;
          continue;
        }

        try {
          const result = await sendTelegramMessage(
            candidate.telegramChatId,
            candidate.message,
          );

          await markReminderSent(
            supabase,
            logId,
            typeof result === "object" &&
            result !== null &&
            "message_id" in result
              ? String(result.message_id)
              : null,
          );
          summary.sent += 1;
        } catch (sendError) {
          await markReminderFailed(supabase, logId, sendError);
          summary.failed += 1;
        }
      }
    }

    return NextResponse.json({
      ...summary,
      samples: dryRunSamples.slice(0, 5),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menjalankan cron Telegram reminder.",
        code: "FAILED_TO_RUN_TELEGRAM_REMINDERS",
      },
      { status: 500 },
    );
  }
}
