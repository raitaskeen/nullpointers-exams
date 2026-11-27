"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
      title="Welcome back"
      description={`Log in to your ${siteConfig.productName} account.`}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href={`/register${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthFormLayout
          submit={<AuthSubmit pending={isSubmitting} label="Log in" pendingLabel="Logging in..." />}
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
