import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AmbientBackground } from "@/components/layout/ambient-background";

export const metadata = { title: "Volunteer Dashboard" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-12">
      <AmbientBackground />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
