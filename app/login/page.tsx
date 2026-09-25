import Image from "next/image";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-soft">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo StudyFlow AI"
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 object-contain"
              priority
            />
            <div>
              <p className="font-semibold">StudyFlow AI</p>
              <p className="text-xs text-muted-foreground">
                Academic workspace
              </p>
            </div>
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Masuk untuk mengelola tugas dan jadwal kuliah.
          </p>
        </div>
        <AuthForm mode="login" />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link href="/register" className="font-medium text-primary">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
