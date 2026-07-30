import { AlertTriangle, ArrowRight, CheckCircle2, FolderKanban, Plus, TestTube2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { Bug, DashboardData } from '../types';
import { Badge, labels } from '../components/Badge';

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recent, setRecent] = useState<Bug[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.dashboard(), api.bugs('pageSize=5')])
      .then(([data, bugs]) => {
        setDashboard(data);
        setRecent(bugs.items);
      })
      .catch(() => setError('Não foi possível carregar os indicadores.'));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!dashboard) return <div className="page-loading">Carregando visão geral...</div>;

  const cards = [
    { label: 'Projetos ativos', value: dashboard.summary.projects, note: 'produtos acompanhados', icon: FolderKanban, tone: 'violet' },
    { label: 'Cenários ativos', value: dashboard.summary.scenarios, note: `${dashboard.summary.automationRate}% automatizados`, icon: TestTube2, tone: 'blue' },
    { label: 'Taxa de aprovação', value: `${dashboard.summary.passRate}%`, note: `${dashboard.summary.executions} execuções realizadas`, icon: CheckCircle2, tone: 'green' },
    { label: 'Bugs em aberto', value: dashboard.summary.open, note: `${dashboard.summary.critical} críticos`, icon: AlertTriangle, tone: 'red' }
  ];
  const maxSeverity = Math.max(...dashboard.bySeverity.map((item) => item.value), 1);

  return (
    <div className="page">
      <div className="page-heading">
        <div><p className="eyebrow">Workspace de qualidade</p><h1>Visão geral</h1><p>Acompanhe a saúde das entregas e os pontos que pedem ação.</p></div>
        <Link className="button button-primary" to="/bugs/novo"><Plus size={18} /> Registrar bug</Link>
      </div>
      <section className="metric-grid">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <span className={`metric-icon ${tone}`}><Icon /></span>
            <span>{label}</span><strong>{value}</strong><small>{note}</small>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><h2>Ocorrências por severidade</h2><p>Distribuição atual do backlog</p></div></div>
          <div className="bar-chart">
            {dashboard.bySeverity.map((item) => (
              <div className="bar-item" key={item.label}>
                <div className="bar-value">{item.value}</div>
                <div className={`bar bar-${item.label.toLowerCase()}`} style={{ height: `${Math.max(18, (item.value / maxSeverity) * 150)}px` }} />
                <span>{labels[item.label]}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel status-panel">
          <div className="panel-heading"><div><h2>Fluxo do backlog</h2><p>Status das ocorrências</p></div></div>
          <div className="status-list">
            {dashboard.byStatus.map((item) => {
              const percentage = dashboard.summary.total ? Math.round((item.value / dashboard.summary.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div><Badge value={item.label} /><strong>{item.value}</strong></div>
                  <div className="progress"><span style={{ width: `${percentage}%` }} /></div>
                </div>
              );
            })}
          </div>
        </article>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <div><h2>Ocorrências recentes</h2><p>Últimas atualizações do workspace</p></div>
          <Link className="text-link" to="/bugs">Ver todas <ArrowRight size={16} /></Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Ocorrência</th><th>Severidade</th><th>Status</th><th>Responsável</th></tr></thead>
            <tbody>
              {recent.map((bug) => (
                <tr key={bug.id}>
                  <td><Link className="code-link" to={`/bugs/${bug.id}/editar`}>{bug.code}</Link></td>
                  <td><strong>{bug.title}</strong><small>{new Date(bug.createdAt).toLocaleDateString('pt-BR')}</small></td>
                  <td><Badge value={bug.severity} /></td><td><Badge value={bug.status} /></td>
                  <td>{bug.assignee?.name ?? 'Não atribuído'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
