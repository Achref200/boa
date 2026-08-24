/**
 * Errors that are safe to show a customer, and errors that are not.
 *
 * Anything thrown as an `AppError` carries a stable machine code plus a
 * translation key. Everything else is logged server-side and surfaces as a
 * generic message, so a driver error can never leak a table name or a
 * connection string into a page.
 */
export type ErrorCode =
  | 'validation_failed'
  | 'not_found'
  | 'unauthenticated'
  | 'forbidden'
  | 'rate_limited'
  | 'conflict'
  | 'out_of_stock'
  | 'slot_unavailable'
  | 'cart_empty'
  | 'cart_changed'
  | 'invalid_credentials'
  | 'account_locked'
  | 'payment_failed'
  | 'unavailable';

const STATUS: Record<ErrorCode, number> = {
  validation_failed: 422,
  not_found: 404,
  unauthenticated: 401,
  forbidden: 403,
  rate_limited: 429,
  conflict: 409,
  out_of_stock: 409,
  slot_unavailable: 409,
  cart_empty: 400,
  cart_changed: 409,
  invalid_credentials: 401,
  account_locked: 423,
  payment_failed: 402,
  unavailable: 503,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const notFound = (what = 'resource') => new AppError('not_found', `${what} not found`);
export const forbidden = (why = 'not permitted') => new AppError('forbidden', why);
export const conflict = (why: string, details?: Record<string, unknown>) =>
  new AppError('conflict', why, details);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** A typed result, so server actions never throw across the RSC boundary. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export function fail(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return fieldErrors ? { ok: false, code, message, fieldErrors } : { ok: false, code, message };
}
