import { ArrowRight, Filter, TimerReset } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { TestExecution } from '../types';

const statusLabels = {
  QUEUED: 'Na fila',
  RUNNING: 'Executando',
  PASSED: 'Aprovado',
  FAILED: 'Reprovado',
  BLOCKED: 'Bloqueado',
  CANCELLED: 'Cancelado'
};

export function ExecutionsPage() {
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.executions().then(setExecutions).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filtered = status ? executions.filter((execution) => execution.status === status) : executions;
  const passed = executions.filter((execution) => execution.status === 'PASSED').length;
  const failed = executions.filter((execution) => execution.status === 'FAILED').length;
  const finished = passed + failed;

  return (
    <div className="page">
      <div className="page-heading"><div><p className="eyebrow">Histórico de automação</p><h1>Execuções</h1><p>Acompanhe o resultado por passo, evidências e bugs gerados.</p></div></div>
      <section className="execution-summary">
        <div className="panel"><span>Total</span><strong>{executions.length}</strong></div>
        <div className="panel success"><span>Aprovadas</span><strong>{passed}</strong></div>
        <div className="panel failure"><span>Reprovadas</span><strong>{failed}</strong></div>
        <div className="panel"><span>Taxa de aprovação</span><strong>{finished ? Math.round((passed / finished) * 100) : 0}%</strong></div>
      </section>
      <section className="panel filter-panel execution-filter"><div className="filter-title"><Filter size={17} /> Resultado</div><select aria-label="Filtrar resultado" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></section>
      <section className="panel">
        {loading ? <div className="page-loading">Carregando execuções...</div> : <div className="table-wrap"><table><thead><tr><th>Execução</th><th>Cenário</th><th>Projeto</th><th>Ambiente</th><th>Navegador</th><th>Resultado</th><th>Duração</th><th></th></tr></thead><tbody>{filtered.map((execution) => (
          <tr key={execution.id}>
            <td><Link className="code-link" to={`/execucoes/${execution.id}`}>{execution.code}</Link><small>{new Date(execution.createdAt).toLocaleString('pt-BR')}</small></td>
            <td><strong>{execution.scenario.title}</strong><small>{execution.scenario.code}</small></td>
            <td>{execution.project.name}</td><td>{execution.environment.name}</td><td>{execution.browser}</td>
            <td><span className={`execution-pill execution-${execution.status.toLowerCase()}`}>{statusLabels[execution.status]}</span></td>
            <td>{execution.durationMs ? <span className="duration"><TimerReset size={14} /> {(execution.durationMs / 1000).toFixed(1)}s</span> : '—'}</td>
            <td><Link className="icon-button" aria-label={`Abrir ${execution.code}`} to={`/execucoes/${execution.id}`}><ArrowRight size={17} /></Link></td>
          </tr>
        ))}</tbody></table></div>}
      </section>
    </div>
  );
}
