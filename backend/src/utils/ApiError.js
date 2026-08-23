export class ApiError extends Error {
  constructor(statusCode, message, errorCode = 'ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace?.(this, ApiError);
  }
}

export const badRequest = (message, code = 'BAD_REQUEST') =>
  new ApiError(400, message, code);

export const unauthorized = (message = 'Authentication required', code = 'AUTH_REQUIRED') =>
  new ApiError(401, message, code);

export const forbidden = (
  message = 'You do not have permission to perform this action',
  code = 'FORBIDDEN'
) => new ApiError(403, message, code);

export const notFound = (message = 'Resource not found', code = 'NOT_FOUND') =>
  new ApiError(404, message, code);

export const conflict = (message, code = 'CONFLICT') => new ApiError(409, message, code);

export const unprocessable = (message, code = 'UNPROCESSABLE') =>
  new ApiError(422, message, code);

export const serviceUnavailable = (
  message = 'Upstream service unavailable',
  code = 'SERVICE_UNAVAILABLE'
) => new ApiError(503, message, code);
