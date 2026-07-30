import { Activity, ArrowRight, Bug, FolderKanban, GitBranch, Plus, TestTube2, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../services/api';
import type { Project } from '../types';

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    repositoryUrl: '',
    environmentName: 'Homologação',
    baseUrl: ''
  });

  async function load() {
    setLoading(true);
    try {
      setProjects(await api.projects());
    } catch {
      setError('Não foi possível carregar os projetos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api.createProject({
        name: form.name,
        description: form.description,
        repositoryUrl: form.repositoryUrl,
        environments: [{ name: form.environmentName, baseUrl: form.baseUrl, isDefault: true }]
      });
      setShowForm(false);
      setForm({ name: '', description: '', repositoryUrl: '', environmentName: 'Homologação', baseUrl: '' });
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível criar o projeto.');
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div><p className="eyebrow">Portfólio de qualidade</p><h1>Projetos</h1><p>Organize produtos, ambientes, cobertura, execuções e defeitos em um só lugar.</p></div>
        {user?.role === 'ADMIN' && <button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={18} /> Novo projeto</button>}
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {showForm && (
        <section className="panel inline-form-panel">
          <div className="panel-heading"><div><h2>Criar projeto</h2><p>Comece pelo produto e pelo ambiente principal de testes.</p></div><button className="icon-button" aria-label="Fechar" onClick={() => setShowForm(false)}><X /></button></div>
          <form className="project-form" onSubmit={submit}>
            <label>Nome<input required minLength={3} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Loja Virtual" /></label>
            <label>Repositório<input type="url" value={form.repositoryUrl} onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })} placeholder="https://github.com/..." /></label>
            <label className="field-full">Descrição<textarea required rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
            <label>Ambiente<input required value={form.environmentName} onChange={(event) => setForm({ ...form, environmentName: event.target.value })} /></label>
            <label>URL base<input required type="url" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://hml.exemplo.com" /></label>
            <div className="form-actions field-full"><button className="button button-secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="button button-primary">Criar projeto</button></div>
          </form>
        </section>
      )}
      {loading ? <div className="page-loading">Carregando projetos...</div> : (
        <section className="project-grid">
          {projects.map((project) => (
            <article className="panel project-card" key={project.id}>
              <div className="project-card-top"><span className="project-icon"><FolderKanban /></span><span className={`status-dot status-${project.status.toLowerCase()}`}>{project.status === 'ACTIVE' ? 'Ativo' : project.status === 'PAUSED' ? 'Pausado' : 'Arquivado'}</span></div>
              <span className="code-link">{project.code}</span>
              <h2>{project.name}</h2>
              <p>{project.description || 'Projeto sem descrição.'}</p>
              <div className="project-stats">
                <span><TestTube2 /> <strong>{project._count.scenarios}</strong> cenários</span>
                <span><Activity /> <strong>{project._count.executions}</strong> execuções</span>
                <span><Bug /> <strong>{project._count.bugs}</strong> bugs</span>
              </div>
              <div className="quality-row"><span>Aprovação</span><strong>{project.passRate == null ? '—' : `${project.passRate}%`}</strong></div>
              <div className="project-meta"><span><GitBranch size={14} /> {project.owner.name}</span><Link className="text-link" to={`/projetos/${project.id}`}>Abrir projeto <ArrowRight size={15} /></Link></div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
