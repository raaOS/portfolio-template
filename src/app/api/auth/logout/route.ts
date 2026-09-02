/**
 * Customer Auth — Logout API
 * POST /api/auth/logout
 * Clears auth cookies.
 */
import { createLogoutResponse } from '@/crud/shared/auth/login';

export async function POST() {
  return createLogoutResponse();
}
