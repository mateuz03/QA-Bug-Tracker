import {
  Bug,
  ChevronDown,
  CirclePlay,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Radio,
  Search,
  Settings,
  Users,
  X
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'sidebar sidebar-open' : 'sidebar'}>
        <div className="brand">
          <span className="brand-mark"><Bug size={20} /></span>
          <span>QA<span>Truker</span></span>
          <button className="icon-button mobile-only" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X /></button>
        </div>
        <nav aria-label="Navegação principal">
          <p className="nav-label">Workspace</p>
          <NavLink to="/dashboard"><LayoutDashboard /> Visão geral</NavLink>
          <NavLink to="/projetos"><FolderKanban /> Projetos</NavLink>
          <NavLink to="/cenarios"><FlaskConical /> Cenários</NavLink>
          <NavLink to="/execucoes"><CirclePlay /> Execuções</NavLink>
          <NavLink to="/gravador"><Radio /> Gravador</NavLink>
          <NavLink to="/bugs"><ListChecks /> Ocorrências</NavLink>
          <NavLink to="/bugs/novo"><Plus /> Novo bug</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/usuarios"><Users /> Usuários</NavLink>}
          <p className="nav-label">Sistema</p>
          <NavLink to="/configuracoes"><Settings /> Configurações</NavLink>
        </nav>
        <div className="sidebar-profile">
          <div className="avatar">{user?.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
          <div><strong>{user?.name}</strong><span>{user?.role === 'ADMIN' ? 'Administrador' : 'Analista QA'}</span></div>
          <button className="icon-button" aria-label="Sair" onClick={handleLogout}><LogOut size={18} /></button>
        </div>
      </aside>
      {menuOpen && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-only" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu /></button>
          <div className="global-search">
            <Search size={18} />
            <input aria-label="Pesquisa global" placeholder="Pesquisar ocorrências..." onKeyDown={(event) => {
              if (event.key === 'Enter') navigate(`/bugs?search=${encodeURIComponent(event.currentTarget.value)}`);
            }} />
            <kbd>⌘ K</kbd>
          </div>
          <button className="profile-trigger">
            <span className="avatar avatar-small">{user?.name[0]}</span>
            <span className="desktop-only">{user?.name.split(' ')[0]}</span>
            <ChevronDown size={15} />
          </button>
        </header>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
