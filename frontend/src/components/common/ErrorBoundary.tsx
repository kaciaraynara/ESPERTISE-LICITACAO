import { Component, ErrorInfo, ReactNode } from 'react';
import { WarningCircle, ArrowClockwise, House } from '@phosphor-icons/react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Enterprise Error Boundary
 * Impede falhas em cascata no React isolando módulos individuais.
 */
export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log seguro sem expor credenciais
    console.error('[Enterprise ErrorBoundary] Falha capturada no módulo:', error, errorInfo);
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public override render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env.DEV);

      return (
        <div
          role="alert"
          className="my-4 flex w-full flex-col items-center justify-center rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg transition-all sm:p-12"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 shadow-inner">
            <WarningCircle className="h-8 w-8" weight="duotone" />
          </div>

          <h3 className="mt-4 text-lg font-black tracking-tight text-[#0A2540] sm:text-xl">
            {this.props.fallbackTitle || 'Módulo Temporariamente Indisponível'}
          </h3>

          <p className="mt-2 max-w-md text-xs font-medium text-slate-500 sm:text-sm">
            {this.props.fallbackMessage ||
              'Ocorreu uma instabilidade pontual ao renderizar este componente. Os demais módulos do sistema continuam operando normalmente.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-[#EA580C] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-orange-600 hover:shadow-lg active:scale-95"
            >
              <ArrowClockwise className="h-4 w-4" weight="bold" />
              Recarregar Módulo
            </button>

            <a
              href="/fornecedor/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 active:scale-95"
            >
              <House className="h-4 w-4" weight="bold" />
              Painel Principal
            </a>
          </div>

          {isDev && this.state.error && (
            <details className="mt-6 w-full max-w-xl text-left">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-red-600">
                Detalhes da Falha (Modo Desenvolvimento)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-red-300">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

