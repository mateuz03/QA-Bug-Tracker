import { ArrowLeft, Ban, CalendarClock, CheckCircle2, CirclePlay, Clock3, ExternalLink, FlaskConical, PlayCircle, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../services/api';
import type { CycleScenarioResult, ExecutionStatus, TestCycle } from '../types';

const cycleLabels = { PLANNED: 'Planejado', RUNNING: 'Em execução', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' };
const resultLabels: Record<CycleScenarioResult | ExecutionStatus, string> = {
  NOT_RUN: 'Não executado', QUEUED: 'Na fila', RUNNING: 'Executando', PASSED: 'Aprovado', FAILED: 'Reprovado', BLOCKED: 'Bloqueado', CANCELLED: 'Cancelado'
};

function toLocalDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function TestCycleDetailPage() {
  const { id } = useParams();
  const [cycle, setCycle] = useState<TestCycle | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const data = await api.testCycle(Number(id));
      setCycle(data);
      setScheduleAt(toLocalDateTime(data.scheduledAt));
      setNotes((current) => Object.fromEntries(data.scenarios.map((item) => [item.scenarioId, current[item.scenarioId] ?? item.notes ?? ''])));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível carregar o ciclo.');
    } finally {
      if (!background) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (cycle?.status !== 'RUNNING') return;
    const timer = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(timer);
  }, [cycle?.status, load]);

  async function updateManualResult(scenarioId: number, result: CycleScenarioResult) {
    setSaving(scenarioId);
    setError('');
    try {
      await api.updateCycleScenarioResult(Number(id), scenarioId, result, notes[scenarioId]);
      await load(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível registrar o resultado.');
    } finally {
      setSaving(null);
    }
  }

  async function saveSchedule(scheduledAt: string | null) {
    setScheduleSaving(true);
    setError('');
    try {
      await api.scheduleTestCycle(Number(id), scheduledAt);
      await load(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível atualizar o agendamento.');
    } finally {
      setScheduleSaving(false);
    }
  }

  async function startCycle() {
    setScheduleSaving(true);
    setError('');
    try {
      await api.startTestCycle(Number(id));
      await load(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível iniciar o ciclo.');
    } finally {
      setScheduleSaving(false);
    }
  }

  if (loading) return <div className="page-loading">Carregando ciclo...</div>;
  if (!cycle) return <div className="page"><div className="alert alert-error">{error || 'Ciclo não encontrado.'}</div></div>;

  return (
    <div className="page cycle-detail-page">
      <Link className="back-link" to="/planos"><ArrowLeft size={15} /> Voltar para planos</Link>
      <section className="panel cycle-hero">
        <div>
          <p className="eyebrow">{cycle.plan?.code} · {cycle.plan?.project?.name}</p>
          <h1>{cycle.name}</h1>
          <p>{cycle.description || `Ciclo ${cycle.code} executado em ${cycle.environment.name}.`}</p>
        </div>
        <div className="cycle-hero-meta">
          <span>Status<strong>{cycleLabels[cycle.status]}</strong></span>
          <span>Ambiente<strong>{cycle.environment.name}</strong></span>
          <span>Navegador<strong>{cycle.browser}</strong></span>
          <span>Release<strong>{cycle.plan?.releaseVersion ? `v${cycle.plan.releaseVersion}` : '—'}</strong></span>
          {cycle.scheduledAt && <span>Agendado<strong>{new Date(cycle.scheduledAt).toLocaleString('pt-BR')}</strong></span>}
        </div>
      </section>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {cycle.status === 'PLANNED' && (
        <section className="panel cycle-schedule-panel">
          <div><span className="cycle-schedule-icon"><CalendarClock /></span><div><h2>Agendamento do ciclo</h2><p>Defina quando o worker deve iniciar a regressão ou execute a rodada imediatamente.</p></div></div>
          <label>Data e hora<input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></label>
          <div className="cycle-schedule-actions">
            <button className="button button-secondary" disabled={scheduleSaving || !scheduleAt} onClick={() => void saveSchedule(new Date(scheduleAt).toISOString())}><CalendarClock size={15} /> {cycle.scheduledAt ? 'Reagendar' : 'Agendar'}</button>
            {cycle.scheduledAt && <button className="button button-secondary" disabled={scheduleSaving} onClick={() => void saveSchedule(null)}><Trash2 size={15} /> Remover</button>}
            <button className="button button-primary" disabled={scheduleSaving} onClick={() => void startCycle()}><PlayCircle size={15} /> Executar agora</button>
          </div>
        </section>
      )}

      <section className="cycle-summary-grid">
        <article className="panel"><span>Progresso</span><strong>{cycle.summary.progress}%</strong><div className="cycle-progress"><span style={{ width: `${cycle.summary.progress}%` }} /></div></article>
        <article className="panel summary-passed"><span>Aprovados</span><strong>{cycle.summary.passed}</strong></article>
        <article className="panel summary-failed"><span>Reprovados</span><strong>{cycle.summary.failed}</strong></article>
        <article className="panel"><span>Bloqueados</span><strong>{cycle.summary.blocked}</strong></article>
        <article className="panel"><span>Não executados</span><strong>{cycle.summary.notRun}</strong></article>
      </section>

      <section className="panel cycle-scenarios-panel">
        <div className="panel-heading"><div><h2>Cenários do ciclo</h2><p>Resultados automáticos vêm do worker; casos manuais podem ser registrados abaixo.</p></div><span className="code-link">{cycle.summary.executed}/{cycle.summary.total}</span></div>
        <div className="cycle-scenario-list">
          {cycle.scenarios.map((item) => {
            const scenario = item.scenario;
            if (!scenario) return null;
            const execution = cycle.executions.find((entry) => entry.scenarioId === item.scenarioId);
            const result = execution?.status ?? item.result;
            return (
              <article key={item.scenarioId} className={`cycle-scenario result-${result.toLowerCase()}`}>
                <span className="scenario-order">{item.order}</span>
                <div className="cycle-scenario-main">
                  <div><span className="code-link">{scenario.code}</span><span className={`automation-chip ${scenario.automated ? 'automated' : ''}`}>{scenario.automated ? 'Automatizado' : 'Manual'}</span><span className={`cycle-result result-${result.toLowerCase()}`}>{resultLabels[result]}</span></div>
                  <h3><Link to={`/cenarios/${scenario.id}`}>{scenario.title}</Link></h3>
                  <p>{scenario.description || 'Cenário sem descrição.'}</p>
                  {item.executedBy && <small>Registrado por {item.executedBy.name}{item.executedAt ? ` em ${new Date(item.executedAt).toLocaleString('pt-BR')}` : ''}</small>}
                </div>
                {scenario.automated ? (
                  <div className="automated-cycle-action">{execution ? <Link className="button button-secondary button-small" to={`/execucoes/${execution.id}`}><ExternalLink size={14} /> {execution.code}</Link> : <span><Clock3 /> Aguardando execução</span>}</div>
                ) : (
                  <div className="manual-result-form">
                    <textarea aria-label={`Observações de ${scenario.code}`} rows={2} value={notes[item.scenarioId] ?? ''} onChange={(event) => setNotes({ ...notes, [item.scenarioId]: event.target.value })} placeholder="Observações e evidências do teste manual" />
                    <div>
                      <button aria-label="Aprovar cenário" className="manual-result-button pass" disabled={saving === item.scenarioId} onClick={() => void updateManualResult(item.scenarioId, 'PASSED')}><CheckCircle2 /></button>
                      <button aria-label="Reprovar cenário" className="manual-result-button fail" disabled={saving === item.scenarioId} onClick={() => void updateManualResult(item.scenarioId, 'FAILED')}><XCircle /></button>
                      <button aria-label="Bloquear cenário" className="manual-result-button block" disabled={saving === item.scenarioId} onClick={() => void updateManualResult(item.scenarioId, 'BLOCKED')}><Ban /></button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel cycle-executions-panel">
        <div className="panel-heading"><div><h2>Execuções automatizadas</h2><p>Histórico gerado por este ciclo.</p></div><CirclePlay /></div>
        {cycle.executions.length === 0 ? <div className="cycle-empty"><FlaskConical /><p>Nenhuma execução automatizada foi criada.</p></div> : <div className="cycle-execution-list">{cycle.executions.map((execution) => <Link key={execution.id} to={`/execucoes/${execution.id}`}><span className={`cycle-result result-${execution.status.toLowerCase()}`}>{resultLabels[execution.status]}</span><strong>{execution.code}</strong><span>{execution.scenario?.code} · {execution.scenario?.title}</span><time>{new Date(execution.createdAt).toLocaleString('pt-BR')}</time></Link>)}</div>}
      </section>
    </div>
  );
}
