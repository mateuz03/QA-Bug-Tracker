import type { BugStatus, Priority, Severity } from '../types';

const labels: Record<BugStatus | Priority | Severity, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  IN_REVIEW: 'Em revisão',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
  CRITICAL: 'Crítica'
};

export function Badge({ value }: { value: BugStatus | Priority | Severity }) {
  return <span className={`badge badge-${value.toLowerCase()}`}>{labels[value]}</span>;
}

export { labels };
