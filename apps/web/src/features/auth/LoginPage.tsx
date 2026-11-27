"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChalkboardTeacher, ShieldStar, Student } from "@phosphor-icons/react";
import { loginSchema, type LoginInput } from "@np/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthFormLayout, AuthShell } from "@/components/layout/AuthShell";
import { AuthField, AuthSubmit } from "@/features/auth/AuthField";
import { useAuth } from "@/lib/auth-context";
import { apiErrorMessage, applyFieldErrors } from "@/lib/api-client";
import { safeNext } from "@/lib/route-guards";
import { siteConfig } from "@/lib/site-config";

export function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    resetField,
    setFocus,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<LoginInput>({
    // Same schema the API validates with (@np/shared) - client and server rules can't drift.
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await login(values);
      router.replace(next);
    } catch (err) {
      if (!applyFieldErrors(err, setError)) setFormError(apiErrorMessage(err));
    }
  }

  return (
    <AuthShell
      title="Sign in"
      description={`Welcome to ${siteConfig.productName}. Pick a demo role, or use your own account.`}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={`/register${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-foreground underline-offset-4 hover:underline">
            Create a candidate account
          </Link>
        </>
      }
    >
      <DemoAccounts
        disabled={isSubmitting}
        onPick={(email, password) => {
          setValue("email", email, { shouldDirty: true });
          setValue("password", password, { shouldDirty: true });
          void handleSubmit(onSubmit)();
        }}
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthFormLayout
          submit={<AuthSubmit pending={isSubmitting} label="Sign in" pendingLabel="Signing in…" />}
        >
          {formError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            registration={register("email")}
            error={errors.email?.message}
            dirty={!!dirtyFields.email}
            onClear={() => {
              resetField("email");
              setFocus("email");
            }}
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            registration={register("password")}
            error={errors.password?.message}
            dirty={!!dirtyFields.password}
          />
        </AuthFormLayout>
      </form>
    </AuthShell>
  );
}

/** Demo accounts (fictional data, listed in the README as the brief asks): one click signs in as that role. */
const DEMO = [
  { role: "Examiner", who: "Dr. Ayesha Khan", email: "ayesha.khan@nullpointers.dev", password: "Examiner@Demo2026", icon: ChalkboardTeacher },
  { role: "Candidate", who: "Hamza Iqbal", email: "hamza.iqbal@student.nullpointers.dev", password: "Candidate@Demo2026", icon: Student },
  { role: "Admin", who: "Platform Admin", email: "admin@nullpointers.dev", password: "Admin@Demo2026", icon: ShieldStar },
];

function DemoAccounts({ onPick, disabled }: { onPick: (email: string, password: string) => void; disabled?: boolean }) {
  return (
    <div className="mb-7">
      <p className="mb-2.5 text-[0.8125rem] font-medium text-muted-foreground">Demo accounts</p>
      <div className="grid grid-cols-3 gap-2">
        {DEMO.map((d, i) => (
          <button
            key={d.role}
            type="button"
            disabled={disabled}
            onClick={() => onPick(d.email, d.password)}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-3 text-start shadow-xs transition-all duration-300 ease-[var(--ease-out)] hover:border-primary/40 hover:bg-[var(--glass-strong)] active:scale-[0.98] disabled:opacity-50 animate-[rise_500ms_var(--ease-out)_backwards]"
            style={{ animationDelay: `${120 + i * 70}ms` }}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand-ink">
              <d.icon weight="duotone" className="size-[1.125rem]" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{d.role}</span>
              <span className="block truncate text-xs text-muted-foreground">{d.who}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or sign in with email <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
