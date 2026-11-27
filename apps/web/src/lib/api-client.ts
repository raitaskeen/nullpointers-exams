import type { ApiErrorBody } from "@np/shared";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
  ) {
    super(body?.error.message ?? `Request failed (${status})`);
  }
  get fields() {
    return this.body?.error.fields ?? {};
  }
}

/**
 * Every call goes to same-origin `/api/*`. Next.js rewrites that to the Cloudflare Worker, so the httpOnly
 * session cookie just works and there is no CORS. JS never sees the token.
 */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  // Always JSON: the API's CSRF guard rejects form-encoded cross-site posts.
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers,
    credentials: "same-origin",
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // non-JSON error (network/proxy)
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    if (err.status >= 500 || !err.body) return fallback;
    return err.message || fallback;
  }
  if (err instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return fallback;
}

/** Push server-side field errors (422/409) into react-hook-form so they appear under the right input. */
export function applyFieldErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>): boolean {
  if (!(err instanceof ApiError)) return false;
  const entries = Object.entries(err.fields).filter(([k]) => k !== "_");
  for (const [field, message] of entries) setError(field as Path<T>, { type: "server", message });
  return entries.length > 0;
}
