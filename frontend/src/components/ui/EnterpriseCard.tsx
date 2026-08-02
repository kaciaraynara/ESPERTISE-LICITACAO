import { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { motion, type MotionProps } from 'framer-motion';

type EnterpriseCardProps<T extends ElementType = 'div'> = {
  as?: T;
  children: ReactNode;
  className?: string;
  hover?: boolean;
  interactive?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'> & MotionProps;

export function EnterpriseCard<T extends ElementType = 'div'>({
  as,
  children,
  className = '',
  hover = true,
  interactive,
  ...props
}: EnterpriseCardProps<T>) {
  const Component = motion(as || 'div');

  return (
    <Component
      whileHover={(interactive ?? hover) ? { scale: 1.02, boxShadow: '0 0 24px rgba(30,58,138,0.12)' } : undefined}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`enterprise-card border border-gray-100 bg-white shadow-[0_4px_20px_rgba(30,58,138,0.05)] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export default EnterpriseCard;
