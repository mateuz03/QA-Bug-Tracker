import { Construction } from 'lucide-react';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page">
      <div className="page-heading"><div><p className="eyebrow">Em evolução</p><h1>{title}</h1><p>Este módulo está reservado para a próxima etapa do projeto.</p></div></div>
      <div className="panel placeholder"><span><Construction /></span><h2>Módulo planejado</h2><p>A estrutura de permissões já está preparada para receber esta funcionalidade.</p></div>
    </div>
  );
}
