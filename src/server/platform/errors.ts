export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROCESSING_FAILED";

const DEFAULT_STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  PROCESSING_FAILED: 500,
};

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: {
      status?: number;
      details?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? DEFAULT_STATUS_BY_CODE[code];
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
