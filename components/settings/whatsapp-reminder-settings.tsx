"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  Link2,
  MessageCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Unlink,
} from "lucide-react";

import { createSupabaseClient } from "@/lib/supabase";

type ReminderSettings = {
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

type TelegramConnection = {
  user_id: string;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  telegram_first_name: string | null;
  connected_at: string | null;
  status: string | null;
};

type FormState = {
  telegram_enabled: boolean;
  remind_deadline_tomorrow: boolean;
  remind_deadline_today: boolean;
  remind_overdue_tasks: boolean;
  remind_today_schedule: boolean;
  reminder_time: string;
  timezone: string;
};

const defaultForm: FormState = {
  telegram_enabled: false,
  remind_deadline_tomorrow: true,
  remind_deadline_today: true,
  remind_overdue_tasks: true,
  remind_today_schedule: false,
  reminder_time: "07:00",
  timezone: "Asia/Jakarta",
};

function formatTimeInput(value: string) {
  return value.slice(0, 5);
}

function ToggleField({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border bg-background p-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border"
      />
    </label>
  );
}

function SettingsSkeleton() {
  return (
    <article className="rounded-lg border bg-card p-5 shadow-soft">
      <div className="h-6 w-44 animate-pulse rounded bg-muted" />

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    </article>
  );
}

export function WhatsAppReminderSettings() {
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(defaultForm);

  const [connection, setConnection] =
    useState<TelegramConnection | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

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
        throw new Error(
          "Kamu harus login untuk membuka pengaturan reminder.",
        );
      }

      setUserId(user.id);

      const { data, error: settingsError } = await supabase
        .from("user_notification_settings")
        .select(
          "user_id,telegram_chat_id,telegram_enabled,remind_deadline_tomorrow,remind_deadline_today,remind_overdue_tasks,remind_today_schedule,reminder_time,timezone",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      const settings = data as ReminderSettings | null;

      setForm({
        ...defaultForm,
        telegram_enabled:
          settings?.telegram_enabled ?? defaultForm.telegram_enabled,
        remind_deadline_tomorrow:
          settings?.remind_deadline_tomorrow ??
          defaultForm.remind_deadline_tomorrow,
        remind_deadline_today:
          settings?.remind_deadline_today ??
          defaultForm.remind_deadline_today,
        remind_overdue_tasks:
          settings?.remind_overdue_tasks ??
          defaultForm.remind_overdue_tasks,
        remind_today_schedule:
          settings?.remind_today_schedule ??
          defaultForm.remind_today_schedule,
        reminder_time: settings?.reminder_time
          ? formatTimeInput(settings.reminder_time)
          : defaultForm.reminder_time,
        timezone: settings?.timezone ?? defaultForm.timezone,
      });

      const { data: connectionData, error: connectionError } =
        await supabase
          .from("telegram_connections")
          .select(
            "user_id,telegram_chat_id,telegram_username,telegram_first_name,connected_at,status",
          )
          .eq("user_id", user.id)
          .eq("status", "connected")
          .maybeSingle();

      if (connectionError) {
        throw connectionError;
      }

      setConnection(connectionData as TelegramConnection | null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Gagal memuat pengaturan Telegram reminder.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleConnectTelegram() {
    setIsConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal membuat koneksi Telegram.",
        );
      }

      if (!result.telegramUrl) {
        throw new Error("Link koneksi Telegram tidak tersedia.");
      }

      window.open(result.telegramUrl, "_blank", "noopener,noreferrer");

      setSuccess(
        "Link Telegram sudah dibuka. Tekan Start di bot untuk menyelesaikan koneksi.",
      );
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Gagal menghubungkan Telegram.",
      );
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnectTelegram() {
    setIsDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/telegram/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Gagal memutuskan koneksi Telegram.",
        );
      }

      setSuccess("Telegram berhasil diputuskan.");

      await loadSettings();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Gagal memutuskan koneksi Telegram.",
      );
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!userId) {
        throw new Error("Session user belum siap.");
      }

      if (form.telegram_enabled && !connection?.telegram_chat_id) {
        throw new Error(
          "Hubungkan Telegram terlebih dahulu sebelum mengaktifkan reminder.",
        );
      }

      const supabase = createSupabaseClient();

      const { error: saveError } = await supabase
        .from("user_notification_settings")
        .upsert(
          {
            user_id: userId,
            telegram_chat_id: connection?.telegram_chat_id ?? null,
            telegram_enabled: form.telegram_enabled,
            remind_deadline_tomorrow:
              form.remind_deadline_tomorrow,
            remind_deadline_today:
              form.remind_deadline_today,
            remind_overdue_tasks:
              form.remind_overdue_tasks,
            remind_today_schedule:
              form.remind_today_schedule,
            reminder_time: form.reminder_time,
            timezone:
              form.timezone.trim() || defaultForm.timezone,
          },
          {
            onConflict: "user_id",
          },
        );

      if (saveError) {
        throw saveError;
      }

      setSuccess(
        "Pengaturan Telegram reminder berhasil disimpan.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Gagal menyimpan pengaturan Telegram reminder.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  const isConnected =
    connection?.status === "connected" &&
    Boolean(connection.telegram_chat_id);

  return (
    <article className="rounded-lg border bg-card p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />

            <h2 className="font-semibold">
              Telegram Reminder
            </h2>
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Hubungkan Telegram kamu agar StudyFlow dapat mengirim
            reminder deadline tugas dan jadwal kuliah.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />

          {isConnected
            ? "Telegram terhubung"
            : "Belum terhubung"}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      ) : null}

      {/* STATUS TELEGRAM */}
      <div className="mt-5 rounded-lg border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              Status koneksi
            </p>

            {isConnected ? (
              <div className="mt-1">
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  ✓ Telegram sudah terhubung
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {connection.telegram_username
                    ? `@${connection.telegram_username}`
                    : connection.telegram_first_name ||
                      "Akun Telegram"}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Telegram belum terhubung ke akun StudyFlow.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleConnectTelegram()}
              disabled={isConnecting || isDisconnecting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isConnecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}

              {isConnecting
                ? "Membuka Telegram..."
                : isConnected
                  ? "Hubungkan ulang"
                  : "Connect Telegram"}
            </button>

            {isConnected ? (
              <button
                type="button"
                onClick={() => void handleDisconnectTelegram()}
                disabled={isDisconnecting || isConnecting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-300 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950"
              >
                {isDisconnecting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}

                {isDisconnecting
                  ? "Memutuskan..."
                  : "Putuskan Telegram"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <ToggleField
            checked={form.telegram_enabled}
            disabled={!isConnected}
            label="Aktifkan kirim reminder ke Telegram"
            description={
              isConnected
                ? "StudyFlow akan mengirim reminder sesuai pengaturan di sebelah kanan."
                : "Hubungkan Telegram terlebih dahulu."
            }
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                telegram_enabled: checked,
              }))
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Clock3 className="h-4 w-4" />
                Jam reminder
              </span>

              <input
                type="time"
                value={form.reminder_time}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reminder_time: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="font-medium">
                Timezone
              </span>

              <input
                value={form.timezone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Asia/Jakarta"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField
            checked={form.remind_deadline_tomorrow}
            label="Deadline besok"
            description="Kirim reminder untuk tugas aktif yang deadline-nya besok."
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                remind_deadline_tomorrow: checked,
              }))
            }
          />

          <ToggleField
            checked={form.remind_deadline_today}
            label="Deadline hari ini"
            description="Kirim reminder untuk tugas aktif yang deadline-nya hari ini."
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                remind_deadline_today: checked,
              }))
            }
          />

          <ToggleField
            checked={form.remind_overdue_tasks}
            label="Tugas overdue"
            description="Kirim reminder untuk tugas yang belum selesai dan sudah lewat deadline."
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                remind_overdue_tasks: checked,
              }))
            }
          />

          <ToggleField
            checked={form.remind_today_schedule}
            label="Jadwal kuliah hari ini"
            description="Kirim ringkasan jadwal kuliah harian jika ada sesi pada hari tersebut."
            onChange={(checked) =>
              setForm((current) => ({
                ...current,
                remind_today_schedule: checked,
              }))
            }
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || isDisconnecting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}

          Simpan pengaturan
        </button>

        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={isSaving || isConnecting || isDisconnecting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Bell className="h-4 w-4" />
          Muat ulang
        </button>
      </div>
    </article>
  );
}