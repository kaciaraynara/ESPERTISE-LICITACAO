import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { NivelScore } from '@/types';
import { Loader2 } from '@components/icons/phosphor-compat';
export { EnterpriseCard } from './EnterpriseCard';
export { default as CalculadoraViabilidade } from '../licitacoes/CalculadoraViabilidade';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50';
  const variants = {
    primary: 'bg-brand-blue text-white shadow-[0_4px_20px_rgba(30,58,138,0.05)] hover:bg-[#172554]',
    secondary: 'border border-gray-100 bg-white text-brand-blue hover:border-brand-blue/20',
    ghost: 'bg-transparent text-brand-blue hover:bg-white',
    danger: 'border border-brand-orange/35 bg-[#F3F1FF] text-[#45378F] hover:bg-[#E8E3FF]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hover, onClick }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, boxShadow: '0 0 24px rgba(30,58,138,0.12)' } : undefined}
      onClick={onClick}
      className={`enterprise-card ${hover ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}

interface ScoreBadgeProps {
  pontuacao: number;
  nivel: NivelScore;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ pontuacao, nivel, size = 'md' }: ScoreBadgeProps) {
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1', lg: 'text-base px-3 py-1.5' };
  const tone = nivel === 'baixo' ? 'border-brand-orange/35 bg-[#F3F1FF]' : 'border-brand-blue/20 bg-white';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border font-bold text-brand-blue ${tone} ${sizes[size]}`}>
      <span className="h-1.5 w-1.5 rounded-md bg-current" />
      {pontuacao}
      <span className="text-xs font-medium opacity-70">/100</span>
    </span>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: 'green' | 'violet' | 'red' | 'blue' | 'gray';
  size?: 'sm' | 'md';
}

export function Badge({ children, color = 'gray', size = 'md' }: BadgeProps) {
  const colors = {
    green: 'border-brand-blue/20 bg-white text-brand-blue',
    violet: 'border-brand-orange/35 bg-[#F3F1FF] text-[#45378F]',
    red: 'border-[#E02424]/25 bg-[#FDF2F2] text-[#9B1C1C]',
    blue: 'border-brand-blue/20 bg-white text-brand-blue',
    gray: 'border-gray-100 bg-white text-brand-blue/70',
  };
  const sizes = { sm: 'text-xs px-1.5 py-0.5', md: 'text-xs px-2 py-1' };

  return (
    <span className={`inline-flex items-center rounded-md border font-medium ${colors[color]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#334155]">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]">{icon}</div>}
        <input
          className={`w-full rounded-md border ${error ? 'border-[#E02424]/35' : 'border-[#E2E8F0]'} bg-white ${icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 text-sm text-[#334155] placeholder:text-[#9AA6AE] transition focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/10 ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-[#9B1C1C]">{error}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white ${className}`} />;
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-brand-blue/40">{icon}</div>
      <h3 className="mb-2 text-lg font-bold text-brand-blue">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-brand-blue/70">{description}</p>
      {action}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: string;
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <Card>
      <div className="mb-4 flex items-start justify-between">
        <div className="rounded-md border border-gray-100 bg-white p-2 text-brand-blue">{icon}</div>
        {trend && (
          <span className="text-xs font-bold text-brand-blue">
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <p className="mb-1 text-2xl font-bold text-brand-blue">{value}</p>
      <p className="text-sm font-medium text-brand-blue/70">{label}</p>
    </Card>
  );
}
