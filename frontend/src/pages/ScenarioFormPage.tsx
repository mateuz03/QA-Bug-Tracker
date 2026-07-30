import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { Project, ScenarioPayload, ScenarioStep, StepAction } from '../types';

const actionLabels: Record<StepAction, string> = {
  NAVIGATE: 'Navegar',
  FILL: 'Preencher campo',
  CLICK: 'Clicar',
  SELECT: 'Selecionar',
  CHECK: 'Marcar checkbox',
  UPLOAD: 'Enviar arquivo',
  ASSERT_TEXT: 'Validar texto',
  ASSERT_VISIBLE: 'Validar elemento visível',
  ASSERT_URL: 'Validar URL'
};

const emptyStep: ScenarioStep = {
  action: 'NAVIGATE',
  description: '',
  target: '',
  value: '',
  expected: '',
  timeoutMs: null
};

export function ScenarioFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<ScenarioPayload>({
    title: '',
    description: '',
    preconditions: '',
    priority: 'MEDIUM',
    type: 'FUNCTIONAL',
    status: 'ACTIVE',
    automated: false,
    timeoutMs: 60000,
    screenshotMode: 'FAILURE',
    captureVideo: true,
    captureTrace: true,
    captureConsole: true,
    captureNetwork: true,
    retentionDays: 30,
    projectId: Number(searchParams.get('projectId')) || 0,
    requirementId: null,
    steps: [{ ...emptyStep }]
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.projects().then(setProjects);
    if (id) {
      api.scenario(Number(id)).then((scenario) => setForm({
        title: scenario.title,
        description: scenario.description,
        preconditions: scenario.preconditions,
        priority: scenario.priority,
        type: scenario.type,
        status: scenario.status,
        automated: scenario.automated,
        timeoutMs: scenario.timeoutMs,
        screenshotMode: scenario.screenshotMode,
        captureVideo: scenario.captureVideo,
        captureTrace: scenario.captureTrace,
        captureConsole: scenario.captureConsole,
        captureNetwork: scenario.captureNetwork,
        retentionDays: scenario.retentionDays,
        projectId: scenario.projectId,
        requirementId: scenario.requirementId,
        steps: scenario.steps ?? [{ ...emptyStep }]
      }));
    }
  }, [id]);

  useEffect(() => {
    if (!form.projectId) return;
    api.project(form.projectId).then((detail) => {
      setProjects((current) => current.map((project) => project.id === detail.id ? detail : project));
    }).catch(() => undefined);
  }, [form.projectId]);

  const selectedProject = projects.find((project) => project.id === form.projectId);

  function updateStep(index: number, patch: Partial<ScenarioStep>) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step)
    }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= form.steps.length) return;
    const steps = [...form.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    setForm({ ...form, steps });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = id ? await api.updateScenario(Number(id), form) : await api.createScenario(form);
      navigate(`/cenarios/${saved.id}`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível salvar o cenário.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page form-page wide-form">
      <Link className="back-link" to="/cenarios"><ArrowLeft size={17} /> Voltar para cenários</Link>
      <div className="page-heading"><div><p className="eyebrow">{id ? 'Edição' : 'Novo caso de teste'}</p><h1>{id ? 'Editar cenário' : 'Criar cenário'}</h1><p>Modele passos neutros que podem ser revisados e executados pelo worker.</p></div></div>
      <form onSubmit={submit}>
        {error && <div className="alert alert-error">{error}</div>}
        <section className="panel form-section"><div className="section-number">01</div><div className="section-body">
          <div className="section-heading"><h2>Identificação e rastreabilidade</h2><p>Conecte o cenário ao produto e ao requisito correspondente.</p></div>
          <div className="field-grid">
            <label>Projeto <span>*</span><select required value={form.projectId || ''} onChange={(event) => setForm({ ...form, projectId: Number(event.target.value), requirementId: null })}><option value="">Selecione</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></label>
            <label>Requisito<select value={form.requirementId ?? ''} onChange={(event) => setForm({ ...form, requirementId: event.target.value ? Number(event.target.value) : null })}><option value="">Sem requisito</option>{selectedProject?.requirements?.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select></label>
          </div>
          <label className="field-full">Título <span>*</span><input required minLength={5} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Login com usuário válido" /></label>
          <label className="field-full">Descrição<textarea rows={3} value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="field-full">Pré-condições<textarea rows={3} value={form.preconditions ?? ''} onChange={(event) => setForm({ ...form, preconditions: event.target.value })} /></label>
          <div className="field-grid three"><label>Prioridade<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as ScenarioPayload['priority'] })}><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label><label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ScenarioPayload['type'] })}><option value="FUNCTIONAL">Funcional</option><option value="REGRESSION">Regressão</option><option value="SMOKE">Smoke</option><option value="INTEGRATION">Integração</option></select></label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ScenarioPayload['status'] })}><option value="ACTIVE">Ativo</option><option value="DRAFT">Rascunho</option><option value="INACTIVE">Inativo</option></select></label></div>
          <label className="field-full">Tempo limite do cenário (segundos)<input type="number" min={5} max={900} value={Math.round(form.timeoutMs / 1000)} onChange={(event) => setForm({ ...form, timeoutMs: Number(event.target.value) * 1000 })} /></label>
        </div></section>
        <section className="panel form-section"><div className="section-number">02</div><div className="section-body">
          <div className="section-heading"><h2>Evidências automáticas</h2><p>Defina quais artefatos o worker deve guardar em cada execução.</p></div>
          <div className="field-grid">
            <label>Screenshots<select value={form.screenshotMode} onChange={(event) => setForm({ ...form, screenshotMode: event.target.value as ScenarioPayload['screenshotMode'] })}><option value="NONE">Não capturar</option><option value="FAILURE">Somente em falhas</option><option value="ALL">Todos os passos</option></select></label>
            <label>Retenção (dias)<input type="number" min={1} max={365} value={form.retentionDays} onChange={(event) => setForm({ ...form, retentionDays: Number(event.target.value) })} /></label>
          </div>
          <div className="evidence-options">
            <label><input type="checkbox" checked={form.captureVideo} onChange={(event) => setForm({ ...form, captureVideo: event.target.checked })} /><span><strong>Vídeo</strong><small>Gravação WebM da jornada.</small></span></label>
            <label><input type="checkbox" checked={form.captureTrace} onChange={(event) => setForm({ ...form, captureTrace: event.target.checked })} /><span><strong>Trace</strong><small>Snapshots para o Trace Viewer.</small></span></label>
            <label><input type="checkbox" checked={form.captureConsole} onChange={(event) => setForm({ ...form, captureConsole: event.target.checked })} /><span><strong>Console</strong><small>Mensagens e erros da página.</small></span></label>
            <label><input type="checkbox" checked={form.captureNetwork} onChange={(event) => setForm({ ...form, captureNetwork: event.target.checked })} /><span><strong>Rede</strong><small>Respostas HTTP e falhas.</small></span></label>
          </div>
        </div></section>
        <section className="panel form-section"><div className="section-number">03</div><div className="section-body">
          <div className="section-heading step-heading"><div><h2>Passos do cenário</h2><p>Use seletores CSS ou atributos `data-testid` estáveis.</p></div><button type="button" className="button button-secondary" onClick={() => setForm({ ...form, steps: [...form.steps, { ...emptyStep }] })}><Plus size={16} /> Passo</button></div>
          <div className="step-editor">{form.steps.map((step, index) => (
            <article key={index}>
              <div className="step-order"><strong>{index + 1}</strong><button type="button" aria-label="Mover para cima" onClick={() => moveStep(index, -1)}><ArrowUp /></button><button type="button" aria-label="Mover para baixo" onClick={() => moveStep(index, 1)}><ArrowDown /></button></div>
              <div className="step-fields"><div className="field-grid"><label>Ação<select value={step.action} onChange={(event) => updateStep(index, { action: event.target.value as StepAction })}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Descrição<input required value={step.description} onChange={(event) => updateStep(index, { description: event.target.value })} placeholder="Descreva a intenção do passo" /></label></div><div className="field-grid step-options"><label>Seletor<input value={step.target ?? ''} onChange={(event) => updateStep(index, { target: event.target.value })} placeholder='[data-testid="email"]' /></label><label>Valor<input value={step.value ?? ''} onChange={(event) => updateStep(index, { value: event.target.value })} placeholder="/login ou conteúdo" /></label><label>Esperado<input value={step.expected ?? ''} onChange={(event) => updateStep(index, { expected: event.target.value })} placeholder="Texto, URL ou valor" /></label><label>Timeout (s)<input type="number" min={1} max={300} value={step.timeoutMs ? Math.round(step.timeoutMs / 1000) : ''} onChange={(event) => updateStep(index, { timeoutMs: event.target.value ? Number(event.target.value) * 1000 : null })} placeholder="15" /></label></div></div>
              <button type="button" className="icon-button danger" aria-label={`Excluir passo ${index + 1}`} disabled={form.steps.length === 1} onClick={() => setForm({ ...form, steps: form.steps.filter((_, stepIndex) => stepIndex !== index) })}><Trash2 size={17} /></button>
            </article>
          ))}</div>
        </div></section>
        <div className="form-actions"><Link className="button button-secondary" to="/cenarios">Cancelar</Link><button className="button button-primary" disabled={saving}><Save size={17} /> {saving ? 'Salvando...' : 'Salvar cenário'}</button></div>
      </form>
    </div>
  );
}
