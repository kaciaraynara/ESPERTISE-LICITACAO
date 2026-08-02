import KanbanImpugnacao from '@components/juridico/KanbanImpugnacao';
import RecursoFraudeWizard from '@components/juridico/RecursoFraudeWizard';

export default function ImpugnacaoPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 lg:p-12">
      <RecursoFraudeWizard />
      <KanbanImpugnacao />
    </div>
  );
}
