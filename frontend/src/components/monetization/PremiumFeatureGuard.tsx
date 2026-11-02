import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { PaywallModal } from './PaywallModal';

interface PremiumFeatureGuardProps {
  children: React.ReactNode;
  moduleName?: string;
  requiredFeature?: string;
}

export function isUserFreePlan(_plano?: string | null): boolean {
  const access = useAuthStore.getState();
  return !access.planAccessLoaded || access.activePlanId === 'free';
}

export const PremiumFeatureGuard: React.FC<PremiumFeatureGuardProps> = ({
  children,
  moduleName = 'Módulo Avançado',
  requiredFeature,
}) => {
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const activePlanId = useAuthStore((state) => state.activePlanId);
  const activePlanFeatures = useAuthStore((state) => state.activePlanFeatures);
  const [forcePaywall, setForcePaywall] = useState(false);

  useEffect(() => {
    // Escuta eventos globais de paywall (disparados em caso de 403 das APIs)
    const handlePaywallEvent = () => {
      setForcePaywall(true);
    };

    window.addEventListener('expertise:paywall-triggered', handlePaywallEvent);
    return () => {
      window.removeEventListener('expertise:paywall-triggered', handlePaywallEvent);
    };
  }, []);

  const hasAccess = requiredFeature
    ? activePlanFeatures.includes(requiredFeature)
    : activePlanId !== 'free';
  const showModal = !hasAccess || forcePaywall;

  if (!planAccessLoaded) {
    return (
      <div className="flex min-h-[calc(100vh-100px)] items-center justify-center">
        <span className="text-sm font-semibold text-slate-500">Verificando assinatura e permissões…</span>
      </div>
    );
  }

  if (showModal) {
    return (
      <div className="relative min-h-[calc(100vh-100px)] w-full">
        <PaywallModal
          isOpen={true}
          moduleName={moduleName}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default PremiumFeatureGuard;
