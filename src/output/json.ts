import type { TendrilsError } from "../errors.js";

export interface SuccessEnvelope<T = unknown> {
  ok: true;
  data: T;
  message?: string;
}

export interface ErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type Envelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

export function success<T>(data: T, message?: string): SuccessEnvelope<T> {
  return { ok: true, data, ...(message ? { message } : {}) };
}

export function errorEnvelope(err: TendrilsError): ErrorEnvelope {
  return {
    ok: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  };
}
