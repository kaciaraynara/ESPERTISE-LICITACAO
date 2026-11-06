import React from 'react';

export interface LoadingSpinnerProps {
  fullscreen?: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  fullscreen = false,
  message = 'Carregando ambiente da empresa...',
  size = 'md',
}) => {
  const spinnerSize =
    size === 'sm' ? 'h-6 w-6 border-2' : size === 'lg' ? 'h-14 w-14 border-4' : 'h-10 w-10 border-4';

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${spinnerSize} animate-spin rounded-full border-brand-orange border-t-transparent`}
        role="status"
        aria-label="Carregando"
      />
      {message && (
        <p className="text-sm font-bold text-brand-dark tracking-wide animate-pulse">
          {message}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center bg-brand-light font-sans"
        role="status"
        aria-live="polite"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="flex min-h-[300px] w-full items-center justify-center p-6 font-sans" role="status">
      {content}
    </div>
  );
};

export default LoadingSpinner;
