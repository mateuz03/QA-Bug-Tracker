import { Bot, CirclePlay, FileText, Filter, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Project, TestScenario } from '../types';

const typeLabels = { FUNCTIONAL: 'Funcional', REGRESSION: 'Regressão', SMOKE: 'Smoke', INTEGRATION: 'Integração' };

export function ScenariosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [scenarios, setScenarios] = useState<TestScenario[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.scenarios(searchParams.toString()).then(setScenarios).finally(() => setLoading(false));
  }, [searchParams]);
  useEffect(() => { api.projects().then(setProjects); }, []);

  function filter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    setSearchParams(next);
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div><p className="eyebrow">Biblioteca de testes</p><h1>Cenários</h1><p>Crie, grave e execute casos rastreáveis aos requisitos do produto.</p></div>
        <Link className="button button-primary" to="/cenarios/novo"><Plus size={18} /> Novo cenário</Link>
      </div>
      <section className="panel filter-panel scenario-filters">
        <div className="filter-search"><Search size={18} /><input aria-label="Pesquisar cenário" placeholder="Pesquisar cenário..." value={searchParams.get('search') ?? ''} onChange={(event) => filter('search', event.target.value)} /></div>
        <select aria-label="Projeto" value={searchParams.get('projectId') ?? ''} onChange={(event) => filter('projectId', event.target.value)}><option value="">Todos os projetos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <select aria-label="Tipo" value={searchParams.get('type') ?? ''} onChange={(event) => filter('type', event.target.value)}><option value="">Todos os tipos</option>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <select aria-label="Status" value={searchParams.get('status') ?? ''} onChange={(event) => filter('status', event.target.value)}><option value="">Todos os status</option><option value="ACTIVE">Ativo</option><option value="DRAFT">Rascunho</option><option value="INACTIVE">Inativo</option></select>
        <button className="button button-secondary" onClick={() => setSearchParams({})}><Filter size={17} /> Limpar</button>
      </section>
      {loading ? <div className="page-loading">Carregando cenários...</div> : (
        <section className="scenario-grid">
          {scenarios.map((scenario) => {
            const latest = scenario.executions?.[0];
            return (
              <article className="panel scenario-card" key={scenario.id}>
                <div className="scenario-card-heading"><span className="code-link">{scenario.code}</span><span className={`automation-chip ${scenario.automated ? 'automated' : ''}`}>{scenario.automated ? <><Bot size={13} /> Automatizado</> : <><FileText size={13} /> Manual</>}</span></div>
                <h2><Link to={`/cenarios/${scenario.id}`}>{scenario.title}</Link></h2>
                <p>{scenario.description || 'Cenário sem descrição.'}</p>
                <div className="scenario-tags"><span>{scenario.project.name}</span><span>{scenario.requirement?.code || 'Sem requisito'}</span><span>{typeLabels[scenario.type]}</span></div>
                <div className="scenario-metrics"><span><strong>{scenario._count?.steps ?? 0}</strong> passos</span><span><strong>{scenario._count?.executions ?? 0}</strong> execuções</span><span><strong>{scenario._count?.bugs ?? 0}</strong> bugs</span></div>
                <footer><span className={`execution-result result-${latest?.status?.toLowerCase() || 'none'}`}>{latest ? latest.status === 'PASSED' ? 'Última: passou' : latest.status === 'FAILED' ? 'Última: falhou' : `Última: ${latest.status}` : 'Nunca executado'}</span><Link className="text-link" to={`/cenarios/${scenario.id}`}><CirclePlay size={15} /> Abrir</Link></footer>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
