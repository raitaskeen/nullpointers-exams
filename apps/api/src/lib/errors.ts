import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodError } from "zod";

/** Throw this anywhere; the global error handler turns it into the shared `ApiErrorBody` shape. */
export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }

  static badRequest(message: string, fields?: Record<string, string>) {
    return new AppError(400, "bad_request", message, fields);
  }
  static unauthorized(message = "Please sign in to continue.") {
    return new AppError(401, "unauthorized", message);
  }
  static forbidden(message = "You don't have permission to do that.") {
    return new AppError(403, "forbidden", message);
  }
  static notFound(what = "Resource") {
    return new AppError(404, "not_found", `${what} not found.`);
  }
  static conflict(message: string, fields?: Record<string, string>) {
    return new AppError(409, "conflict", message, fields);
  }
  static tooMany() {
    return new AppError(429, "rate_limited", "Too many attempts. Wait a minute and try again.");
  }
  static validation(err: ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return new AppError(422, "validation_failed", "Some fields need attention.", fields);
  }
}
