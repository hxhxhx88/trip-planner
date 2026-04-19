import type { ZodError } from "zod";

export type ActionErrorCode = "not_found" | "validation" | "conflict" | "internal";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type Result<T = void, E = ActionError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function ok(): Result<void>;
export function ok<T>(data: T): Result<T>;
export function ok<T>(data?: T): Result<T> {
  return { ok: true, data: data as T };
}

export function err(error: ActionError): Result<never> {
  return { ok: false, error };
}

export function zodErr(e: ZodError): ActionError {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { code: "validation", message: "Invalid input", fieldErrors };
}
