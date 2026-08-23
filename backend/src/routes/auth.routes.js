import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  clientSignupSchema,
  loginSchema,
  staffCreateSchema,
  statusUpdateSchema,
  uuidParamSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Public endpoints
router.post('/client/signup', validate({ body: clientSignupSchema }), controller.clientSignup);
router.post('/login', validate({ body: loginSchema }), controller.login);

// Authenticated endpoints
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.me);

// Admin-only staff management
router.post(
  '/staff',
  authenticate,
  requireRole('admin'),
  validate({ body: staffCreateSchema }),
  controller.createStaff
);
router.patch(
  '/staff/:userId/status',
  authenticate,
  requireRole('admin'),
  validate({ params: uuidParamSchema, body: statusUpdateSchema }),
  controller.setStaffStatus
);

export default router;
