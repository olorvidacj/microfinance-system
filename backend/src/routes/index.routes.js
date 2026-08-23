import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import authRoutes from './auth.routes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  let database = 'unreachable';
  try {
    const probe = await Promise.race([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
    ]);
    if (!probe.error) database = 'reachable';
  } catch {
    // keep default
  }
  res.json({
    success: true,
    data: { service: 'csft-backend', status: 'ok', database, timestamp: new Date().toISOString() },
  });
});

router.use('/auth', authRoutes);

export default router;
