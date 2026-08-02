import { StatusCasoJuridico } from './types';

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Agora';
  }

  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCaseStatusLabel(status: StatusCasoJuridico) {
  switch (status) {
    case 'novo':
      return 'Novo';
    case 'em_andamento':
      return 'Em andamento';
    default:
      return 'Concluido';
  }
}

export function getCaseStatusTone(status: StatusCasoJuridico) {
  switch (status) {
    case 'novo':
      return 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue';
    case 'em_andamento':
      return 'border-brand-blue/20 bg-white text-brand-blue';
    default:
      return 'border-brand-blue/20 bg-white text-brand-blue';
  }
}

export function getTriagemFilaLabel(fila: 'novos' | 'aguardando_advogado' | 'aguardando_cliente' | 'concluidos') {
  switch (fila) {
    case 'novos':
      return 'Novos';
    case 'aguardando_advogado':
      return 'Aguardando advogado';
    case 'aguardando_cliente':
      return 'Aguardando cliente';
    default:
      return 'Concluidos';
  }
}

export function getPrioridadeTone(prioridade: 'critica' | 'alta' | 'media' | 'baixa') {
  switch (prioridade) {
    case 'critica':
      return 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue';
    case 'alta':
      return 'border-brand-orange/50 bg-brand-orange/10 text-brand-blue';
    case 'media':
      return 'border-brand-blue/20 bg-white text-brand-blue';
    default:
      return 'border-gray-100 bg-white text-brand-blue/70';
  }
}
