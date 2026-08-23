import { ZodError } from 'zod';
import { fail } from '../utils/respond.js';

export function notFoundHandler(req, res) {
  return fail(
    res,
    404,
    `Route ${req.method} ${req.originalUrl} not found`,
    'ROUTE_NOT_FOUND'
  );
}

/**
 * Centralized error handler (spec §22): every failure leaves the API as
 * { success:false, message, errorCode } — internal details never leak.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // Body-parser failures
  if (err?.type === 'entity.parse.failed') {
    return fail(res, 400, 'Request body is not valid JSON', 'INVALID_JSON');
  }
  if (err?.type === 'entity.too.large') {
    return fail(res, 413, 'Request payload too large', 'PAYLOAD_TOO_LARGE');
  }

  // Schema validation
  if (err instanceof ZodError) {
    return fail(
      res,
      422,
      'Validation failed',
      'VALIDATION_ERROR',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    );
  }

  // Known application errors
  if (err?.name === 'ApiError' || Number.isInteger(err?.statusCode)) {
    const details = Array.isArray(err.details) ? err.details : undefined;
    return fail(res, err.statusCode, err.message, err.errorCode || 'ERROR', details);
  }

  // PostgREST unique/foreign-key violations surfaced by supabase-js
  if (err?.code === '23505') {
    return fail(res, 409, 'Duplicate resource', 'DUPLICATE_RESOURCE');
  }
  if (err?.code === '23503') {
    return fail(res, 409, 'Related resource does not exist', 'FK_VIOLATION');
  }

  console.error('[error]', err);
  return fail(res, 500, 'Internal server error', 'INTERNAL_ERROR');
}
