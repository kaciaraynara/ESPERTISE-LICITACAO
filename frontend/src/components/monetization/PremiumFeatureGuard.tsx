import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { hasActivePaidPlan, isUserTrialActive } from '@/components/layout/Sidebar';
import { PaywallModal } from './PaywallModal';

interface PremiumFeatureGuardProps {
  children: React.ReactNode;
  moduleName?: string;
  requiredFeature?: string;
}

export function isUserFreePlan(_plano?: string | null): boolean {
  const access = useAuthStore.getState();
  if (isUserTrialActive(access.user)) return false;
  return access.planAccessLoaded && !hasActivePaidPlan(access.user, access.activePlanId);
}

export const PremiumFeatureGuard: React.FC<PremiumFeatureGuardProps> = ({
  children,
  moduleName = 'Módulo Avançado',
  requiredFeature,
}) => {
  const user = useAuthStore((state) => state.user);
  const planAccessLoaded = useAuthStore((state) => state.planAccessLoaded);
  const activePlanId = useAuthStore((state) => state.activePlanId);
  const activePlanFeatures = useAuthStore((state) => state.activePlanFeatures);
  const [forcePaywall, setForcePaywall] = useState(false);

  useEffect(() => {
    // Escuta eventos globais de paywall (disparados em caso de 403 das APIs)
    const handlePaywallEvent = () => {
      if (!isUserTrialActive(useAuthStore.getState().user)) {
        setForcePaywall(true);
      }
    };

    window.addEventListener('expertise:paywall-triggered', handlePaywallEvent);
    return () => {
      window.removeEventListener('expertise:paywall-triggered', handlePaywallEvent);
    };
  }, []);

  const isTrialActive = isUserTrialActive(user);

  // Durante os 15 dias de Trial (isTrialActive = true), o utilizador tem acesso total e irrestrito
  // às 4 Centrais Estratégicas sem qualquer modal de bloqueio.
  if (isTrialActive) {
    return <>{children}</>;
  }

  const hasPaidPlan = hasActivePaidPlan(user, activePlanId);
  const hasAccess = requiredFeature
    ? activePlanFeatures.includes(requiredFeature) || hasPaidPlan
    : hasPaidPlan;
  const showModal = planAccessLoaded && (!hasAccess || forcePaywall);

  if (!planAccessLoaded) {
    return <>{children}</>;
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
