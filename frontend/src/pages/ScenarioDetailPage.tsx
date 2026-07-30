import { ArrowLeft, Bot, Bug, CirclePlay, Copy, Edit3, Radio, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { api, ApiError } from '../services/api';
import type { TestScenario } from '../types';

export function ScenarioDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<TestScenario | null>(null);
  const [environmentId, setEnvironmentId] = useState<number>(0);
  const [browser, setBrowser] = useState('chromium');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.scenario(Number(id)).then((data) => {
      setScenario(data);
      setEnvironmentId(data.project.environments?.find((environment) => environment.isDefault)?.id ?? data.project.environments?.[0]?.id ?? 0);
    }).catch(() => setError('Cenário não encontrado.'));
  }, [id]);

  async function run() {
    setRunning(true);
    setError('');
    try {
      const execution = await api.runScenario(Number(id), environmentId, browser);
      navigate(`/execucoes/${execution.id}`);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        const details = requestError.details as { executionId?: number } | undefined;
        if (details?.executionId) {
          navigate(`/execucoes/${details.executionId}`);
          return;
        }
      }
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível executar o cenário.');
    } finally {
      setRunning(false);
    }
  }

  async function duplicate() {
    const copy = await api.duplicateScenario(Number(id));
    navigate(`/cenarios/${copy.id}/editar`);
  }

  if (!scenario) return <div className="page"><div className={error ? 'alert alert-error' : 'page-loading'}>{error || 'Carregando cenário...'}</div></div>;

  return (
    <div className="page">
      <Link className="back-link" to="/cenarios"><ArrowLeft size={17} /> Voltar para cenários</Link>
      <div className="page-heading scenario-detail-heading">
        <div><p className="eyebrow">{scenario.code} · {scenario.project.name}</p><h1>{scenario.title}</h1><p>{scenario.description}</p></div>
        <div className="heading-actions"><button className="button button-secondary" onClick={duplicate}><Copy size={16} /> Duplicar</button><Link className="button button-secondary" to={`/cenarios/${scenario.id}/editar`}><Edit3 size={16} /> Editar</Link></div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="panel execution-launcher">
        <div><span className="project-icon"><CirclePlay /></span><div><h2>Executar cenário</h2><p>A execução entra na fila e o worker registra o progresso em segundo plano.</p></div></div>
        <select aria-label="Ambiente de execução" value={environmentId} onChange={(event) => setEnvironmentId(Number(event.target.value))}>{scenario.project.environments?.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}</select>
        <select aria-label="Navegador" value={browser} onChange={(event) => setBrowser(event.target.value)}><option value="chromium">Chromium</option><option value="firefox">Firefox</option><option value="webkit">WebKit</option></select>
        <button className="button button-primary" disabled={running || !environmentId} onClick={run}>{running ? <><RotateCcw className="spin" size={17} /> Adicionando...</> : <><CirclePlay size={17} /> Executar agora</>}</button>
      </section>
      <section className="detail-grid">
        <article className="panel detail-panel"><div className="panel-heading"><div><h2>Contexto</h2><p>Dados funcionais do caso.</p></div></div><dl className="definition-list"><div><dt>Requisito</dt><dd>{scenario.requirement ? `${scenario.requirement.code} · ${scenario.requirement.title}` : 'Não vinculado'}</dd></div><div><dt>Prioridade</dt><dd><Badge value={scenario.priority} /></dd></div><div><dt>Tipo</dt><dd>{scenario.type}</dd></div><div><dt>Timeout</dt><dd>{Math.round(scenario.timeoutMs / 1000)} segundos</dd></div><div><dt>Automação</dt><dd>{scenario.automated ? <span className="automation-chip automated"><Bot size={13} /> Automatizado</span> : 'Manual'}</dd></div></dl></article>
        <article className="panel detail-panel"><div className="panel-heading"><div><h2>Pré-condições</h2><p>Estado necessário para iniciar.</p></div></div><p className="preconditions">{scenario.preconditions || 'Nenhuma pré-condição cadastrada.'}</p></article>
      </section>
      <section className="panel module-panel">
        <div className="panel-heading"><div><h2>Passos</h2><p>Modelo neutro interpretado pelo worker.</p></div><span className="automation-chip"><Radio size={13} /> {scenario.steps?.length ?? 0} ações</span></div>
        <ol className="steps-timeline">{scenario.steps?.map((step) => <li key={step.id ?? step.order}><span>{step.order}</span><div><strong>{step.description}</strong><small>{step.action}{step.target ? ` · ${step.target}` : ''}{step.expected ? ` · esperado: ${step.expected}` : ''}</small></div></li>)}</ol>
      </section>
      <section className="panel module-panel">
        <div className="panel-heading"><div><h2>Histórico de execuções</h2><p>Resultados mais recentes deste cenário.</p></div></div>
        <div className="execution-list">{scenario.executions?.map((execution) => <Link to={`/execucoes/${execution.id}`} key={execution.id}><span className={`execution-status status-${execution.status.toLowerCase()}`}>{execution.status === 'PASSED' ? '✓' : execution.status === 'FAILED' ? '×' : '•'}</span><div><strong>{execution.code}</strong><small>{execution.environment.name} · {execution.browser}</small></div><span>{execution.durationMs ? `${(execution.durationMs / 1000).toFixed(1)}s` : '—'}</span></Link>)}</div>
      </section>
      {scenario.bugs?.length ? <section className="panel module-panel"><div className="panel-heading"><div><h2>Bugs relacionados</h2><p>Defeitos identificados por este cenário.</p></div></div><div className="scenario-list compact">{scenario.bugs.map((bug) => <Link to={`/bugs/${bug.id}/editar`} key={bug.id}><Bug size={18} /><div><strong>{bug.code} · {bug.title}</strong><small>{bug.status}</small></div><Badge value={bug.severity} /></Link>)}</div></section> : null}
    </div>
  );
}
