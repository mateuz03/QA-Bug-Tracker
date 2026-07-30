import { ProjectStatus, RequirementStatus, Role } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { HttpError } from '../utils/http-error.js';

export const projectsRouter = Router();
projectsRouter.use(authenticate);

projectsRouter.get('/', async (_req, res) => {
  const projects = await prisma.project.findMany({
    include: {
      owner: { select: { id: true, name: true, email: true } },
      environments: { orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] },
      _count: { select: { requirements: true, scenarios: true, executions: true, bugs: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  const result = await Promise.all(projects.map(async (project) => {
    const [passed, finished] = await Promise.all([
      prisma.testExecution.count({ where: { projectId: project.id, status: 'PASSED' } }),
      prisma.testExecution.count({ where: { projectId: project.id, status: { in: ['PASSED', 'FAILED', 'BLOCKED'] } } })
    ]);
    return {
      ...project,
      passRate: finished ? Math.round((passed / finished) * 100) : null
    };
  }));

  res.json(result);
});

projectsRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      environments: { orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] },
      requirements: {
        include: { _count: { select: { scenarios: true } } },
        orderBy: { code: 'asc' }
      },
      scenarios: {
        include: {
          requirement: { select: { id: true, code: true, title: true } },
          _count: { select: { steps: true, executions: true, bugs: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 8
      },
      executions: {
        include: { scenario: { select: { code: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      _count: { select: { requirements: true, scenarios: true, executions: true, bugs: true } }
    }
  });
  if (!project) throw new HttpError(404, 'Projeto não encontrado.');
  res.json(project);
});

const environmentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  baseUrl: z.string().trim().url(),
  isDefault: z.boolean().optional()
});

const createProjectSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  repositoryUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.ACTIVE),
  ownerId: z.number().int().positive().optional(),
  environments: z.array(environmentSchema).min(1)
});

projectsRouter.post('/', authorize(Role.ADMIN), async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  const latest = await prisma.project.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const code = `PRJ-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`;
  const project = await prisma.project.create({
    data: {
      code,
      name: data.name,
      description: data.description,
      repositoryUrl: data.repositoryUrl || null,
      status: data.status,
      ownerId: data.ownerId ?? req.user!.id,
      environments: { create: data.environments }
    },
    include: { environments: true, owner: { select: { id: true, name: true, email: true } } }
  });
  res.status(201).json(project);
});

const requirementSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(5000),
  status: z.nativeEnum(RequirementStatus).default(RequirementStatus.READY)
});

projectsRouter.post('/:id/requirements', async (req, res) => {
  const projectId = z.coerce.number().int().positive().parse(req.params.id);
  const data = requirementSchema.parse(req.body);
  if (!(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) {
    throw new HttpError(404, 'Projeto não encontrado.');
  }
  const latest = await prisma.requirement.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  const code = `REQ-${String((latest?.id ?? 0) + 1).padStart(3, '0')}`;
  const requirement = await prisma.requirement.create({ data: { ...data, code, projectId } });
  res.status(201).json(requirement);
});
