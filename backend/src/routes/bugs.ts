import { BugStatus, Prisma, Priority, Role, Severity } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';

export const bugsRouter = Router();

bugsRouter.use(authenticate);

const nullableText = z.string().trim().max(2000).optional().nullable();
const bugSchema = z.object({
  title: z.string().trim().min(5, 'O título deve ter ao menos 5 caracteres.').max(140),
  description: z.string().trim().min(10, 'A descrição deve ter ao menos 10 caracteres.').max(5000),
  reproduction: nullableText,
  expectedResult: nullableText,
  actualResult: nullableText,
  severity: z.nativeEnum(Severity),
  priority: z.nativeEnum(Priority),
  environment: z.string().trim().max(80).optional().nullable(),
  browser: z.string().trim().max(80).optional().nullable(),
  status: z.nativeEnum(BugStatus).optional(),
  evidenceUrl: z.string().trim().max(2000).optional().nullable(),
  technicalError: nullableText,
  assigneeId: z.number().int().positive().optional().nullable(),
  projectId: z.number().int().positive().optional().nullable(),
  scenarioId: z.number().int().positive().optional().nullable(),
  executionId: z.number().int().positive().optional().nullable()
});

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().optional(),
  status: z.nativeEnum(BugStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  severity: z.nativeEnum(Severity).optional(),
  assigneeId: z.coerce.number().int().positive().optional()
});

const bugInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  reporter: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, code: true, name: true } },
  scenario: { select: { id: true, code: true, title: true } },
  execution: { select: { id: true, code: true, status: true } }
} satisfies Prisma.BugInclude;

bugsRouter.get('/', async (req, res) => {
  const query = listSchema.parse(req.query);
  const where: Prisma.BugWhereInput = {
    ...(query.search ? { title: { contains: query.search } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.severity ? { severity: query.severity } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {})
  };

  const [items, total] = await prisma.$transaction([
    prisma.bug.findMany({
      where,
      include: bugInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.bug.count({ where })
  ]);

  res.json({
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    }
  });
});

bugsRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const bug = await prisma.bug.findUnique({ where: { id }, include: bugInclude });
  if (!bug) throw new HttpError(404, 'Bug não encontrado.');
  res.json(bug);
});

bugsRouter.post('/', async (req, res) => {
  const data = bugSchema.parse(req.body);
  const latest = await prisma.bug.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const code = `BUG-${1001 + (latest?.id ?? 0)}`;
  const bug = await prisma.bug.create({
    data: {
      ...data,
      evidenceUrl: data.evidenceUrl || null,
      code,
      reporterId: req.user!.id
    },
    include: bugInclude
  });
  res.status(201).json(bug);
});

bugsRouter.put('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = bugSchema.parse(req.body);
  const bug = await prisma.bug.update({
    where: { id },
    data: { ...data, evidenceUrl: data.evidenceUrl || null },
    include: bugInclude
  });
  res.json(bug);
});

bugsRouter.patch('/:id/status', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { status } = z.object({ status: z.nativeEnum(BugStatus) }).parse(req.body);
  const bug = await prisma.bug.update({
    where: { id },
    data: { status },
    include: bugInclude
  });
  res.json(bug);
});

bugsRouter.delete('/:id', authorize(Role.ADMIN), async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await prisma.bug.delete({ where: { id } });
  res.status(204).send();
});
