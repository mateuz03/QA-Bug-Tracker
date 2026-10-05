import { ArrowLeft, Bug, CirclePlay, ClipboardList, Copy, ExternalLink, FlaskConical, Github, Globe2, History, KeyRound, Plus, ShieldCheck, Trash2, Unplug, UserPlus, Users } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { AuditLog, GitHubIntegration, JiraIntegration, Project, ProjectApiKey, ProjectRole, User } from '../types';

const projectRoleLabels: Record<ProjectRole, string> = { OWNER: 'Proprietário', MANAGER: 'Gestor', VIEWER: 'Leitor' };
const auditActionLabels: Record<string, string> = {
  PROJECT_CREATED: 'criou o projeto',
  REQUIREMENT_CREATED: 'criou um requisito',
  PROJECT_MEMBER_UPSERTED: 'adicionou ou atualizou um membro',
  PROJECT_MEMBER_REMOVED: 'removeu um membro',
  PROJECT_API_KEY_CREATED: 'criou uma chave de integração',
  PROJECT_API_KEY_REVOKED: 'revogou uma chave de integração',
  PIPELINE_EXECUTION_QUEUED: 'disparou uma execução pelo pipeline',
  GITHUB_INTEGRATION_CREATED: 'conectou o projeto ao GitHub',
  GITHUB_INTEGRATION_UPDATED: 'atualizou a integração com GitHub',
  GITHUB_INTEGRATION_REMOVED: 'removeu a integração com GitHub',
  BUG_GITHUB_SYNCED: 'sincronizou um bug com GitHub Issues',
  JIRA_INTEGRATION_CREATED: 'conectou o projeto ao Jira',
  JIRA_INTEGRATION_UPDATED: 'atualizou a integração com Jira',
  JIRA_INTEGRATION_REMOVED: 'removeu a integração com Jira',
  BUG_JIRA_SYNCED: 'sincronizou um bug com Jira'
};

