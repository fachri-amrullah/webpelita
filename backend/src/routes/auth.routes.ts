import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { createToken, sessionCookieName, sessionCookieOptions, authenticate } from '../middleware/auth.js';
import { failure, parseBody, success } from '../utils/response.js';
import { loginSchema } from '../utils/validation.js';

const router = Router();
router.post('/login', async (req, res, next) => {
  try {
    const input = parseBody(loginSchema, req);
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { roles: { select: { role: true } } },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash)) || !user.roles.some(({ role }) => role === input.role)) {
      return failure(res, 'Email, password, or selected role is incorrect', 401);
    }
    const token = await createToken({ id: user.id, email: user.email, name: user.name, role: input.role });
    res.cookie(sessionCookieName, token, sessionCookieOptions);
    return success(res, { user: { id: user.id, name: user.name, email: user.email, role: input.role } }, 'Login successful');
  } catch (error) { return next(error); }
});
router.get('/me', authenticate, (req, res) => success(res, req.user, 'Current user loaded'));
router.post('/logout', (_req, res) => {
  res.clearCookie(sessionCookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  return success(res, null, 'Logout successful');
});
export default router;
