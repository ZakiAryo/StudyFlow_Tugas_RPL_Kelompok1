import { Github, Link2, Linkedin, Palette, UserRound } from "lucide-react";

import { WhatsAppReminderSettings } from "@/components/settings/whatsapp-reminder-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pengaturan profil, link portfolio, dan reminder Telegram.
        </p>
      </div>

      <WhatsAppReminderSettings />

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-shadow duration-300">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Profil</h2>
          </div>
          <div className="mt-4 space-y-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Nama</span>
              <input
                className="h-10 w-full rounded-xl border bg-background/70 px-3 outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                placeholder="Nama kamu"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Kampus</span>
              <input
                className="h-10 w-full rounded-xl border bg-background/70 px-3 outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                placeholder="Nama kampus"
              />
            </label>
          </div>
        </article>

        <article className="rounded-3xl border bg-card/80 p-5 shadow-sm backdrop-blur-xl transition-shadow duration-300">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Portfolio links</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { label: "GitHub", icon: Github },
              { label: "Portfolio", icon: Link2 },
              { label: "LinkedIn", icon: Linkedin },
            ].map((item) => (
              <label key={item.label} className="space-y-2 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
                <input
                  className="h-10 w-full rounded-xl border bg-background/70 px-3 outline-none transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder={`URL ${item.label}`}
                />
              </label>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
