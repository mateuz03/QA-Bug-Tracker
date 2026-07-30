import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.')
});

authRouter.post('/login', async (req, res) => {
  const credentials = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { email: credentials.email.toLowerCase() }
  });

  if (!user || !user.active || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
    throw new HttpError(401, 'E-mail ou senha inválidos.');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, active: true }
  });

  if (!user?.active) throw new HttpError(401, 'Usuário inativo.');
  res.json(user);
});

authRouter.post('/logout', authenticate, (_req, res) => {
  res.status(204).send();
});
