import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LandingPage from './pages/LandingPage';
import AuthPages from './pages/AuthPages';
import './styles/index.css';

const publicPages: Record<string, React.ReactElement> = {
  '/': <LandingPage />,
  '/login': <AuthPages />,
  '/register': <AuthPages />,
};

export function render(url: string) {
  const page = publicPages[url];
  if (!page) throw new Error(`Rota publica nao configurada para SSG: ${url}`);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

  return renderToString(
    <StaticRouter location={url}>
      <QueryClientProvider client={queryClient}>{page}</QueryClientProvider>
    </StaticRouter>,
  );
}
