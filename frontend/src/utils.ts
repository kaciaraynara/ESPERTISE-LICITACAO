import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('pt-br');
dayjs.extend(relativeTime);

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).format('DD/MM/YYYY');
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).format('DD/MM/YYYY [às] HH:mm');
}

export function timeAgo(date: string | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).fromNow();
}

export function diasRestantes(dataEncerramento: string | null | undefined): number | null {
  if (!dataEncerramento) return null;
  return dayjs(dataEncerramento).diff(dayjs(), 'day');
}

export function getRecomendacaoColor(rec: 'participar' | 'avaliar' | 'evitar' | undefined): string {
  switch (rec) {
    case 'participar': return 'text-brand-blue';
    case 'avaliar':    return 'text-brand-blue';
    case 'evitar':     return 'text-brand-blue';
    default:           return 'text-brand-blue/70';
  }
}

export function getRecomendacaoLabel(rec: 'participar' | 'avaliar' | 'evitar' | undefined): string {
  switch (rec) {
    case 'participar': return 'Participar';
    case 'avaliar':    return 'Avaliar';
    case 'evitar':     return 'Evitar';
    default:           return '—';
  }
}

export function getNivelColor(nivel: string | undefined): string {
  switch (nivel) {
    case 'alto':  return 'text-brand-blue';
    case 'medio': return 'text-brand-blue';
    case 'baixo': return 'text-brand-blue';
    default:      return 'text-brand-blue/70';
  }
}

export function getNivelBg(nivel: string | undefined): string {
  switch (nivel) {
    case 'alto':  return 'bg-white border-brand-blue/20';
    case 'medio': return 'bg-brand-orange/10 border-brand-orange/50';
    case 'baixo': return 'bg-brand-orange/10 border-brand-orange/50';
    default:      return 'bg-white border-gray-100';
  }
}

export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.substring(0, max)}...` : text;
}

type UserDisplaySource = {
  nome?: string | null;
  email?: string | null;
  role?: string | null;
  tipo?: string | null;
  plano?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  empresa?: {
    razao_social?: string | null;
    nome_fantasia?: string | null;
  } | null;
};

function isEmailLike(value?: string | null) {
  return Boolean(value && /\S+@\S+\.\S+/.test(value));
}

function cleanDisplayCandidate(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || isEmailLike(normalized)) return null;
  return normalized;
}

export function getUserDisplayName(user?: UserDisplaySource | null, fallback = 'Conta Expertise') {
  const candidates = [
    user?.nome_fantasia,
    user?.razao_social,
    user?.empresa?.nome_fantasia,
    user?.empresa?.razao_social,
    user?.nome,
  ];

  return candidates.map(cleanDisplayCandidate).find(Boolean) ?? fallback;
}

export function getUserInitial(user?: UserDisplaySource | null, fallback = 'L') {
  return getUserDisplayName(user, fallback).charAt(0).toUpperCase();
}

export function getProfileLabel(_role?: string | null) {
  return 'Fornecedor';
}

export function getPlanLabel(plan?: string | null) {
  const labels: Record<string, string> = {
    free: 'Em avaliação',
    basic: 'Essencial',
    starter: 'Essencial',
    profissional: 'Pro',
    pro: 'Pro',
    premium: 'Enterprise',
    enterprise: 'Enterprise',
  };

  return labels[plan || ''] ?? 'Plano ativo';
}