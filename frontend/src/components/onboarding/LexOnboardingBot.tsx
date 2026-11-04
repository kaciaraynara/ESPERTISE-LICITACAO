import React, { useEffect, useState } from 'react';
import {
  Joyride,
  ACTIONS,
  EVENTS,
  EventData,
  STATUS,
  Step,
} from 'react-joyride';
import { Sparkles, X, ArrowRight, Play } from 'lucide-react';

const STORAGE_KEY = '@expertise:tutorial_completed';

export const LexOnboardingBot: React.FC = () => {
  const [showBubble, setShowBubble] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const isCompleted = localStorage.getItem(STORAGE_KEY);
    if (!isCompleted) {
      // Delay slightly so layout stabilizes before showing the welcome bubble
      const timer = setTimeout(() => {
        setShowBubble(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleStartTour = () => {
    setShowBubble(false);
    setStepIndex(0);
    setRunTour(true);
  };

  const handleDismiss = () => {
    setShowBubble(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleJoyrideCallback = (data: EventData) => {
    const { action, index, status, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      localStorage.setItem(STORAGE_KEY, 'true');
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }
  };

  const steps: Step[] = [
    {
      target: '[data-tour="sidebar-menu"]',
      title: 'Menu de Ferramentas Liberadas',
      content:
        'Durante o seu período de teste, todas as 16 ferramentas estão 100% liberadas: Radar de Editais, Captação, Gestor de Propostas, CRM de Disputas, Contratos e muito mais.',
      skipBeacon: true,
      placement: 'right',
    },
    {
      target: '[data-tour="executive-header"]',
      title: 'Painel Executivo',
      content:
        'Acompanhe os principais indicadores da sua operação em tempo real: editais monitorados, propostas ativas e taxa de assertividade.',
      skipBeacon: true,
      placement: 'bottom',
    },
    {
      target: '[data-tour="radar-opportunities"]',
      title: 'Busca e Radar de Editais',
      content:
        'Editais capturados e pré-filtrados de acordo com o CNAE da sua empresa sob as regras da Lei 14.133/2021. Clique para examinar cada oportunidade.',
      skipBeacon: true,
      placement: 'top',
    },
    {
      target: '[data-tour="company-selector"]',
      title: 'Seletor de Organização / Filiais',
      content:
        'Alterne rapidamente entre empresas cadastradas e CNPJs para segmentar disputas, propostas e certificados em um só lugar.',
      skipBeacon: true,
      placement: 'bottom',
    },
    {
      target: '[data-tour="lex-assistant"]',
      title: 'Assistente Jurídico LEX',
      content:
        'Eu sou o LEX, seu copiloto de inteligência jurídica. Clique aqui sempre que precisar calcular prazos, impugnar itens restritivos ou tirar dúvidas sobre a Lei 14.133/2021.',
      skipBeacon: true,
      placement: 'top',
    },
  ];

  return (
    <>
      <Joyride
        steps={steps}
        run={runTour}
        stepIndex={stepIndex}
        continuous
        onEvent={handleJoyrideCallback}
        options={{
          primaryColor: '#EA580C',
          textColor: '#0A2540',
          backgroundColor: '#FFFFFF',
          overlayColor: 'rgba(10, 37, 64, 0.65)',
          zIndex: 99999,
          showProgress: true,
          scrollOffset: 100,
        }}
        locale={{
          back: 'Voltar',
          close: 'Fechar',
          last: 'Concluir Tour',
          next: 'Próximo',
          open: 'Abrir',
          skip: 'Pular Tour',
        }}
        styles={{
          tooltip: {
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(10, 37, 64, 0.25)',
            border: '1px solid #E2E8F0',
            padding: '20px 22px',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          tooltipTitle: {
            fontSize: '15px',
            fontWeight: 800,
            color: '#0A2540',
            marginBottom: '8px',
          },
          tooltipContent: {
            fontSize: '13px',
            lineHeight: '1.6',
            color: '#475569',
          },
          buttonPrimary: {
            backgroundColor: '#EA580C',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '8px 16px',
            color: '#FFFFFF',
            border: 'none',
            outline: 'none',
          },
          buttonBack: {
            color: '#64748B',
            fontSize: '12px',
            fontWeight: 700,
            marginRight: '8px',
          },
          buttonSkip: {
            color: '#94A3B8',
            fontSize: '12px',
            fontWeight: 600,
          },
          buttonClose: {
            display: 'none',
          },
        }}
      />

      {/* Balão Flutuante de Boas-Vindas do Lex */}
      {showBubble && !runTour && (
        <div
          role="dialog"
          aria-label="Boas-vindas do assistente Lex"
          className="fixed bottom-24 right-6 z-[9998] max-w-sm w-[calc(100vw-3rem)] sm:w-96 rounded-2xl bg-white p-5 shadow-2xl border border-slate-200/80 animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0A2540] to-slate-800 p-1 shadow-md border border-orange-500/30">
                  <img
                    src="/assets/mascote-3d.png"
                    alt="Lex - Copiloto"
                    className="h-10 w-10 object-contain drop-shadow"
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
                </span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-[#0A2540]">Lex</h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-[#EA580C] border border-orange-200">
                    <Sparkles className="h-2.5 w-2.5" />
                    Copiloto Ativo
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500">
                  Inteligência Especializada
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dispensar tutorial"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mensagem solicitada */}
          <div className="mt-3.5 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
            <p className="text-xs font-semibold leading-relaxed text-slate-700">
              👋 Olá! Sou o <span className="font-bold text-[#0A2540]">Lex</span>, seu assistente.
              Vamos conhecer a plataforma?
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Preparamos um tour rápido de 1 minuto para você dominar as principais ferramentas liberadas.
            </p>
          </div>

          {/* Ações */}
          <div className="mt-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              Agora não
            </button>
            <button
              type="button"
              onClick={handleStartTour}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#EA580C] to-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-orange-600 hover:to-orange-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              Vamos conhecer!
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default LexOnboardingBot;

