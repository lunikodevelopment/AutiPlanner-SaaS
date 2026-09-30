/**
 * Errors that are safe to show a client.
 *
 * Anything that is not an ApiError is treated as a bug: it is logged and
 * reported as a generic 500 so internal details never leak.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const unauthorized = (message = "Not signed in") => new ApiError(401, "unauthorized", message);
export const forbidden = (message: string) => new ApiError(403, "forbidden", message);
export const notFound = (message = "Not found") => new ApiError(404, "not_found", message);
export const conflict = (message: string, code = "conflict") => new ApiError(409, code, message);
export const tooManyRequests = (message: string) => new ApiError(429, "too_many_requests", message);
export const unavailable = (message: string) => new ApiError(503, "unavailable", message);
