import { ArrowLeft, Bug, CirclePlay, ExternalLink, FlaskConical, Globe2, Plus, ShieldCheck } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { Project } from '../types';

export function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [showRequirement, setShowRequirement] = useState(false);
  const [requirement, setRequirement] = useState({ title: '', description: '' });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setProject(await api.project(Number(id)));
    } catch {
      setError('Projeto não encontrado.');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function createRequirement(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createRequirement(Number(id), requirement);
      setRequirement({ title: '', description: '' });
      setShowRequirement(false);
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível salvar o requisito.');
    }
  }

  if (!project) return <div className="page"><div className={error ? 'alert alert-error' : 'page-loading'}>{error || 'Carregando projeto...'}</div></div>;

  return (
    <div className="page">
      <Link className="back-link" to="/projetos"><ArrowLeft size={17} /> Voltar para projetos</Link>
      <div className="page-heading">
        <div><p className="eyebrow">{project.code} · {project.status === 'ACTIVE' ? 'Projeto ativo' : project.status}</p><h1>{project.name}</h1><p>{project.description}</p></div>
        <Link className="button button-primary" to={`/cenarios/novo?projectId=${project.id}`}><Plus size={18} /> Novo cenário</Link>
      </div>
      <section className="traceability-strip">
        <div><ShieldCheck /><span>Requisitos</span><strong>{project._count.requirements}</strong></div>
        <i>→</i><div><FlaskConical /><span>Cenários</span><strong>{project._count.scenarios}</strong></div>
        <i>→</i><div><CirclePlay /><span>Execuções</span><strong>{project._count.executions}</strong></div>
        <i>→</i><div><Bug /><span>Bugs</span><strong>{project._count.bugs}</strong></div>
      </section>
      <section className="detail-grid">
        <article className="panel detail-panel">
          <div className="panel-heading"><div><h2>Ambientes</h2><p>Destinos disponíveis para execução.</p></div></div>
          <div className="environment-list">{project.environments.map((environment) => (
            <div key={environment.id}><span className="project-icon small"><Globe2 /></span><div><strong>{environment.name}{environment.isDefault && ' · padrão'}</strong><a href={environment.baseUrl} target="_blank" rel="noreferrer">{environment.baseUrl} <ExternalLink size={12} /></a></div></div>
          ))}</div>
        </article>
        <article className="panel detail-panel">
          <div className="panel-heading"><div><h2>Responsabilidade</h2><p>Referências do produto.</p></div></div>
          <dl className="definition-list"><div><dt>Responsável</dt><dd>{project.owner.name}</dd></div><div><dt>E-mail</dt><dd>{project.owner.email}</dd></div><div><dt>Repositório</dt><dd>{project.repositoryUrl ? <a href={project.repositoryUrl} target="_blank" rel="noreferrer">Abrir no GitHub</a> : 'Não informado'}</dd></div></dl>
        </article>
      </section>
      <section className="panel module-panel">
        <div className="panel-heading"><div><h2>Requisitos e cobertura</h2><p>Base da rastreabilidade funcional.</p></div><button className="button button-secondary" onClick={() => setShowRequirement(!showRequirement)}><Plus size={16} /> Requisito</button></div>
        {showRequirement && <form className="requirement-form" onSubmit={createRequirement}><input required minLength={5} placeholder="Título do requisito" value={requirement.title} onChange={(event) => setRequirement({ ...requirement, title: event.target.value })} /><textarea required minLength={10} rows={3} placeholder="Descrição e regra de negócio" value={requirement.description} onChange={(event) => setRequirement({ ...requirement, description: event.target.value })} /><button className="button button-primary">Salvar requisito</button></form>}
        <div className="requirement-list">{project.requirements?.map((item) => (
          <div key={item.id}><span className="code-link">{item.code}</span><div><strong>{item.title}</strong><p>{item.description}</p></div><span className={`badge badge-${item.status.toLowerCase()}`}>{item.status === 'COVERED' ? 'Coberto' : item.status === 'READY' ? 'Pronto' : item.status}</span><small>{item._count?.scenarios ?? 0} cenários</small></div>
        ))}</div>
      </section>
      <section className="panel module-panel">
        <div className="panel-heading"><div><h2>Cenários recentes</h2><p>Casos vinculados a este projeto.</p></div><Link className="text-link" to={`/cenarios?projectId=${project.id}`}>Ver todos</Link></div>
        <div className="scenario-list compact">{project.scenarios?.map((scenario) => (
          <Link to={`/cenarios/${scenario.id}`} key={scenario.id}><span className="code-link">{scenario.code}</span><div><strong>{scenario.title}</strong><small>{scenario.requirement?.code || 'Sem requisito'} · {scenario._count?.steps ?? 0} passos</small></div><span className={`automation-chip ${scenario.automated ? 'automated' : ''}`}>{scenario.automated ? 'Automatizado' : 'Manual'}</span></Link>
        ))}</div>
      </section>
    </div>
  );
}
