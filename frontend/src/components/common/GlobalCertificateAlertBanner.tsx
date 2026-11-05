import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X, ShieldWarning } from '@phosphor-icons/react';
import { guaranteesService } from '../../services/guarantees.service';
import { CertificateAlertsResponse } from '../../types/guarantees.types';
import { FORNECEDOR_ROUTES } from '../../routes';

export const GlobalCertificateAlertBanner: React.FC = () => {
  const [data, setData] = useState<CertificateAlertsResponse | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadAlerts() {
      try {
        const res = await guaranteesService.getCertificateAlerts();
        if (mounted) {
          setData(res);
        }
      } catch (err) {
        // Silencioso para não interromper a UI caso o backend esteja iniciando
        console.error('Falha ao verificar alertas de CND:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAlerts();
    // Checar a cada 10 minutos
    const interval = setInterval(loadAlerts, 10 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || !data || !data.hasCriticalAlert || isDismissed) {
    return null;
  }

  const { totalCriticas, alerts } = data;
  const expiradasCount = (alerts || []).filter(
    (c) => c.isExpired || c.status === 'EXPIRED' || c.diasRestantes <= 0
  ).length;

  return (
    <div
      role="alert"
      className="relative z-40 bg-gradient-to-r from-red-700 via-rose-700 to-red-800 px-4 py-2.5 text-white shadow-lg transition-all"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <ShieldWarning className="h-5 w-5 text-white animate-pulse" weight="bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-200">
                Alerta Crítico • CNDs
              </span>
              <p className="text-sm font-bold text-white">
                {expiradasCount > 0 ? (
                  <>
                    Atenção: <span className="underline decoration-white/40">{expiradasCount} certidão(ões) já EXPIRADA(S)</span> e {totalCriticas - expiradasCount} prestes a vencer em &lt; 15 dias!
                  </>
                ) : (
                  <>
                    Atenção: <span className="underline decoration-white/40">{totalCriticas} certidão(ões) vencendo em menos de 15 dias!</span>
                  </>
                )}
              </p>
            </div>
            <p className="hidden text-xs text-rose-100 sm:block">
              Risco iminente de inabilitação jurídica e retenção de pagamentos contratuais (Art. 96 e 140 da Lei 14.133/2021).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={FORNECEDOR_ROUTES.certidoes}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-black text-red-700 shadow-sm transition hover:bg-rose-50"
          >
            <span>Regularizar Certidões</span>
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
          <Link
            to={FORNECEDOR_ROUTES.gestao_pos_vitoria}
            className="hidden items-center gap-1.5 rounded-lg bg-red-900/40 px-3 py-1.5 text-xs font-bold text-rose-100 transition hover:bg-red-900/60 md:flex"
          >
            Ver Garantias
          </Link>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dispensar aviso por agora"
            className="rounded-lg p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
};

