import { ArrowLeft, ArrowRight, ArrowRightLeft, GitCompareArrows, Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../services/api';
import type { CycleComparisonClassification, TestCycleComparison, TestPlan } from '../types';

const resultLabels: Record<string, string> = {
  NOT_RUN: 'Não executado', QUEUED: 'Na fila', RUNNING: 'Executando', PASSED: 'Aprovado', FAILED: 'Reprovado', BLOCKED: 'Bloqueado', CANCELLED: 'Cancelado'
};
const classificationLabels: Record<CycleComparisonClassification, string> = {
  REGRESSION: 'Regressão', IMPROVEMENT: 'Melhoria', UNCHANGED: 'Sem alteração', ADDED: 'Adicionado', REMOVED: 'Removido', CHANGED: 'Alterado'
};

function ClassificationIcon({ value }: { value: CycleComparisonClassification }) {
  if (value === 'REGRESSION') return <TrendingDown />;
  if (value === 'IMPROVEMENT') return <TrendingUp />;
  if (value === 'ADDED') return <Plus />;
  if (value === 'REMOVED') return <Minus />;
  return <ArrowRightLeft />;
}

export function TestCycleComparisonPage() {
  const { planId } = useParams();
  const [plan, setPlan] = useState<TestPlan | null>(null);
  const [comparison, setComparison] = useState<TestCycleComparison | null>(null);
  const [baselineId, setBaselineId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const compare = useCallback(async (baseline: number, target: number) => {
    if (baseline === target) return;
    setLoading(true);
    try {
      setComparison(await api.compareTestCycles(Number(planId), baseline, target));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível comparar os ciclos.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void api.testPlan(Number(planId)).then((data) => {
      setPlan(data);
      if (data.cycles.length >= 2) {
        const completed = data.cycles.filter((cycle) => cycle.status === 'COMPLETED');
        const candidates = completed.length >= 2 ? completed : data.cycles;
        setBaselineId(String(candidates[1].id));
        setTargetId(String(candidates[0].id));
        void compare(candidates[1].id, candidates[0].id);
      } else {
        setError('Crie ao menos dois ciclos para realizar a comparação.');
        setLoading(false);
      }
    }).catch((requestError) => {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível carregar o plano.');
      setLoading(false);
    });
  }, [compare, planId]);

  function selectBaseline(value: string) {
    setBaselineId(value);
    if (value && targetId && value !== targetId) void compare(Number(value), Number(targetId));
  }

  function selectTarget(value: string) {
    setTargetId(value);
    if (baselineId && value && baselineId !== value) void compare(Number(baselineId), Number(value));
  }

  return (
    <div className="page cycle-comparison-page">
      <Link className="back-link" to="/planos"><ArrowLeft size={15} /> Voltar para planos</Link>
      <div className="page-heading">
        <div><p className="eyebrow">{plan?.code} · {plan?.project.name}</p><h1>Comparação entre ciclos</h1><p>Identifique regressões, melhorias e mudanças de cobertura entre duas rodadas.</p></div>
      </div>

      {plan && plan.cycles.length >= 2 && (
        <section className="panel comparison-selector">
          <label>Ciclo de referência<select value={baselineId} onChange={(event) => selectBaseline(event.target.value)}>{plan.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.code} · {cycle.name}</option>)}</select></label>
          <span><ArrowRight /></span>
          <label>Ciclo comparado<select value={targetId} onChange={(event) => selectTarget(event.target.value)}>{plan.cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.code} · {cycle.name}</option>)}</select></label>
        </section>
      )}

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {loading ? <div className="page-loading">Calculando comparação...</div> : comparison && (
        <>
          <section className="comparison-rate-grid">
            <article className="panel comparison-cycle-card"><span>{comparison.baseline.code}</span><strong>{comparison.baseline.passRate}%</strong><p>Taxa de aprovação da referência</p></article>
            <article className="comparison-arrow"><ArrowRight /></article>
            <article className="panel comparison-cycle-card target"><span>{comparison.target.code}</span><strong>{comparison.target.passRate}%</strong><p>Taxa de aprovação comparada</p></article>
            <article className={`panel comparison-delta ${comparison.summary.passRateDelta < 0 ? 'negative' : 'positive'}`}><span>Variação</span><strong>{comparison.summary.passRateDelta > 0 ? '+' : ''}{comparison.summary.passRateDelta} p.p.</strong><p>{comparison.summary.passRateDelta < 0 ? 'Queda na aprovação' : comparison.summary.passRateDelta > 0 ? 'Evolução positiva' : 'Taxa estável'}</p></article>
          </section>

          <section className="comparison-summary-grid">
            <article className="panel regression"><TrendingDown /><div><strong>{comparison.summary.regressions}</strong><span>regressões</span></div></article>
            <article className="panel improvement"><TrendingUp /><div><strong>{comparison.summary.improvements}</strong><span>melhorias</span></div></article>
            <article className="panel"><ArrowRightLeft /><div><strong>{comparison.summary.changed}</strong><span>alterados</span></div></article>
            <article className="panel"><Minus /><div><strong>{comparison.summary.unchanged}</strong><span>sem alteração</span></div></article>
          </section>

          <section className="panel comparison-table-panel">
            <div className="panel-heading"><div><h2>Resultado por cenário</h2><p>Regressões aparecem primeiro para acelerar a análise.</p></div><GitCompareArrows /></div>
            <div className="comparison-table">
              <div className="comparison-table-head"><span>Cenário</span><span>Referência</span><span>Comparado</span><span>Classificação</span></div>
              {comparison.items.map((item) => (
                <div className={`comparison-table-row classification-${item.classification.toLowerCase()}`} key={item.scenarioId}>
                  <div><span className="code-link">{item.scenario.code}</span><strong><Link to={`/cenarios/${item.scenario.id}`}>{item.scenario.title}</Link></strong><small>{item.scenario.automated ? 'Automatizado' : 'Manual'}</small></div>
                  <span className={`cycle-result result-${(item.baselineResult ?? 'not_run').toLowerCase()}`}>{resultLabels[item.baselineResult ?? 'NOT_RUN']}</span>
                  <span className={`cycle-result result-${(item.targetResult ?? 'not_run').toLowerCase()}`}>{resultLabels[item.targetResult ?? 'NOT_RUN']}</span>
                  <span className={`comparison-classification ${item.classification.toLowerCase()}`}><ClassificationIcon value={item.classification} /> {classificationLabels[item.classification]}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
