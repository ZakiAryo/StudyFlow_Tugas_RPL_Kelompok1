"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Link2,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Unlink,
  AlertTriangle,
  Zap,
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

function ToggleField({ checked, description, disabled, icon: Icon, iconClassName, label, onChange }: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  icon: typeof CalendarDays;
  iconClassName: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`group flex min-h-[76px] cursor-pointer items-center gap-4 rounded-2xl border bg-background/55 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-background/80 ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
        <span className="flex h-7 w-12 items-center rounded-full border border-border bg-muted p-1 transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30">
          <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </span>
      </span>
    </label>
  );
}

function SettingsSkeleton() {
  return (
    <article className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-shadow duration-300">
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

  const isConnected = connection?.status === "connected" && Boolean(connection.telegram_chat_id);
  const accountLabel = connection?.telegram_username ? `@${connection.telegram_username}` : connection?.telegram_first_name || "Akun Telegram";

  return (
    <article className="relative overflow-hidden rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur-xl sm:p-6 lg:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-40 w-40 rounded-full bg-violet-500/5 blur-3xl" />

      <div className="relative">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/20">
              <Send className="h-8 w-8 -rotate-12" />
              {isConnected ? <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" /></span> : null}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Telegram Reminder Settings</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Dapatkan pengingat tugas, jadwal, dan deadline langsung melalui Telegram. Tetap produktif, kapan pun dan di mana pun.</p>
            </div>
          </div>
          <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${isConnected ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-500" : "border-border bg-background/70 text-muted-foreground"}`}>
            <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" : "bg-muted-foreground"}`} />
            {isConnected ? "Connected" : "Not connected"}
            {isConnected ? <Send className="h-3.5 w-3.5" /> : null}
          </div>
        </div>

        {error ? <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-300/40 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div> : null}
        {success ? <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-300/40 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{success}</span></div> : null}

        <div className="mt-6 rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/10 via-background/40 to-violet-500/5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-500"><Send className="h-6 w-6 -rotate-12" /></div>
              <div>
                <p className="text-base font-bold">Telegram {isConnected ? "Connected" : "Not Connected"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{isConnected ? `Bot ${accountLabel} · Reminder siap dikirim` : "Hubungkan akun Telegram kamu untuk mulai menerima reminder."}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void handleConnectTelegram()} disabled={isConnecting || isDisconnecting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-500 px-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-60">
                {isConnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {isConnecting ? "Membuka Telegram..." : isConnected ? "Hubungkan ulang" : "Connect Telegram"}
              </button>
              {isConnected ? <button type="button" onClick={() => void handleDisconnectTelegram()} disabled={isDisconnecting || isConnecting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/60 px-4 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60">{isDisconnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}{isDisconnecting ? "Memutuskan..." : "Disconnect"}</button> : null}
            </div>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></div>
            <div><h3 className="text-base font-bold">Reminder Preferences</h3><p className="mt-0.5 text-sm text-muted-foreground">Pilih jenis pengingat yang ingin kamu terima melalui Telegram.</p></div>
          </div>
          <div className="space-y-2.5">
            <ToggleField checked={form.remind_deadline_tomorrow} icon={CalendarDays} iconClassName="bg-emerald-500/15 text-emerald-500" label="Tomorrow's Deadlines" description="Get reminded about deadlines due tomorrow" onChange={(checked) => setForm((current) => ({ ...current, remind_deadline_tomorrow: checked }))} />
            <ToggleField checked={form.remind_deadline_today} icon={Zap} iconClassName="bg-violet-500/15 text-violet-500" label="Today's Deadlines" description="Important tasks due today" onChange={(checked) => setForm((current) => ({ ...current, remind_deadline_today: checked }))} />
            <ToggleField checked={form.remind_overdue_tasks} icon={AlertTriangle} iconClassName="bg-orange-500/15 text-orange-500" label="Overdue Tasks" description="Don't let unfinished tasks slip away" onChange={(checked) => setForm((current) => ({ ...current, remind_overdue_tasks: checked }))} />
            <ToggleField checked={form.remind_today_schedule} icon={GraduationCap} iconClassName="bg-blue-500/15 text-blue-500" label="Today's Class Schedule" description="Your class schedule every morning" onChange={(checked) => setForm((current) => ({ ...current, remind_today_schedule: checked }))} />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-background/45 p-4 sm:p-5">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock3 className="h-5 w-5" /></div><div><h3 className="text-base font-bold">Daily Reminder</h3><p className="mt-0.5 text-sm text-muted-foreground">When should StudyFlow notify you?</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="sr-only">Jam reminder</span><div className="flex h-12 items-center gap-3 rounded-xl border bg-background/70 px-3 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"><Clock3 className="h-4 w-4 text-muted-foreground" /><input type="time" value={form.reminder_time} onChange={(event) => setForm((current) => ({ ...current, reminder_time: event.target.value }))} className="w-full bg-transparent text-sm font-semibold outline-none" /></div></label>
            <label className="block"><span className="sr-only">Timezone</span><div className="flex h-12 items-center gap-3 rounded-xl border bg-background/70 px-3 transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"><span className="text-sm text-muted-foreground">🌐</span><input value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} className="w-full bg-transparent text-sm font-semibold outline-none" placeholder="Asia/Jakarta" /></div></label>
          </div>
        </div>

        <button type="button" onClick={() => void handleSave()} disabled={isSaving || isDisconnecting} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-500 px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Preferences</button>

        <button type="button" onClick={() => void loadSettings()} disabled={isSaving || isConnecting || isDisconnecting} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"><Bell className="h-4 w-4" />Muat ulang</button>
      </div>
    </article>
  );
}
