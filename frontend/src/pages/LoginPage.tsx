import { Bug, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@qatracker.dev');
  const [password, setPassword] = useState('Qa@123456');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand brand-light">
          <span className="brand-mark"><Bug size={20} /></span>
          <span>QA<span>Truker</span></span>
        </div>
        <div className="story-content">
          <span className="eyebrow"><Sparkles size={15} /> Qualidade com contexto</span>
          <h1>Transforme cada falha em uma entrega melhor.</h1>
          <p>Centralize ocorrências, evidências e decisões em um fluxo feito para times de qualidade.</p>
          <ul>
            <li><CheckCircle2 /> Rastreabilidade de ponta a ponta</li>
            <li><CheckCircle2 /> Priorização clara para o time</li>
            <li><CheckCircle2 /> Indicadores atualizados em tempo real</li>
          </ul>
        </div>
        <p className="story-footer">Build quality in, from the first test.</p>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-icon"><ShieldCheck /></div>
          <p className="eyebrow">Área segura</p>
          <h2>Boas-vindas de volta</h2>
          <p className="muted">Use suas credenciais para acessar o workspace.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <label>
            E-mail
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label>
            Senha
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          <div className="login-options">
            <label className="checkbox-label"><input type="checkbox" /> Manter conectado</label>
            <button type="button" className="text-button">Esqueci minha senha</button>
          </div>
          <button className="button button-primary button-block" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar no workspace'}
          </button>
          <div className="demo-credentials">
            <strong>Acesso de demonstração</strong>
            <span>admin@qatracker.dev · Qa@123456</span>
          </div>
        </form>
      </section>
    </div>
  );
}
