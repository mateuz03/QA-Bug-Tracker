import { SearchX } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="empty-state">
      <span><SearchX /></span>
      <h2>Nenhuma ocorrência encontrada</h2>
      <p>Tente limpar os filtros ou cadastre um novo bug.</p>
    </div>
  );
}
