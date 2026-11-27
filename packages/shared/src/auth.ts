import { z } from "zod";

export const emailSchema = z.email("Enter a valid email address").trim().toLowerCase().max(255);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const loginSchema = z.object({
  email: emailSchema,
  // Never apply the strength rules on login - an old weak password must still produce "invalid credentials".
  password: z.string().min(1, "Enter your password").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name").max(100),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
}

/** Every API error has this shape. `fields` maps a form field to its message (validation failures). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
