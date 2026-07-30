import { ArrowLeft, Check, Save } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { BugPayload, BugStatus, Priority, Project, Severity, TestScenario, User } from '../types';

const initialForm: BugPayload = {
  title: '',
  description: '',
  reproduction: '',
  expectedResult: '',
  actualResult: '',
  severity: 'MEDIUM',
  priority: 'MEDIUM',
  environment: '',
  browser: '',
  status: 'OPEN',
  evidenceUrl: '',
  technicalError: '',
  assigneeId: null,
  projectId: null,
  scenarioId: null,
  executionId: null
};

export function BugFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<BugPayload>(initialForm);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(id);

  useEffect(() => {
    api.users().then(setUsers).catch(() => undefined);
    api.projects().then(setProjects).catch(() => undefined);
    api.scenarios().then(setScenarios).catch(() => undefined);
    if (id) {
      api.bug(Number(id)).then((bug) => setForm({
        title: bug.title,
        description: bug.description,
        reproduction: bug.reproduction ?? '',
        expectedResult: bug.expectedResult ?? '',
        actualResult: bug.actualResult ?? '',
        severity: bug.severity,
        priority: bug.priority,
        environment: bug.environment ?? '',
        browser: bug.browser ?? '',
        status: bug.status,
        evidenceUrl: bug.evidenceUrl ?? '',
        technicalError: bug.technicalError ?? '',
        assigneeId: bug.assigneeId ?? null,
        projectId: bug.projectId ?? null,
        scenarioId: bug.scenarioId ?? null,
        executionId: bug.executionId ?? null
      })).catch(() => setError('Bug não encontrado.'));
    }
  }, [id]);

  function field<K extends keyof BugPayload>(key: K, value: BugPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const saved = editing ? await api.updateBug(Number(id), form) : await api.createBug(form);
      navigate(`/bugs?success=${encodeURIComponent(`${saved.code} salvo com sucesso`)}`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível salvar o bug.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page form-page">
      <Link className="back-link" to="/bugs"><ArrowLeft size={17} /> Voltar para ocorrências</Link>
      <div className="page-heading">
        <div><p className="eyebrow">{editing ? 'Atualização' : 'Nova ocorrência'}</p><h1>{editing ? 'Editar bug' : 'Registrar novo bug'}</h1><p>Inclua contexto suficiente para que qualquer pessoa consiga reproduzir e validar.</p></div>
      </div>
      <form onSubmit={submit}>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <section className="panel form-section">
          <div className="section-number">01</div>
          <div className="section-body">
            <div className="section-heading"><h2>Informações principais</h2><p>Comece pelo resumo e impacto do problema.</p></div>
            <label className="field-full">Título <span>*</span><input value={form.title} onChange={(event) => field('title', event.target.value)} minLength={5} maxLength={140} required placeholder="Ex.: Erro ao finalizar pagamento com PIX" /></label>
            <label className="field-full">Descrição <span>*</span><textarea value={form.description} onChange={(event) => field('description', event.target.value)} minLength={10} required rows={5} placeholder="Descreva o comportamento observado e seu impacto..." /></label>
            <div className="field-grid">
              <label>Severidade <span>*</span><select value={form.severity} onChange={(event) => field('severity', event.target.value as Severity)}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></label>
              <label>Prioridade <span>*</span><select value={form.priority} onChange={(event) => field('priority', event.target.value as Priority)}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
              <label>Status<select value={form.status} onChange={(event) => field('status', event.target.value as BugStatus)}><option value="OPEN">Aberto</option><option value="IN_PROGRESS">Em andamento</option><option value="IN_REVIEW">Em revisão</option><option value="RESOLVED">Resolvido</option><option value="CLOSED">Fechado</option></select></label>
              <label>Responsável<select value={form.assigneeId ?? ''} onChange={(event) => field('assigneeId', event.target.value ? Number(event.target.value) : null)}><option value="">Não atribuído</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            </div>
          </div>
        </section>
        <section className="panel form-section">
          <div className="section-number">02</div>
          <div className="section-body">
            <div className="section-heading"><h2>Como reproduzir</h2><p>Detalhe o caminho e o resultado da execução.</p></div>
            <label className="field-full">Passos para reprodução<textarea rows={5} value={form.reproduction ?? ''} onChange={(event) => field('reproduction', event.target.value)} placeholder={'1. Acesse...\n2. Clique em...\n3. Observe...'} /></label>
            <div className="field-grid">
              <label>Resultado esperado<textarea rows={4} value={form.expectedResult ?? ''} onChange={(event) => field('expectedResult', event.target.value)} /></label>
              <label>Resultado obtido<textarea rows={4} value={form.actualResult ?? ''} onChange={(event) => field('actualResult', event.target.value)} /></label>
            </div>
          </div>
        </section>
        <section className="panel form-section">
          <div className="section-number">03</div>
          <div className="section-body">
            <div className="section-heading"><h2>Contexto e evidências</h2><p>Registre onde ocorreu e anexe uma referência acessível.</p></div>
            <div className="field-grid">
              <label>Ambiente<input value={form.environment ?? ''} onChange={(event) => field('environment', event.target.value)} placeholder="Homologação" /></label>
              <label>Navegador<input value={form.browser ?? ''} onChange={(event) => field('browser', event.target.value)} placeholder="Chrome 127 / Windows 11" /></label>
            </div>
            <div className="field-grid">
              <label>Projeto<select value={form.projectId ?? ''} onChange={(event) => field('projectId', event.target.value ? Number(event.target.value) : null)}><option value="">Não vinculado</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
              <label>Cenário relacionado<select value={form.scenarioId ?? ''} onChange={(event) => field('scenarioId', event.target.value ? Number(event.target.value) : null)}><option value="">Não vinculado</option>{scenarios.filter((scenario) => !form.projectId || scenario.projectId === form.projectId).map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.code} · {scenario.title}</option>)}</select></label>
            </div>
            <label className="field-full">Erro técnico<textarea rows={3} value={form.technicalError ?? ''} onChange={(event) => field('technicalError', event.target.value)} placeholder="Stack trace, timeout ou mensagem retornada pelo worker..." /></label>
            <label className="field-full">URL da evidência<input value={form.evidenceUrl ?? ''} onChange={(event) => field('evidenceUrl', event.target.value)} placeholder="https://... ou /evidences/..." /></label>
          </div>
        </section>
        <div className="form-actions">
          <Link className="button button-secondary" to="/bugs">Cancelar</Link>
          <button className="button button-primary" disabled={submitting}>{submitting ? <><Save size={17} /> Salvando...</> : <><Check size={17} /> Salvar ocorrência</>}</button>
        </div>
      </form>
    </div>
  );
}
