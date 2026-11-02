import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  X,
} from 'lucide-react';
import { FORNECEDOR_ROUTES } from '@/routes';

export interface PaywallModalProps {
  isOpen: boolean;
  onClose?: () => void;
  moduleName?: string;
  title?: string;
  message?: string;
  upgradeButtonLabel?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  moduleName = 'Módulo Avançado',
  title = 'Funcionalidade Premium',
  message = 'Seu plano atual não inclui esta ferramenta. Consulte os planos Básico, Avançado e Master para escolher o acesso adequado.',
  upgradeButtonLabel = 'Fazer Upgrade Agora',
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    navigate(FORNECEDOR_ROUTES.planos);
  };

  const handleVoltar = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(FORNECEDOR_ROUTES.dashboard);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      id="modal-paywall-premium"
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8 space-y-6 text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glow de fundo */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Botão Fechar / Voltar (Opcional) */}
        {onClose && (
          <button
            type="button"
            onClick={handleVoltar}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            title="Fechar"
          >
            <X size={18} />
          </button>
        )}

        {/* Ícone de Destaque com Coroa & Cadeado */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-amber-500 via-[#EA580C] to-orange-600 opacity-20 blur-lg animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0A2540] via-[#0f3458] to-[#1e4a74] text-white flex items-center justify-center shadow-xl border border-white/20">
            <Crown size={28} className="text-amber-400" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#EA580C] text-white flex items-center justify-center border-2 border-white shadow">
              <Lock size={12} />
            </div>
          </div>
        </div>

        {/* Selo do Plano */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#EA580C] text-[11px] font-black uppercase tracking-wider">
            <Sparkles size={12} className="text-amber-500" />
            {moduleName} • Acesso por plano
          </div>

          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {title}
          </h2>
        </div>

        {/* MENSAGEM OBRIGATÓRIA RIGOROSA DO PROMPT */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
          <p className="text-slate-800 text-sm font-bold leading-relaxed">
            {message}
          </p>
        </div>

        {/* Benefícios Estratégicos (CRO) */}
        <div className="text-left space-y-2.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Dossiê Completo de Concorrentes:</strong> Mapeie padrões de lances, contratos ganhos e órgãos habituais.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Gerador de Propostas:</strong> Prepare propostas com as declarações necessárias e consulte seus custos antes de definir os preços.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Análise de Editais:</strong> Consulte resumos, prazos e pontos de atenção para apoiar sua avaliação.
            </span>
          </div>
        </div>

        {/* BOTÃO PRIMÁRIO EXATO: "Fazer Upgrade Agora" */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            id="btn-paywall-upgrade-agora"
            onClick={handleUpgrade}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#EA580C] via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <span>{upgradeButtonLabel}</span>
            <ArrowRight size={18} />
          </button>

          <button
            type="button"
            onClick={handleVoltar}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition py-1 block mx-auto"
          >
            Voltar para a Navegação
          </button>
        </div>

        {/* Rodapé Seguro */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 pt-1">
          <ShieldCheck size={13} className="text-slate-400" />
          <span>Checkout seguro via Mercado Pago • Acesso após confirmação da assinatura</span>
        </div>
      </div>
    </div>
  );
};

export default PaywallModal;
