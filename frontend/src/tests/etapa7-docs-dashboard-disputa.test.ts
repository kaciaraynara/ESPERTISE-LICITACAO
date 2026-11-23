import { describe, expect, test } from 'vitest';
import { valorPorExtenso } from '../utils/pdfGenerator';
import dashboardRaw from '../pages/DashboardPage.tsx?raw';
import mesaRaw from '../components/MesaOperacionalDisputa.tsx?raw';
import prazosRaw from '../pages/PrazosAlertas/PrazosAlertasPage.tsx?raw';

describe('Etapa 7 — Propostas Zero-Erro, Dashboard Real, Prazos Auto e Disputa sem Loop Socket', () => {
  test('valorPorExtenso evita bug de ponto flutuante (cem centavos) e trata milhoes e ligacoes corretamente', () => {
    expect(valorPorExtenso(100.996)).toBe('cento e um reais');
    expect(valorPorExtenso(1000000)).toBe('um milhão de reais');
    expect(valorPorExtenso(1050.5)).toBe('mil e cinquenta reais e cinquenta centavos');
    expect(valorPorExtenso(0)).toBe('zero reais');
  });

  test('DashboardPage consome dashboardApi.getMetrics, corrigindo grafia e layout responsivo', () => {
    expect(dashboardRaw).toContain('dashboardApi.getMetrics()');
    expect(dashboardRaw).not.toContain('Órgão Publico');
    expect(dashboardRaw).not.toContain('Objeto nao informado');
    expect(dashboardRaw).toContain('md:hidden');
    expect(dashboardRaw).toContain('hidden md:block');
  });

  test('MesaOperacionalDisputa evita loop de /socket.io/ em URL relativa', () => {
    expect(mesaRaw).toContain('VITE_SOCKET_URL');
    expect(mesaRaw).toContain('/^https?:\\/\\//i.test(BASE_URL)');
    expect(mesaRaw).toContain('socket.disconnect()');
  });

  test('PrazosAlertasPage oferece importacao automatica de prazos dos editais monitorados', () => {
    expect(prazosRaw).toContain('prazosApi.sincronizarMonitorados');
    expect(prazosRaw).toContain('Importar Prazos dos Meus Editais');
  });
});
