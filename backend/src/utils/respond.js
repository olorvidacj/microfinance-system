/**
 * Consistent response envelope (spec §22):
 *   success -> { success: true, data, meta? }
 *   failure -> { success: false, message, errorCode, details? }
 */
export const ok = (res, data, statusCode = 200, meta) => {
  const payload = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

export const fail = (res, statusCode, message, errorCode, details) => {
  const payload = { success: false, message, errorCode };
  if (details !== undefined) payload.details = details;
  return res.status(statusCode).json(payload);
};
