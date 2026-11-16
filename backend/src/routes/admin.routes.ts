import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { requireAdmin } from '../middleware/auth.js';
import { failure, parseBody, success } from '../utils/response.js';
import {
  accountCreateSchema,
  accountUpdateSchema,
  idSchema,
  kaderCreateSchema,
  kaderUpdateSchema,
} from '../utils/validation.js';

const router = Router();

const hasAdminRole = (roles: unknown): boolean =>
  Array.isArray(roles) &&
  roles.some((entry) => {
    if (!entry || typeof entry !== 'object' || !('role' in entry)) return false;
    return (entry as { role?: Role }).role === Role.ADMIN;
  });

router.use(requireAdmin);

router.get('/overview', async (_req, res, next) => {
  try {
    const [totalAccounts, kader, superAdmin, peserta, jadwal, antrean, pemeriksaan] = await Promise.all([
      prisma.user.count(),
      prisma.userRoleGrant.count({ where: { role: Role.KADER } }),
      prisma.userRoleGrant.count({ where: { role: Role.ADMIN } }),
      prisma.peserta.count(),
      prisma.jadwalPosyandu.count(),
      prisma.antrean.count(),
      prisma.pemeriksaan.count(),
    ]);
    return success(res, { totalAccounts, kader, superAdmin, peserta, jadwal, antrean, pemeriksaan }, 'Super Admin overview loaded');
  } catch (error) { return next(error); }
});

router.get('/accounts', async (_req, res, next) => {
  try {
    const accounts = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        roles: { select: { role: true } },
      },
      orderBy: { name: 'asc' },
    });
    return success(res, accounts.map(({ roles, ...account }) => ({
      ...account,
      roles: roles.map(({ role }) => role),
    })), 'Accounts loaded');
  } catch (error) { return next(error); }
});

router.post('/accounts', async (req, res, next) => {
  try {
    const input = parseBody(accountCreateSchema, req);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await bcrypt.hash(input.password, 12),
        role: input.roles[0],
        roles: { create: input.roles.map((role) => ({ role })) },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        roles: { select: { role: true } },
      },
    });
    return success(res, {
      ...user,
      roles: user.roles.map(({ role }) => role),
    }, 'Account created', 201);
  } catch (error) { return next(error); }
});

router.patch('/accounts/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const input = parseBody(accountUpdateSchema, req);
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id },
        select: { id: true, roles: { select: { role: true } } },
      });
      if (!current) return { kind: 'not-found' as const };

      if (input.roles && current.roles.some(({ role }) => role === Role.ADMIN) &&
        !input.roles.includes(Role.ADMIN) &&
        await tx.userRoleGrant.count({ where: { role: Role.ADMIN } }) <= 1) {
        return { kind: 'last-admin' as const };
      }

      await tx.user.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.email ? { email: input.email.toLowerCase() } : {}),
          ...(passwordHash ? { passwordHash } : {}),
          ...(input.roles ? { role: input.roles[0] } : {}),
          ...(input.roles ? {
            roles: {
              deleteMany: {},
              create: input.roles.map((role) => ({ role })),
            },
          } : {}),
        },
      });
      const user = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          roles: { select: { role: true } },
        },
      });
      if (!user) return { kind: 'not-found' as const };
      return { kind: 'ok' as const, user };
    });
    if (result.kind === 'not-found') return failure(res, 'Account not found', 404);
    if (result.kind === 'last-admin') return failure(res, 'At least one Super Admin account must remain active', 409);
    return success(res, {
      ...result.user,
      roles: result.user.roles.map(({ role }) => role),
    }, 'Account updated');
  } catch (error) { return next(error); }
});

