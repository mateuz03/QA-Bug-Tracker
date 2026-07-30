import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' }
  });
  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().trim().min(3).max(80),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
  role: z.nativeEnum(Role).default(Role.ANALYST)
});

usersRouter.post('/', authorize(Role.ADMIN), async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const { password, ...userData } = data;
  const user = await prisma.user.create({
    data: { ...userData, passwordHash: await bcrypt.hash(password, 10) },
    select: { id: true, name: true, email: true, role: true }
  });
  res.status(201).json(user);
});
