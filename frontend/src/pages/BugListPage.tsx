import { ChevronLeft, ChevronRight, Filter, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import type { Bug, BugStatus, PaginatedBugs, Priority, Severity, User } from '../types';

export function BugListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<PaginatedBugs | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.bugs(searchParams.toString()));
    } catch {
      setError('Não foi possível carregar as ocorrências.');
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { api.users().then(setUsers).catch(() => undefined); }, []);

  function updateFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    next.set('page', '1');
    setSearchParams(next);
  }

  async function removeBug(bug: Bug) {
    if (!window.confirm(`Excluir ${bug.code} — ${bug.title}?`)) return;
    await api.deleteBug(bug.id);
    await load();
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div><p className="eyebrow">Backlog</p><h1>Ocorrências</h1><p>Encontre, priorize e acompanhe todos os bugs do produto.</p></div>
        <Link className="button button-primary" to="/bugs/novo"><Plus size={18} /> Novo bug</Link>
      </div>
      <section className="panel filter-panel">
        <div className="filter-search"><Search size={18} /><input aria-label="Pesquisar por título" placeholder="Pesquisar por título..." value={searchParams.get('search') ?? ''} onChange={(event) => updateFilter('search', event.target.value)} /></div>
        <select aria-label="Filtrar por status" value={searchParams.get('status') ?? ''} onChange={(event) => updateFilter('status', event.target.value)}><option value="">Todos os status</option><option value="OPEN">Aberto</option><option value="IN_PROGRESS">Em andamento</option><option value="IN_REVIEW">Em revisão</option><option value="RESOLVED">Resolvido</option><option value="CLOSED">Fechado</option></select>
        <select aria-label="Filtrar por prioridade" value={searchParams.get('priority') ?? ''} onChange={(event) => updateFilter('priority', event.target.value)}><option value="">Prioridade</option><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select>
        <select aria-label="Filtrar por severidade" value={searchParams.get('severity') ?? ''} onChange={(event) => updateFilter('severity', event.target.value)}><option value="">Severidade</option><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select>
        <select aria-label="Filtrar por responsável" value={searchParams.get('assigneeId') ?? ''} onChange={(event) => updateFilter('assigneeId', event.target.value)}><option value="">Responsável</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <button className="button button-secondary" onClick={() => setSearchParams({})}><Filter size={17} /> Limpar</button>
      </section>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="panel">
        {loading ? <div className="page-loading">Carregando ocorrências...</div> : data?.items.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Código</th><th>Título</th><th>Severidade</th><th>Prioridade</th><th>Status</th><th>Responsável</th><th>Atualizado</th><th><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>{data.items.map((bug) => (
                  <tr key={bug.id}>
                    <td><Link className="code-link" to={`/bugs/${bug.id}/editar`}>{bug.code}</Link></td>
                    <td className="bug-title-cell"><strong>{bug.title}</strong><small>{bug.environment || 'Ambiente não informado'}</small></td>
                    <td><Badge value={bug.severity as Severity} /></td><td><Badge value={bug.priority as Priority} /></td><td><Badge value={bug.status as BugStatus} /></td>
                    <td>{bug.assignee ? <span className="assignee"><span className="avatar avatar-tiny">{bug.assignee.name[0]}</span>{bug.assignee.name}</span> : <span className="muted">Não atribuído</span>}</td>
                    <td>{new Date(bug.updatedAt).toLocaleDateString('pt-BR')}</td>
                    <td className="table-actions">
                      {user?.role === 'ADMIN' ? <button className="icon-button danger" aria-label={`Excluir ${bug.code}`} onClick={() => removeBug(bug)}><Trash2 size={17} /></button> : <MoreHorizontal size={18} />}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <footer className="pagination">
              <span>Mostrando {data.items.length} de {data.pagination.total} ocorrências</span>
              <div>
                <button className="icon-button" aria-label="Página anterior" disabled={data.pagination.page <= 1} onClick={() => updateFilter('page', String(data.pagination.page - 1))}><ChevronLeft /></button>
                <strong>{data.pagination.page} / {data.pagination.totalPages}</strong>
                <button className="icon-button" aria-label="Próxima página" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => updateFilter('page', String(data.pagination.page + 1))}><ChevronRight /></button>
              </div>
            </footer>
          </>
        ) : <EmptyState />}
      </section>
    </div>
  );
}
