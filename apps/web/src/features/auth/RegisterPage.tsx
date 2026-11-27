"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@np/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthFormLayout, AuthShell } from "@/components/layout/AuthShell";
import { AuthField, AuthSubmit } from "@/features/auth/AuthField";
import { useAuth } from "@/lib/auth-context";
import { apiErrorMessage, applyFieldErrors } from "@/lib/api-client";
import { safeNext } from "@/lib/route-guards";
import { siteConfig } from "@/lib/site-config";

export function RegisterPage() {
  const { register: registerUser } = useAuth();
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
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      await registerUser(values);
      router.replace(next);
    } catch (err) {
      if (!applyFieldErrors(err, setError)) setFormError(apiErrorMessage(err));
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description={`Join your team on ${siteConfig.productName} - it takes under a minute.`}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthFormLayout
          submit={<AuthSubmit pending={isSubmitting} label="Create account" pendingLabel="Creating account..." />}
        >
          {formError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <AuthField
            id="fullName"
            label="Full name"
            autoComplete="name"
            placeholder="Ada Lovelace"
            registration={register("fullName")}
            error={errors.fullName?.message}
            dirty={!!dirtyFields.fullName}
          />
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
            autoComplete="new-password"
            placeholder="••••••••"
            hint="8+ characters, a letter and a number"
            registration={register("password")}
            error={errors.password?.message}
            dirty={!!dirtyFields.password}
          />
        </AuthFormLayout>
      </form>
    </AuthShell>
  );
}
