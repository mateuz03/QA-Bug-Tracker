import { BugStatus, Severity } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', authenticate, async (_req, res) => {
  const statuses = Object.values(BugStatus);
  const severities = Object.values(Severity);
  const [total, open, inProgress, critical, resolved, statusCounts, severityCounts, projects, scenarios, automated, executions, passed] =
    await Promise.all([
      prisma.bug.count(),
      prisma.bug.count({ where: { status: 'OPEN' } }),
      prisma.bug.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.bug.count({ where: { severity: 'CRITICAL', status: { not: 'CLOSED' } } }),
      prisma.bug.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
      Promise.all(statuses.map((status) => prisma.bug.count({ where: { status } }))),
      Promise.all(severities.map((severity) => prisma.bug.count({ where: { severity } }))),
      prisma.project.count({ where: { status: 'ACTIVE' } }),
      prisma.testScenario.count({ where: { status: 'ACTIVE' } }),
      prisma.testScenario.count({ where: { status: 'ACTIVE', automated: true } }),
      prisma.testExecution.count(),
      prisma.testExecution.count({ where: { status: 'PASSED' } })
    ]);

  res.json({
    summary: {
      total,
      open,
      inProgress,
      critical,
      resolved,
      projects,
      scenarios,
      automated,
      automationRate: scenarios ? Math.round((automated / scenarios) * 100) : 0,
      executions,
      passRate: executions ? Math.round((passed / executions) * 100) : 0
    },
    byStatus: statuses.map((label, index) => ({ label, value: statusCounts[index] ?? 0 })),
    bySeverity: severities.map((label, index) => ({ label, value: severityCounts[index] ?? 0 }))
  });
});