export function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [showRequirement, setShowRequirement] = useState(false);
  const [requirement, setRequirement] = useState({ title: '', description: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'VIEWER' as Exclude<ProjectRole, 'OWNER'> });
  const [savingMember, setSavingMember] = useState(false);
  const [apiKeys, setApiKeys] = useState<ProjectApiKey[]>([]);
  const [keyForm, setKeyForm] = useState({ name: '', expiresAt: '' });
  const [generatedToken, setGeneratedToken] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [githubIntegration, setGithubIntegration] = useState<GitHubIntegration | null>(null);
  const [githubForm, setGithubForm] = useState({ repository: '', token: '', enabled: true });
  const [savingGithub, setSavingGithub] = useState(false);
  const [jiraIntegration, setJiraIntegration] = useState<JiraIntegration | null>(null);
  const [jiraForm, setJiraForm] = useState({ siteUrl: '', email: '', projectKey: '', issueType: 'Bug', token: '', enabled: true });
  const [savingJira, setSavingJira] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.project(Number(id));
      setProject(data);
      if (data.currentUserRole === 'OWNER' || data.currentUserRole === 'MANAGER') {
        const [logs, userData, keyData, githubData, jiraData] = await Promise.all([
          api.projectAudit(Number(id)),
          data.currentUserRole === 'OWNER' ? api.users() : Promise.resolve([]),
          data.currentUserRole === 'OWNER' ? api.projectApiKeys(Number(id)) : Promise.resolve([]),
          data.currentUserRole === 'OWNER' ? api.githubIntegration(Number(id)) : Promise.resolve(null),
          data.currentUserRole === 'OWNER' ? api.jiraIntegration(Number(id)) : Promise.resolve(null)
        ]);
        setAuditLogs(logs);
        setUsers(userData);
        setApiKeys(keyData);
        setGithubIntegration(githubData);
        setJiraIntegration(jiraData);
        if (githubData) {
          setGithubForm({
            repository: `${githubData.repositoryOwner}/${githubData.repositoryName}`,
            token: '',
            enabled: githubData.enabled
          });
        }
        if (jiraData) {
          setJiraForm({
            siteUrl: jiraData.siteUrl,
            email: jiraData.email,
            projectKey: jiraData.jiraProjectKey,
            issueType: jiraData.issueType,
            token: '',
            enabled: jiraData.enabled
          });
        }
      }
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

  async function saveMember(event: FormEvent) {
    event.preventDefault();
    setSavingMember(true);
    setError('');
    try {
      await api.updateProjectMember(Number(id), Number(memberForm.userId), memberForm.role);
      setMemberForm({ userId: '', role: 'VIEWER' });
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível atualizar o acesso.');
    } finally {
      setSavingMember(false);
    }
  }

  async function removeMember(userId: number) {
    setSavingMember(true);
    setError('');
    try {
      await api.removeProjectMember(Number(id), userId);
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível remover o membro.');
    } finally {
      setSavingMember(false);
    }
  }

  async function createApiKey(event: FormEvent) {
    event.preventDefault();
    setSavingKey(true);
    setError('');
    try {
      const created = await api.createProjectApiKey(Number(id), {
        name: keyForm.name,
        expiresAt: keyForm.expiresAt ? new Date(`${keyForm.expiresAt}T23:59:59`).toISOString() : null
      });
      setGeneratedToken(created.token);
      setKeyForm({ name: '', expiresAt: '' });
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível criar a chave.');
    } finally {
      setSavingKey(false);
    }
  }

  async function revokeApiKey(keyId: number) {
    setSavingKey(true);
    setError('');
    try {
      await api.revokeProjectApiKey(Number(id), keyId);
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível revogar a chave.');
    } finally {
      setSavingKey(false);
    }
  }

  async function saveGithubIntegration(event: FormEvent) {
    event.preventDefault();
    setSavingGithub(true);
    setError('');
    try {
      await api.updateGitHubIntegration(Number(id), {
        repository: githubForm.repository,
        enabled: githubForm.enabled,
        ...(githubForm.token ? { token: githubForm.token } : {})
      });
      setGithubForm((current) => ({ ...current, token: '' }));
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível configurar o GitHub.');
    } finally {
      setSavingGithub(false);
    }
  }

  async function removeGithubIntegration() {
    setSavingGithub(true);
    setError('');
    try {
      await api.removeGitHubIntegration(Number(id));
      setGithubIntegration(null);
      setGithubForm({ repository: '', token: '', enabled: true });
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível remover a integração.');
    } finally {
      setSavingGithub(false);
    }
  }

  async function saveJiraIntegration(event: FormEvent) {
    event.preventDefault();
    setSavingJira(true);
    setError('');
    try {
      await api.updateJiraIntegration(Number(id), {
        siteUrl: jiraForm.siteUrl,
        email: jiraForm.email,
        projectKey: jiraForm.projectKey,
        issueType: jiraForm.issueType,
        enabled: jiraForm.enabled,
        ...(jiraForm.token ? { token: jiraForm.token } : {})
      });
      setJiraForm((current) => ({ ...current, token: '' }));
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível configurar o Jira.');
    } finally {
      setSavingJira(false);
    }
  }

  async function removeJiraIntegration() {
    setSavingJira(true);
    setError('');
    try {
      await api.removeJiraIntegration(Number(id));
      setJiraIntegration(null);
      setJiraForm({ siteUrl: '', email: '', projectKey: '', issueType: 'Bug', token: '', enabled: true });
      await load();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível remover a integração com Jira.');
    } finally {
      setSavingJira(false);
    }
  }

  if (!project) return <div className="page"><div className={error ? 'alert alert-error' : 'page-loading'}>{error || 'Carregando projeto...'}</div></div>;

  const canManage = project.currentUserRole === 'OWNER' || project.currentUserRole === 'MANAGER';
  const canManageMembers = project.currentUserRole === 'OWNER';
  const availableUsers = users.filter((user) => !project.members?.some((member) => member.userId === user.id));

  return (
    <div className="page">
      <Link className="back-link" to="/projetos"><ArrowLeft size={17} /> Voltar para projetos</Link>
      <div className="page-heading">
        <div><p className="eyebrow">{project.code} · {project.status === 'ACTIVE' ? 'Projeto ativo' : project.status}</p><h1>{project.name}</h1><p>{project.description}</p></div>
        {canManage && <Link className="button button-primary" to={`/cenarios/novo?projectId=${project.id}`}><Plus size={18} /> Novo cenário</Link>}
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
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
      <section className="project-governance-grid">
        <article className="panel detail-panel access-panel">
          <div className="panel-heading"><div><h2><Users /> Equipe e acesso</h2><p>Papéis aplicados apenas a este projeto.</p></div><span className="access-role-chip">{project.currentUserRole ? projectRoleLabels[project.currentUserRole] : 'Sem acesso'}</span></div>
          {canManageMembers && (
            <form className="member-form" onSubmit={saveMember}>
              <select required aria-label="Usuário do projeto" value={memberForm.userId} onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })}><option value="">Selecione um usuário</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select>
              <select aria-label="Papel no projeto" value={memberForm.role} onChange={(event) => setMemberForm({ ...memberForm, role: event.target.value as typeof memberForm.role })}><option value="MANAGER">Gestor</option><option value="VIEWER">Leitor</option></select>
              <button className="button button-secondary" disabled={savingMember || !memberForm.userId}><UserPlus size={15} /> Adicionar</button>
            </form>
          )}
          <div className="member-list">{project.members?.map((member) => <div key={member.userId}><span className="avatar avatar-small">{member.user.name[0]}</span><div><strong>{member.user.name}</strong><small>{member.user.email}</small></div><span className={`member-role role-${member.role.toLowerCase()}`}>{projectRoleLabels[member.role]}</span>{canManageMembers && member.role !== 'OWNER' && <button className="icon-button" aria-label={`Remover ${member.user.name}`} disabled={savingMember} onClick={() => void removeMember(member.userId)}><Trash2 /></button>}</div>)}</div>
        </article>
        {canManage && <article className="panel detail-panel audit-panel"><div className="panel-heading"><div><h2><History /> Auditoria</h2><p>Últimas ações administrativas do projeto.</p></div></div><div className="audit-list">{auditLogs.length === 0 ? <p className="muted">Nenhuma ação registrada.</p> : auditLogs.map((log) => <div key={log.id}><span className="audit-dot" /><div><strong>{log.actor.name} {auditActionLabels[log.action] ?? log.action.toLowerCase()}</strong><small>{log.entityType} {log.entityId ? `#${log.entityId}` : ''} · {new Date(log.createdAt).toLocaleString('pt-BR')}</small></div></div>)}</div></article>}
      </section>
      {canManageMembers && (
        <section className="panel module-panel integration-panel">
          <div className="panel-heading"><div><h2><KeyRound /> Integração com pipelines</h2><p>Chaves específicas do projeto para GitHub Actions, GitLab CI, Jenkins e outros serviços.</p></div></div>
          <div className="github-integration-card">
            <div className="github-integration-heading"><span><Github /></span><div><strong>Status de commit no GitHub</strong><p>Publica `pending`, `success`, `failure` ou `error` no commit enviado pelo pipeline.</p></div>{githubIntegration && <span className={githubIntegration.enabled ? 'integration-enabled' : 'integration-disabled'}>{githubIntegration.enabled ? 'Ativa' : 'Pausada'}</span>}</div>
            <form className="github-integration-form" onSubmit={saveGithubIntegration}>
              <label>Repositório<input required pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" value={githubForm.repository} onChange={(event) => setGithubForm({ ...githubForm, repository: event.target.value })} placeholder="organizacao/repositorio" /></label>
              <label>Token {githubIntegration && <small>deixe vazio para manter o atual</small>}<input type="password" required={!githubIntegration} minLength={20} autoComplete="new-password" value={githubForm.token} onChange={(event) => setGithubForm({ ...githubForm, token: event.target.value })} placeholder={githubIntegration ? 'Token já protegido' : 'Fine-grained personal access token'} /></label>
              <label className="github-enabled-field"><input type="checkbox" checked={githubForm.enabled} onChange={(event) => setGithubForm({ ...githubForm, enabled: event.target.checked })} /> Publicar status automaticamente</label>
              <div><button className="button button-primary" disabled={savingGithub}><Github size={15} /> {githubIntegration ? 'Salvar integração' : 'Conectar GitHub'}</button>{githubIntegration && <button type="button" className="button button-secondary" disabled={savingGithub} onClick={() => void removeGithubIntegration()}><Unplug size={15} /> Remover</button>}</div>
            </form>
            {githubIntegration && <div className="github-integration-meta"><span>Repositório<strong>{githubIntegration.repositoryOwner}/{githubIntegration.repositoryName}</strong></span><span>Última publicação<strong>{githubIntegration.lastPublishedAt ? new Date(githubIntegration.lastPublishedAt).toLocaleString('pt-BR') : 'Ainda não publicada'}</strong></span>{githubIntegration.lastError && <span className="github-integration-error">Último erro<strong>{githubIntegration.lastError}</strong></span>}</div>}
          </div>
          <div className="github-integration-card jira-integration-card">
            <div className="github-integration-heading"><span><ClipboardList /></span><div><strong>Sincronização com Jira Cloud</strong><p>Cria e atualiza bugs no projeto Jira usando a API REST v3 e descrição em ADF.</p></div>{jiraIntegration && <span className={jiraIntegration.enabled ? 'integration-enabled' : 'integration-disabled'}>{jiraIntegration.enabled ? 'Ativa' : 'Pausada'}</span>}</div>
            <form className="github-integration-form jira-integration-form" onSubmit={saveJiraIntegration}>
              <label>URL do Jira<input type="url" required pattern="https://.+\.atlassian\.net/?" value={jiraForm.siteUrl} onChange={(event) => setJiraForm({ ...jiraForm, siteUrl: event.target.value })} placeholder="https://empresa.atlassian.net" /></label>
              <label>E-mail Atlassian<input type="email" required value={jiraForm.email} onChange={(event) => setJiraForm({ ...jiraForm, email: event.target.value })} placeholder="qa@empresa.com" /></label>
              <label>Chave do projeto<input required minLength={2} maxLength={20} pattern="[A-Za-z][A-Za-z0-9_]+" value={jiraForm.projectKey} onChange={(event) => setJiraForm({ ...jiraForm, projectKey: event.target.value.toUpperCase() })} placeholder="QA" /></label>
              <label>Tipo da issue<input required minLength={2} maxLength={80} value={jiraForm.issueType} onChange={(event) => setJiraForm({ ...jiraForm, issueType: event.target.value })} placeholder="Bug" /></label>
              <label>API token {jiraIntegration && <small>deixe vazio para manter o atual</small>}<input type="password" required={!jiraIntegration} minLength={20} autoComplete="new-password" value={jiraForm.token} onChange={(event) => setJiraForm({ ...jiraForm, token: event.target.value })} placeholder={jiraIntegration ? 'Token já protegido' : 'API token da conta Atlassian'} /></label>
              <label className="github-enabled-field"><input type="checkbox" checked={jiraForm.enabled} onChange={(event) => setJiraForm({ ...jiraForm, enabled: event.target.checked })} /> Permitir sincronização de bugs</label>
              <div><button className="button button-primary" disabled={savingJira}><ClipboardList size={15} /> {jiraIntegration ? 'Salvar integração' : 'Conectar Jira'}</button>{jiraIntegration && <button type="button" className="button button-secondary" disabled={savingJira} onClick={() => void removeJiraIntegration()}><Unplug size={15} /> Remover</button>}</div>
            </form>
            {jiraIntegration && <div className="github-integration-meta"><span>Projeto Jira<strong>{jiraIntegration.jiraProjectKey} · {jiraIntegration.issueType}</strong></span><span>Última sincronização<strong>{jiraIntegration.lastSyncedAt ? new Date(jiraIntegration.lastSyncedAt).toLocaleString('pt-BR') : 'Ainda não sincronizado'}</strong></span>{jiraIntegration.lastError && <span className="github-integration-error">Último erro<strong>{jiraIntegration.lastError}</strong></span>}</div>}
          </div>
          {generatedToken && <div className="generated-token" role="status"><div><strong>Copie esta chave agora</strong><span>Ela não será exibida novamente.</span></div><code>{generatedToken}</code><button className="button button-secondary" onClick={() => void navigator.clipboard.writeText(generatedToken)}><Copy size={15} /> Copiar</button></div>}
          <form className="api-key-form" onSubmit={createApiKey}><label>Nome<input required minLength={3} value={keyForm.name} onChange={(event) => setKeyForm({ ...keyForm, name: event.target.value })} placeholder="GitHub Actions · main" /></label><label>Expira em (opcional)<input type="date" value={keyForm.expiresAt} onChange={(event) => setKeyForm({ ...keyForm, expiresAt: event.target.value })} /></label><button className="button button-primary" disabled={savingKey}><KeyRound size={15} /> Gerar chave</button></form>
          <div className="api-key-list">{apiKeys.length === 0 ? <p className="muted">Nenhuma chave criada para este projeto.</p> : apiKeys.map((key) => <div key={key.id} className={key.revokedAt ? 'api-key-revoked' : ''}><span className="integration-key-icon"><KeyRound /></span><div><strong>{key.name}</strong><code>{key.prefix}••••••••</code><small>Criada por {key.createdBy.name} · {new Date(key.createdAt).toLocaleDateString('pt-BR')}{key.lastUsedAt ? ` · último uso ${new Date(key.lastUsedAt).toLocaleString('pt-BR')}` : ' · nunca utilizada'}{key.expiresAt ? ` · expira ${new Date(key.expiresAt).toLocaleDateString('pt-BR')}` : ''}</small></div><span className="api-key-status">{key.revokedAt ? 'Revogada' : 'Ativa'}</span>{!key.revokedAt && <button className="button button-secondary button-small" disabled={savingKey} onClick={() => void revokeApiKey(key.id)}><Trash2 size={14} /> Revogar</button>}</div>)}</div>
        </section>
      )}
      <section className="panel module-panel">
        <div className="panel-heading"><div><h2>Requisitos e cobertura</h2><p>Base da rastreabilidade funcional.</p></div>{canManage && <button className="button button-secondary" onClick={() => setShowRequirement(!showRequirement)}><Plus size={16} /> Requisito</button>}</div>
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
