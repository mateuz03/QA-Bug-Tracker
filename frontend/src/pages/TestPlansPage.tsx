import { CalendarClock, CalendarRange, CheckCircle2, ClipboardList, GitCompareArrows, Layers3, Pencil, PlayCircle, Plus, Rocket, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../services/api';
import type { Project, TestCycleStatus, TestPlan, TestPlanStatus, TestScenario, TestSuite } from '../types';

const planStatusLabels = { DRAFT: 'Rascunho', ACTIVE: 'Ativo', COMPLETED: 'Concluído', ARCHIVED: 'Arquivado' };
const cycleStatusLabels: Record<TestCycleStatus, string> = {
  PLANNED: 'Planejado',
  RUNNING: 'Em execução',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado'
};

function messageFrom(error: unknown) {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.';
}

export function TestPlansPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'plan' | 'suite' | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [editingSuiteId, setEditingSuiteId] = useState<number | null>(null);
  const [cyclePlanId, setCyclePlanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [planForm, setPlanForm] = useState({ projectId: '', name: '', releaseVersion: '', description: '', objective: '', status: 'ACTIVE' as TestPlanStatus, suiteIds: [] as number[] });
  const [suiteForm, setSuiteForm] = useState({ projectId: '', name: '', description: '', scenarioIds: [] as number[] });
  const [cycleForm, setCycleForm] = useState({ name: '', description: '', environmentId: '', browser: 'chromium' as 'chromium' | 'firefox' | 'webkit', scheduledAt: '' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [projectData, planData, suiteData, scenarioData] = await Promise.all([
        api.projects(), api.testPlans(), api.testSuites(), api.scenarios()
      ]);
      setProjects(projectData);
      setPlans(planData);
      setSuites(suiteData);
      setScenarios(scenarioData);
      const defaultProject = String(projectData[0]?.id ?? '');
      setPlanForm((current) => ({ ...current, projectId: current.projectId || defaultProject }));
      setSuiteForm((current) => ({ ...current, projectId: current.projectId || defaultProject }));
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const planSuites = useMemo(
    () => suites.filter((suite) => suite.projectId === Number(planForm.projectId)),
    [suites, planForm.projectId]
  );
  const suiteScenarios = useMemo(
    () => scenarios.filter((scenario) => scenario.projectId === Number(suiteForm.projectId)),
    [scenarios, suiteForm.projectId]
  );

  function toggle(list: number[], id: number) {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  }

  function closePanel() {
    setPanel(null);
    setEditingPlanId(null);
    setEditingSuiteId(null);
  }

  function openNewSuite() {
    const projectId = String(projects[0]?.id ?? '');
    setEditingSuiteId(null);
    setSuiteForm({ projectId, name: '', description: '', scenarioIds: [] });
    setPanel('suite');
  }

  function openEditSuite(suite: TestSuite) {
    setEditingSuiteId(suite.id);
    setSuiteForm({
      projectId: String(suite.projectId),
      name: suite.name,
      description: suite.description ?? '',
      scenarioIds: suite.scenarios.map((item) => item.scenario.id)
    });
    setPanel('suite');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openNewPlan() {
    const projectId = String(projects[0]?.id ?? '');
    setEditingPlanId(null);
    setPlanForm({ projectId, name: '', releaseVersion: '', description: '', objective: '', status: 'ACTIVE', suiteIds: [] });
    setPanel('plan');
  }

  function openEditPlan(plan: TestPlan) {
    setEditingPlanId(plan.id);
    setPlanForm({
      projectId: String(plan.projectId),
      name: plan.name,
      releaseVersion: plan.releaseVersion ?? '',
      description: plan.description ?? '',
      objective: plan.objective ?? '',
      status: plan.status,
      suiteIds: plan.suites.map((item) => item.suite.id)
    });
    setPanel('plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function createSuite(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = { name: suiteForm.name, description: suiteForm.description || null, scenarioIds: suiteForm.scenarioIds };
      if (editingSuiteId) await api.updateTestSuite(editingSuiteId, payload);
      else await api.createTestSuite({ projectId: Number(suiteForm.projectId), ...payload });
      setSuiteForm((current) => ({ ...current, name: '', description: '', scenarioIds: [] }));
      closePanel();
      await load();
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: planForm.name,
        releaseVersion: planForm.releaseVersion || null,
        description: planForm.description || null,
        objective: planForm.objective || null,
        status: planForm.status,
        suiteIds: planForm.suiteIds
      };
      if (editingPlanId) await api.updateTestPlan(editingPlanId, payload);
      else await api.createTestPlan({ projectId: Number(planForm.projectId), ...payload });
      setPlanForm((current) => ({ ...current, name: '', releaseVersion: '', description: '', objective: '', suiteIds: [] }));
      closePanel();
      await load();
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function openCycle(plan: TestPlan) {
    setCyclePlanId(plan.id);
    setCycleForm({
      name: `Ciclo ${plan.releaseVersion || plan.name}`,
      description: '',
      environmentId: String(plan.project.environments.find((environment) => environment.isDefault)?.id ?? plan.project.environments[0]?.id ?? ''),
      browser: 'chromium',
      scheduledAt: ''
    });
  }

  async function createCycle(event: FormEvent, planId: number) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createTestCycle(planId, {
        name: cycleForm.name,
        description: cycleForm.description || null,
        environmentId: Number(cycleForm.environmentId),
        browser: cycleForm.browser,
        scheduledAt: cycleForm.scheduledAt ? new Date(cycleForm.scheduledAt).toISOString() : null
      });
      setCyclePlanId(null);
      await load();
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function startCycle(cycleId: number) {
    setSubmitting(true);
    setError('');
    try {
      await api.startTestCycle(cycleId);
      await load();
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page test-plans-page">
      <div className="page-heading">
        <div><p className="eyebrow">Planejamento de qualidade</p><h1>Planos e ciclos</h1><p>Agrupe cenários em suítes reutilizáveis e acompanhe a regressão por versão.</p></div>
        <div className="heading-actions">
          <button className="button button-secondary" onClick={openNewSuite}><Layers3 size={17} /> Nova suíte</button>
          <button className="button button-primary" onClick={openNewPlan}><Plus size={17} /> Novo plano</button>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {panel === 'suite' && (
        <form className="panel planning-form" onSubmit={createSuite}>
          <div className="planning-form-heading"><div><span><Layers3 /></span><div><p className="eyebrow">Biblioteca reutilizável</p><h2>{editingSuiteId ? 'Editar suíte' : 'Nova suíte'}</h2></div></div><button type="button" className="icon-button" aria-label="Fechar" onClick={closePanel}><X /></button></div>
          <div className="field-grid three">
            <label>Projeto<select required disabled={Boolean(editingSuiteId)} value={suiteForm.projectId} onChange={(event) => setSuiteForm({ ...suiteForm, projectId: event.target.value, scenarioIds: [] })}><option value="">Selecione</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Nome<input required minLength={3} value={suiteForm.name} onChange={(event) => setSuiteForm({ ...suiteForm, name: event.target.value })} placeholder="Smoke crítico" /></label>
            <label>Descrição<input value={suiteForm.description} onChange={(event) => setSuiteForm({ ...suiteForm, description: event.target.value })} placeholder="Objetivo da suíte" /></label>
          </div>
          <fieldset className="scenario-picker"><legend>Cenários da suíte</legend>{suiteScenarios.map((scenario) => <label key={scenario.id}><input type="checkbox" checked={suiteForm.scenarioIds.includes(scenario.id)} onChange={() => setSuiteForm({ ...suiteForm, scenarioIds: toggle(suiteForm.scenarioIds, scenario.id) })} /><span><strong>{scenario.code} · {scenario.title}</strong><small>{scenario.automated ? 'Automatizado' : 'Manual'} · {scenario.type}</small></span></label>)}</fieldset>
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={closePanel}>Cancelar</button><button className="button button-primary" disabled={submitting || suiteForm.scenarioIds.length === 0}>{editingSuiteId ? 'Salvar suíte' : 'Criar suíte'}</button></div>
        </form>
      )}

      {panel === 'plan' && (
        <form className="panel planning-form" onSubmit={createPlan}>
          <div className="planning-form-heading"><div><span><ClipboardList /></span><div><p className="eyebrow">Estratégia da versão</p><h2>{editingPlanId ? 'Editar plano de teste' : 'Novo plano de teste'}</h2></div></div><button type="button" className="icon-button" aria-label="Fechar" onClick={closePanel}><X /></button></div>
          <div className="field-grid three">
            <label>Projeto<select required disabled={Boolean(editingPlanId)} value={planForm.projectId} onChange={(event) => setPlanForm({ ...planForm, projectId: event.target.value, suiteIds: [] })}><option value="">Selecione</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label>Nome<input required minLength={3} value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} placeholder="Regressão da versão 1.1" /></label>
            <label>Versão<input value={planForm.releaseVersion} onChange={(event) => setPlanForm({ ...planForm, releaseVersion: event.target.value })} placeholder="1.1.0" /></label>
            <label>Status<select value={planForm.status} onChange={(event) => setPlanForm({ ...planForm, status: event.target.value as TestPlanStatus })}>{Object.entries(planStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field-full">Descrição<textarea rows={2} value={planForm.description} onChange={(event) => setPlanForm({ ...planForm, description: event.target.value })} /></label>
            <label className="field-full">Objetivo<textarea rows={2} value={planForm.objective} onChange={(event) => setPlanForm({ ...planForm, objective: event.target.value })} /></label>
          </div>
          <fieldset className="scenario-picker"><legend>Suítes incluídas</legend>{planSuites.map((suite) => <label key={suite.id}><input type="checkbox" checked={planForm.suiteIds.includes(suite.id)} onChange={() => setPlanForm({ ...planForm, suiteIds: toggle(planForm.suiteIds, suite.id) })} /><span><strong>{suite.code} · {suite.name}</strong><small>{suite.scenarios.length} cenário(s)</small></span></label>)}</fieldset>
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={closePanel}>Cancelar</button><button className="button button-primary" disabled={submitting || planForm.suiteIds.length === 0}>{editingPlanId ? 'Salvar plano' : 'Criar plano'}</button></div>
        </form>
      )}

      {!loading && suites.length > 0 && (
        <section className="suite-library-panel">
          <div className="section-heading"><div><p className="eyebrow">Biblioteca</p><h2>Suítes reutilizáveis</h2></div><span>{suites.length} cadastrada(s)</span></div>
          <div className="suite-library-grid">
            {suites.map((suite) => (
              <article className="panel suite-library-card" key={suite.id}>
                <span className="suite-library-icon"><Layers3 /></span>
                <div><span className="code-link">{suite.code}</span><h3>{suite.name}</h3><p>{suite.description || 'Suíte sem descrição.'}</p><small>{suite.scenarios.length} cenário(s) · usada em {suite._count?.plans ?? 0} plano(s)</small></div>
                <button className="icon-button" aria-label={`Editar ${suite.name}`} onClick={() => openEditSuite(suite)}><Pencil /></button>
              </article>
            ))}
          </div>
        </section>
      )}

      {loading ? <div className="page-loading">Carregando planos...</div> : plans.length === 0 ? (
        <section className="panel planning-empty"><span><ClipboardList /></span><h2>Comece com uma suíte</h2><p>Crie uma suíte reutilizável, adicione-a a um plano e organize a primeira regressão.</p></section>
      ) : (
        <section className="plan-list">
          {plans.map((plan) => (
            <article className="panel plan-card" key={plan.id}>
              <header>
                <div><div className="plan-code-row"><span className="code-link">{plan.code}</span><span className={`plan-status status-${plan.status.toLowerCase()}`}>{planStatusLabels[plan.status]}</span>{plan.releaseVersion && <span className="release-chip">v{plan.releaseVersion}</span>}</div><h2>{plan.name}</h2><p>{plan.description || plan.objective || 'Plano sem descrição.'}</p></div>
                <div className="plan-actions">{plan.cycles.length >= 2 && <Link className="button button-secondary" to={`/planos/${plan.id}/comparar`}><GitCompareArrows size={16} /> Comparar</Link>}<button className="button button-secondary" onClick={() => openEditPlan(plan)}><Pencil size={16} /> Editar</button><button className="button button-secondary" onClick={() => openCycle(plan)}><CalendarRange size={16} /> Novo ciclo</button></div>
              </header>
              <div className="plan-overview">
                <div><strong>{plan.suites.length}</strong><span>suítes</span></div>
                <div><strong>{new Set(plan.suites.flatMap((item) => item.suite.scenarios.map((entry) => entry.scenario.id))).size}</strong><span>cenários</span></div>
                <div><strong>{plan.cycles.length}</strong><span>ciclos</span></div>
                <div><strong>{plan.project.name}</strong><span>projeto</span></div>
              </div>
              <div className="suite-strip">{plan.suites.map((item) => <span key={item.suite.id}><Layers3 size={13} /> {item.suite.name} <small>{item.suite.scenarios.length}</small></span>)}</div>

              {cyclePlanId === plan.id && (
                <form className="cycle-form" onSubmit={(event) => createCycle(event, plan.id)}>
                  <input required minLength={3} aria-label="Nome do ciclo" value={cycleForm.name} onChange={(event) => setCycleForm({ ...cycleForm, name: event.target.value })} placeholder="Nome do ciclo" />
                  <select required aria-label="Ambiente do ciclo" value={cycleForm.environmentId} onChange={(event) => setCycleForm({ ...cycleForm, environmentId: event.target.value })}><option value="">Ambiente</option>{plan.project.environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}</select>
                  <select aria-label="Navegador do ciclo" value={cycleForm.browser} onChange={(event) => setCycleForm({ ...cycleForm, browser: event.target.value as typeof cycleForm.browser })}><option value="chromium">Chromium</option><option value="firefox">Firefox</option><option value="webkit">WebKit</option></select>
                  <label className="cycle-schedule-field"><span>Agendar (opcional)</span><input type="datetime-local" aria-label="Agendar ciclo" value={cycleForm.scheduledAt} onChange={(event) => setCycleForm({ ...cycleForm, scheduledAt: event.target.value })} /></label>
                  <button className="button button-primary" disabled={submitting}>Criar ciclo</button>
                  <button type="button" className="icon-button" aria-label="Cancelar ciclo" onClick={() => setCyclePlanId(null)}><X /></button>
                </form>
              )}

              <div className="cycle-list">
                {plan.cycles.length === 0 ? <p className="muted">Nenhum ciclo criado para este plano.</p> : plan.cycles.map((cycle) => (
                  <div className="cycle-row" key={cycle.id}>
                    <span className={`cycle-state cycle-${cycle.status.toLowerCase()}`}>{cycle.status === 'COMPLETED' ? <CheckCircle2 /> : cycle.status === 'RUNNING' ? <Rocket /> : <CalendarRange />}</span>
                    <div><div><strong><Link to={`/planos/ciclos/${cycle.id}`}>{cycle.code} · {cycle.name}</Link></strong><span>{cycleStatusLabels[cycle.status]}</span></div><small>{cycle.environment.name} · {cycle.browser} · {cycle.summary.executed}/{cycle.summary.total} executados{cycle.scheduledAt ? ` · agendado para ${new Date(cycle.scheduledAt).toLocaleString('pt-BR')}` : ''}</small><div className="cycle-progress"><span style={{ width: `${cycle.summary.progress}%` }} /></div></div>
                    <div className="cycle-results"><span className="passed">{cycle.summary.passed} passou</span><span className="failed">{cycle.summary.failed} falhou</span>{cycle.executions[0] && <Link to={`/execucoes/${cycle.executions[0].id}`}>{cycle.executions[0].code}</Link>}</div>
                    {cycle.status === 'PLANNED' && <button className="button button-primary button-small" disabled={submitting} onClick={() => void startCycle(cycle.id)}>{cycle.scheduledAt ? <CalendarClock size={15} /> : <PlayCircle size={15} />} {cycle.scheduledAt ? 'Executar agora' : 'Iniciar'}</button>}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
