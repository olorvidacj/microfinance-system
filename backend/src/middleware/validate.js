/**
 * Per-route schema validation. Usage:
 *   router.post('/x', validate({ body: someSchema }), handler)
 * Parsed/normalized values replace req.body / req.params / req.query.
 * ZodErrors propagate to the central error handler -> 422 VALIDATION_ERROR.
 */
export const validate = (schemas) => (req, _res, next) => {
  if (schemas.body) {
    const result = schemas.body.safeParse(req.body ?? {});
    if (!result.success) return next(result.error);
    req.body = result.data;
  }
  if (schemas.params) {
    const result = schemas.params.safeParse(req.params ?? {});
    if (!result.success) return next(result.error);
    req.params = result.data;
  }
  if (schemas.query) {
    const result = schemas.query.safeParse(req.query ?? {});
    if (!result.success) return next(result.error);
    req.validatedQuery = result.data;
  }
  next();
};