router.delete('/accounts/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    if (id === req.user?.id) return failure(res, 'You cannot remove your own account', 409);
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id },
        select: { roles: { select: { role: true } } },
      });
      if (!current) return 'not-found' as const;
      if (current.roles.some(({ role }) => role === Role.ADMIN) &&
        await tx.userRoleGrant.count({ where: { role: Role.ADMIN } }) <= 1) {
        return 'last-admin' as const;
      }
      await tx.user.delete({ where: { id } });
      return 'deleted' as const;
    });
    if (result === 'not-found') return failure(res, 'Account not found', 404);
    if (result === 'last-admin') return failure(res, 'At least one Super Admin account must remain active', 409);
    return success(res, { id }, 'Account removed');
  } catch (error) { return next(error); }
});

router.get('/kader', async (_req, res, next) => {
  try {
    const grants = await prisma.userRoleGrant.findMany({
      where: { role: Role.KADER },
      select: { user: { select: { id: true, name: true, email: true, createdAt: true, roles: { select: { role: true } } } } },
      orderBy: { user: { name: 'asc' } },
    });

    const users = grants.map(({ user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: Role.KADER,
      adminAccess: hasAdminRole(user.roles),
      createdAt: user.createdAt,
    }));
    return success(res, users, 'Kader accounts loaded');
  } catch (error) { return next(error); }
});

router.post('/kader', async (req, res, next) => {
  try {
    const input = parseBody(kaderCreateSchema, req);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await bcrypt.hash(input.password, 12),
        role: Role.KADER,
        roles: { create: [{ role: Role.KADER }, ...(input.adminAccess ? [{ role: Role.ADMIN }] : [])] },
      },
      select: { id: true, name: true, email: true, createdAt: true, roles: { select: { role: true } } },
    });
    return success(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: Role.KADER,
      adminAccess: hasAdminRole(user.roles),
      createdAt: user.createdAt,
    }, 'Kader account created', 201);
  } catch (error) { return next(error); }
});

router.patch('/kader/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const input = parseBody(kaderUpdateSchema, req);
    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : undefined;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.userRoleGrant.findUnique({ where: { userId_role: { userId: id, role: Role.KADER } } });
      if (!current) return { kind: 'not-found' as const };
      if (input.adminAccess === false) {
        const adminGrant = await tx.userRoleGrant.findUnique({ where: { userId_role: { userId: id, role: Role.ADMIN } } });
        if (adminGrant && await tx.userRoleGrant.count({ where: { role: Role.ADMIN } }) <= 1) {
          return { kind: 'last-admin' as const };
        }
      }
      await tx.user.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.email ? { email: input.email.toLowerCase() } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      if (input.adminAccess === true) {
        await tx.userRoleGrant.upsert({
          where: { userId_role: { userId: id, role: Role.ADMIN } },
          create: { userId: id, role: Role.ADMIN },
          update: {},
        });
      } else if (input.adminAccess === false) {
        await tx.userRoleGrant.deleteMany({ where: { userId: id, role: Role.ADMIN } });
      }
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, createdAt: true, roles: { select: { role: true } } },
      });
      if (!user) return { kind: 'not-found' as const };
      return { kind: 'ok' as const, user };
    });
    if (result.kind === 'not-found') return failure(res, 'Kader account not found', 404);
    if (result.kind === 'last-admin') return failure(res, 'At least one Super Admin account must remain active', 409);
    return success(res, {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: Role.KADER,
      adminAccess: hasAdminRole(result.user.roles),
      createdAt: result.user.createdAt,
    }, 'Kader account updated');
  } catch (error) { return next(error); }
});

router.delete('/kader/:id', async (req, res, next) => {
  try {
    const id = idSchema.parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const kaderGrant = await tx.userRoleGrant.findUnique({ where: { userId_role: { userId: id, role: Role.KADER } } });
      if (!kaderGrant) return false;
      const adminGrant = await tx.userRoleGrant.findUnique({ where: { userId_role: { userId: id, role: Role.ADMIN } } });
      if (adminGrant) {
        await tx.userRoleGrant.delete({ where: { userId_role: { userId: id, role: Role.KADER } } });
      } else {
        await tx.user.delete({ where: { id } });
      }
      return true;
    });
    if (!result) return failure(res, 'Kader account not found', 404);
    return success(res, { id }, 'Kader access removed');
  } catch (error) { return next(error); }
});

export default router;
