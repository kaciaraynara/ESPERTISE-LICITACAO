import { useSearchParams } from 'react-router-dom';
import KanbanImpugnacao from '@components/juridico/KanbanImpugnacao';
import RecursoFraudeWizard from '@components/juridico/RecursoFraudeWizard';

export default function ImpugnacaoPage() {
  const [searchParams] = useSearchParams();
  const urlEditalId =
    searchParams.get('edital') ||
    searchParams.get('editalId') ||
    searchParams.get('noticeId') ||
    searchParams.get('id') ||
    '';

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 lg:p-12">
      <RecursoFraudeWizard initialEditalId={urlEditalId} />
      <KanbanImpugnacao />
    </div>
  );
}
