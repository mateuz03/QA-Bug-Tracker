import { Prisma, ProjectRole, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http-error.js';

type AuthenticatedUser = { id: number; role: Role };

const roleRank: Record<ProjectRole, number> = {
  VIEWER: 1,
  MANAGER: 2,
  OWNER: 3
};

export function accessibleProjectsWhere(user: AuthenticatedUser): Prisma.ProjectWhereInput {
  if (user.role === Role.ADMIN) return {};
  return {
    OR: [
      { ownerId: user.id },
      { members: { some: { userId: user.id } } }
    ]
  };
}

export async function requireProjectRole(
  user: AuthenticatedUser,
  projectId: number,
  minimumRole: ProjectRole = ProjectRole.VIEWER
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      members: { where: { userId: user.id }, select: { role: true }, take: 1 }
    }
  });
  if (!project) throw new HttpError(404, 'Projeto não encontrado.');

  const effectiveRole = user.role === Role.ADMIN || project.ownerId === user.id
    ? ProjectRole.OWNER
    : project.members[0]?.role;
  if (!effectiveRole || roleRank[effectiveRole] < roleRank[minimumRole]) {
    throw new HttpError(403, 'Você não possui acesso suficiente a este projeto.');
  }
  return effectiveRole;
}

export async function recordAudit(input: {
  projectId: number;
  actorId: number;
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      projectId: input.projectId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId == null ? null : String(input.entityId),
      ...(input.details === undefined ? {} : { details: input.details })
    }
  });
}
