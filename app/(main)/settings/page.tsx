import { Github, Link2, Linkedin, Palette, UserRound } from "lucide-react";

import { WhatsAppReminderSettings } from "@/components/settings/whatsapp-reminder-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pengaturan profil, link portfolio, dan reminder WhatsApp.
        </p>
      </div>

      <WhatsAppReminderSettings />

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Profil</h2>
          </div>
          <div className="mt-4 space-y-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Nama</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Nama kamu"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">Kampus</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
                placeholder="Nama kampus"
              />
            </label>
          </div>
        </article>

        <article className="rounded-lg border bg-card p-5 shadow-soft">
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
                  className="h-10 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-primary"
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
