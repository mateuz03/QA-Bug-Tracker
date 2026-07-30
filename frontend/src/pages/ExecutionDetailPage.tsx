import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  Camera,
  Check,
  CirclePlay,
  Clock3,
  Download,
  ExternalLink,
  FileArchive,
  FileJson,
  FileText,
  Film,
  Image,
  ListRestart,
  OctagonX,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { api, ApiError } from '../services/api';
import type { ExecutionEvidence, ExecutionStatus, TestExecution } from '../types';

const statusLabels: Record<ExecutionStatus, string> = {
  QUEUED: 'Na fila',
  RUNNING: 'Executando',
  PASSED: 'Aprovada',
  FAILED: 'Reprovada',
  BLOCKED: 'Bloqueada',
  CANCELLED: 'Cancelada'
};

function executionTitle(status: ExecutionStatus) {
  if (status === 'PASSED') return 'Execução aprovada';
  if (status === 'FAILED') return 'Execução reprovada';
  if (status === 'CANCELLED') return 'Execução cancelada';
  if (status === 'BLOCKED') return 'Execução bloqueada';
  if (status === 'QUEUED') return 'Execução na fila';
  return 'Execução em andamento';
}

function evidenceIcon(type: ExecutionEvidence['type']) {
  if (type === 'SCREENSHOT') return <Image />;
  if (type === 'VIDEO') return <Film />;
  if (type === 'TRACE') return <FileArchive />;
  if (type === 'CONSOLE' || type === 'NETWORK') return <FileJson />;
  return <Paperclip />;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExecutionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [execution, setExecution] = useState<TestExecution | null>(null);
  const [creatingBug, setCreatingBug] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setExecution(await api.execution(Number(id)));
      setError('');
    } catch {
      setError('Execução não encontrada.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!execution || !['QUEUED', 'RUNNING'].includes(execution.status)) return;
    const timer = window.setInterval(() => void load(), 1000);
    return () => window.clearInterval(timer);
  }, [execution, load]);

  useEffect(() => {
    if (!execution?.retentionUntil) return;
    const remaining = Math.ceil((new Date(execution.retentionUntil).getTime() - Date.now()) / 86_400_000);
    setRetentionDays(Math.max(1, remaining));
  }, [execution?.retentionUntil]);

  async function createBug() {
    setCreatingBug(true);
    setError('');
    try {
      await api.createBugFromExecution(Number(id), { severity: 'HIGH', priority: 'HIGH' });
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível criar o bug.');
    } finally {
      setCreatingBug(false);
    }
  }

  async function cancel() {
    setProcessingAction(true);
    setError('');
    try {
      await api.cancelExecution(Number(id));
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível cancelar a execução.');
    } finally {
      setProcessingAction(false);
    }
  }

  async function retry() {
    setProcessingAction(true);
    setError('');
    try {
      const retried = await api.retryExecution(Number(id));
      navigate(`/execucoes/${retried.id}`);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        const details = requestError.details as { executionId?: number } | undefined;
        if (details?.executionId) {
          navigate(`/execucoes/${details.executionId}`);
          return;
        }
      }
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível reexecutar o cenário.');
    } finally {
      setProcessingAction(false);
    }
  }

  async function uploadEvidence() {
    if (!evidenceFile) return;
    setUploadingEvidence(true);
    setError('');
    try {
      await api.uploadExecutionEvidence(Number(id), evidenceFile, evidenceDescription || undefined);
      setEvidenceFile(null);
      setEvidenceDescription('');
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível anexar a evidência.');
    } finally {
      setUploadingEvidence(false);
    }
  }

  async function deleteEvidence(evidence: ExecutionEvidence) {
    if (!window.confirm(`Remover a evidência "${evidence.name}"?`)) return;
    setError('');
    try {
      await api.deleteExecutionEvidence(Number(id), evidence.id);
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível remover a evidência.');
    }
  }

  async function updateRetention() {
    setProcessingAction(true);
    setError('');
    try {
      await api.updateExecutionRetention(Number(id), retentionDays);
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível atualizar a retenção.');
    } finally {
      setProcessingAction(false);
    }
  }

  async function downloadReport(format: 'pdf' | 'csv') {
    setExporting(format);
    setError('');
    try {
      const blob = await api.executionReport(Number(id), format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${execution?.code.toLowerCase()}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível exportar o relatório.');
    } finally {
      setExporting('');
    }
  }

  if (!execution) {
    return <div className="page"><div className={error ? 'alert alert-error' : 'page-loading'}>{error || 'Carregando execução...'}</div></div>;
  }

  const active = ['QUEUED', 'RUNNING'].includes(execution.status);
  const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(/\/api\/?$/, '');
  const screenshotUrl = execution.screenshotPath ? `${apiBase}${execution.screenshotPath}` : null;

  return (
    <div className="page">
      <Link className="back-link" to="/execucoes"><ArrowLeft size={17} /> Voltar para execuções</Link>
      <div className="execution-hero">
        <div className={`execution-hero-icon ${execution.status.toLowerCase()}`}>
          {execution.status === 'PASSED' ? <Check /> : execution.status === 'FAILED' ? <X /> : execution.status === 'CANCELLED' ? <OctagonX /> : <Clock3 />}
        </div>
        <div>
          <p className="eyebrow">{execution.code} · {execution.browser}</p>
          <h1>{executionTitle(execution.status)}</h1>
          <p>{execution.scenario.code} · {execution.scenario.title}</p>
        </div>
        <div className="execution-hero-meta">
          <span>Status<strong>{statusLabels[execution.status]}</strong></span>
          <span>Ambiente<strong>{execution.environment.name}</strong></span>
          <span>Duração<strong>{execution.durationMs != null ? `${(execution.durationMs / 1000).toFixed(1)}s` : '—'}</strong></span>
        </div>
      </div>

      {active && (
        <section className="execution-progress-panel" aria-live="polite">
          <div>
            <span>{execution.status === 'QUEUED' ? 'Aguardando um worker disponível' : `Executando passo ${execution.currentStep ?? '...'}`}</span>
            <strong>{execution.progress}%</strong>
          </div>
          <div className="execution-progress-track"><span style={{ width: `${execution.progress}%` }} /></div>
          <button className="button button-secondary danger-text" disabled={processingAction} onClick={cancel}>
            <Square size={15} /> {processingAction ? 'Cancelando...' : 'Cancelar execução'}
          </button>
        </section>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {execution.status === 'FAILED' && (
        <section className="failure-banner">
          <AlertTriangle />
          <div><strong>O cenário falhou</strong><p>{execution.errorMessage || 'Analise o passo reprovado e as evidências capturadas.'}</p></div>
          {execution.bugs?.length
            ? <Link className="button button-secondary" to={`/bugs/${execution.bugs[0].id}/editar`}><Bug size={16} /> Abrir {execution.bugs[0].code}</Link>
            : <button className="button button-primary" disabled={creatingBug} onClick={createBug}><Bug size={16} /> {creatingBug ? 'Criando...' : 'Criar bug'}</button>}
        </section>
      )}

      {!active && (
        <div className="execution-actions">
          <button className="button button-secondary" disabled={processingAction} onClick={retry}>
            <RefreshCw size={16} /> {processingAction ? 'Adicionando à fila...' : 'Executar novamente'}
          </button>
          {execution.retryOf && <Link className="retry-link" to={`/execucoes/${execution.retryOf.id}`}><ListRestart size={15} /> Nova tentativa de {execution.retryOf.code}</Link>}
        </div>
      )}

      <section className="execution-detail-grid">
        <article className="panel module-panel">
          <div className="panel-heading"><div><h2>Resultado por passo</h2><p>Tempo e situação de cada ação executada.</p></div></div>
          <ol className="execution-steps">{execution.steps?.map((step) => (
            <li key={step.id} className={`step-${step.status.toLowerCase()}`}>
              <span>{step.status === 'PASSED' ? <Check /> : step.status === 'FAILED' ? <X /> : <Clock3 />}</span>
              <div><strong>{step.order}. {step.description}</strong>{step.error && <p>{step.error}</p>}</div>
              <small>{step.durationMs != null ? `${step.durationMs} ms` : '—'}</small>
              {(step.expected || step.actual) && <dl className="step-comparison"><div><dt>Esperado</dt><dd>{step.expected || '—'}</dd></div><div><dt>Encontrado</dt><dd>{step.actual || '—'}</dd></div></dl>}
            </li>
          ))}</ol>
        </article>
        <aside>
          <article className="panel detail-panel">
            <div className="panel-heading"><div><h2>Rastreabilidade</h2><p>Origem desta execução.</p></div></div>
            <dl className="definition-list">
              <div><dt>Projeto</dt><dd><Link to={`/projetos/${execution.project.id}`}>{execution.project.name}</Link></dd></div>
              <div><dt>Cenário</dt><dd><Link to={`/cenarios/${execution.scenario.id}`}>{execution.scenario.code}</Link></dd></div>
              <div><dt>Requisito</dt><dd>{execution.scenario.requirement?.code || 'Não vinculado'}</dd></div>
              <div><dt>Responsável</dt><dd>{execution.createdBy?.name || 'Sistema'}</dd></div>
              <div><dt>Timeout</dt><dd>{Math.round(execution.timeoutMs / 1000)} segundos</dd></div>
            </dl>
          </article>
          <article className="panel evidence-panel">
            <div className="panel-heading"><div><h2>Evidências</h2><p>Artefatos capturados pelo worker.</p></div></div>
            {execution.evidences?.length
              ? <div className="evidence-count"><ShieldCheck /><strong>{execution.evidences.length}</strong><span>artefato(s) preservado(s)</span></div>
              : screenshotUrl
                ? <a href={screenshotUrl} target="_blank" rel="noreferrer"><span><Camera /></span><div><strong>Screenshot legado</strong><small>PNG · captura completa</small></div><ExternalLink size={16} /></a>
                : <div className="no-evidence"><CirclePlay /><p>Nenhuma evidência foi capturada.</p></div>}
          </article>
          {execution.bugs?.map((bug) => (
            <article className="panel linked-bug" key={bug.id}><span><Bug /></span><div><small>Bug relacionado</small><Link to={`/bugs/${bug.id}/editar`}>{bug.code} · {bug.title}</Link><Badge value={bug.severity} /></div></article>
          ))}
        </aside>
      </section>

      <section className="panel evidence-center">
        <div className="panel-heading evidence-center-heading">
          <div><h2>Central de evidências</h2><p>Screenshots, vídeo, trace, console, rede e anexos manuais.</p></div>
          <div className="report-actions">
            <button className="button button-secondary" disabled={Boolean(exporting)} onClick={() => void downloadReport('pdf')}><FileText size={16} /> {exporting === 'pdf' ? 'Gerando...' : 'Relatório PDF'}</button>
            <button className="button button-secondary" disabled={Boolean(exporting)} onClick={() => void downloadReport('csv')}><Download size={16} /> {exporting === 'csv' ? 'Gerando...' : 'Exportar CSV'}</button>
          </div>
        </div>

        <div className="evidence-toolbar">
          <div className="retention-control"><ShieldCheck size={17} /><label>Reter por <input type="number" min={1} max={365} value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))} /> dias</label><button className="button button-secondary" disabled={processingAction} onClick={() => void updateRetention()}>Atualizar</button></div>
          <div className="retention-date">Expiração atual: <strong>{execution.retentionUntil ? new Date(execution.retentionUntil).toLocaleDateString('pt-BR') : 'não definida'}</strong></div>
        </div>

        {execution.evidences?.length ? (
          <div className="evidence-grid">{execution.evidences.map((evidence) => (
            <article key={evidence.id} className={`evidence-card evidence-${evidence.type.toLowerCase()}`}>
              <span>{evidenceIcon(evidence.type)}</span>
              <div><small>{evidence.type}{evidence.stepOrder ? ` · passo ${evidence.stepOrder}` : ''}</small><strong>{evidence.name}</strong><p>{evidence.description || `${formatBytes(evidence.sizeBytes)} · ${new Date(evidence.createdAt).toLocaleString('pt-BR')}`}</p></div>
              <div className="evidence-card-actions"><a className="icon-button" href={`${apiBase}${evidence.path}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${evidence.name}`}><ExternalLink size={15} /></a><button className="icon-button danger" onClick={() => void deleteEvidence(evidence)} aria-label={`Excluir ${evidence.name}`}><Trash2 size={15} /></button></div>
            </article>
          ))}</div>
        ) : <div className="no-evidence evidence-empty"><Paperclip /><p>Os artefatos aparecerão aqui após a execução ou upload manual.</p></div>}

        <div className="manual-evidence-form">
          <div><Upload /><span><strong>Adicionar evidência manual</strong><small>Imagem, PDF, TXT, JSON ou ZIP de até 10 MB.</small></span></div>
          <input aria-label="Arquivo de evidência" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.json,.zip" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} />
          <input aria-label="Descrição da evidência" value={evidenceDescription} onChange={(event) => setEvidenceDescription(event.target.value)} placeholder="Descrição opcional" />
          <button className="button button-primary" disabled={!evidenceFile || uploadingEvidence} onClick={() => void uploadEvidence()}>{uploadingEvidence ? 'Enviando...' : 'Anexar arquivo'}</button>
        </div>
      </section>

      <section className="panel execution-log-panel">
        <div className="panel-heading"><div><h2><Terminal size={19} /> Log da execução</h2><p>Eventos registrados pela fila e pelo worker.</p></div></div>
        <ol>{execution.logs?.map((log) => (
          <li key={log.id} className={`log-${log.level.toLowerCase()}`}>
            <time>{new Date(log.createdAt).toLocaleTimeString('pt-BR')}</time>
            <span>{log.level}</span>
            <p>{log.message}</p>
          </li>
        ))}</ol>
      </section>
    </div>
  );
}
