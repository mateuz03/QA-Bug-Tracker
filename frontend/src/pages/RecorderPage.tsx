import { CheckCircle2, Chrome, Clipboard, Download, MousePointer2, Radio, ShieldCheck, TextCursorInput } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { RecordingSession } from '../types';

export function RecorderPage() {
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api.recordings().then(setRecordings); }, []);

  async function copyToken() {
    const token = localStorage.getItem('qa-token');
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="page">
      <div className="page-heading"><div><p className="eyebrow">Chrome · Manifest V3</p><h1>Gravador de cenários</h1><p>Transforme ações reais no navegador em passos revisáveis e executáveis.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={copyToken}><Clipboard size={16} /> {copied ? 'Token copiado' : 'Copiar token'}</button><a className="button button-primary" href="/recorder-extension" onClick={(event) => event.preventDefault()}><Download size={17} /> Extensão local</a></div></div>
      <section className="recorder-hero panel">
        <div className="recording-orbit"><span><Radio /></span><i /><i /><i /></div>
        <div><span className="eyebrow">Fluxo assistido</span><h2>Grave uma jornada sem escrever código</h2><p>A extensão captura navegação, cliques e preenchimentos. Ao finalizar, a API converte os eventos para o modelo neutro de cenário.</p><div className="recorder-features"><span><MousePointer2 /> Cliques</span><span><TextCursorInput /> Campos</span><span><Chrome /> Navegação</span><span><ShieldCheck /> Dados mascarados</span></div></div>
        <ol><li><span>1</span><div><strong>Carregue a extensão</strong><p>Abra `chrome://extensions`, ative o modo desenvolvedor e selecione `apps/recorder-extension`.</p></div></li><li><span>2</span><div><strong>Configure a sessão</strong><p>Informe a API local, token, projeto e nome do cenário.</p></div></li><li><span>3</span><div><strong>Grave e revise</strong><p>Execute o fluxo, finalize e abra o cenário salvo na plataforma.</p></div></li></ol>
      </section>
      <section className="panel module-panel">
        <div className="panel-heading"><div><h2>Sessões recentes</h2><p>Gravações recebidas pela API.</p></div><span className="automation-chip automated"><CheckCircle2 size={13} /> API conectada</span></div>
        {recordings.length ? <div className="recording-list">{recordings.map((recording) => <div key={recording.id}><span className={`recording-state state-${recording.status.toLowerCase()}`}><Radio /></span><div><strong>{recording.code} · {recording.title}</strong><small>{recording.project.name} · {recording._count.events} eventos</small></div><span className="badge">{recording.status === 'RECORDING' ? 'Gravando' : recording.status === 'SAVED' ? 'Salvo' : recording.status}</span></div>)}</div> : <div className="empty-state small-empty"><Radio /><h2>Nenhuma gravação recebida</h2><p>Inicie uma sessão pela extensão para vê-la aqui.</p></div>}
      </section>
    </div>
  );
}
