import { Badge } from '@components/ui';
import type { StatusJuridicoEdital } from '@/types';

export function StatusJuridicoBadge({
  status,
  compact = true,
}: {
  status: StatusJuridicoEdital | null | undefined;
  /** Em listagens usa rótulos curtos; em detalhe use compact=false. */
  compact?: boolean;
}) {
  if (!status) return null;
  const mapFull: Record<StatusJuridicoEdital, { color: 'green' | 'violet' | 'red'; label: string }> = {
    seguro: { color: 'green', label: 'SEGURO' },
    alerta: { color: 'violet', label: 'ALERTA DE ERRO' },
    vicio: { color: 'red', label: 'VÍCIO JURÍDICO' },
  };
  const mapShort: Record<StatusJuridicoEdital, { color: 'green' | 'violet' | 'red'; label: string }> = {
    seguro: { color: 'green', label: 'SEGURO' },
    alerta: { color: 'violet', label: 'ALERTA' },
    vicio: { color: 'red', label: 'VÍCIO' },
  };
  const m = compact ? mapShort[status] : mapFull[status];
  return (
    <Badge color={m.color} size="sm">
      {m.label}
    </Badge>
  );
}
