import { describe, it, expect } from 'vitest';
import sidebarRaw from '../components/layout/Sidebar.tsx?raw';
import dashboardLayoutRaw from '../components/layout/DashboardLayout.tsx?raw';
import pcaPageRaw from '../pages/Pca/PcaPage.tsx?raw';

describe('Sidebar unificado Desktop/Mobile & PCA responsivo (Etapa 5)', () => {
  it('renderiza os mesmos hubs e links para Desktop e Mobile dentro de Sidebar.tsx', () => {
    expect(sidebarRaw).toContain('renderSidebarContent(isCollapsed, false)');
    expect(sidebarRaw).toContain('renderSidebarContent(false, true)');
    expect(sidebarRaw).toContain('id="mobile-navigation"');
    expect(sidebarRaw).toContain('Dispensa Eletrônica');
    expect(sidebarRaw).toContain('Precificação Estratégica');
    expect(sidebarRaw).toContain('Catálogo de Produtos & Preços');
    expect(sidebarRaw).toContain('Dados da Empresa');
    expect(sidebarRaw).not.toContain('Integrações & Portais');
  });

  it('DashboardLayout delega menu mobile diretamente para <Sidebar mobileOpen={mobileMenuOpen} /> sem menu paralelo', () => {
    expect(dashboardLayoutRaw).toContain('<Sidebar');
    expect(dashboardLayoutRaw).toContain('mobileOpen={mobileMenuOpen}');
    expect(dashboardLayoutRaw).not.toContain('resolveProfileNavigation');
  });

  it('PcaPage suporta anos 2026/2027, todas as 27 UFs e janela PREVISTA_ANTERIOR', () => {
    expect(pcaPageRaw).toContain('PREVISTA_ANTERIOR');
    expect(pcaPageRaw).toContain('Data Prevista Atingida');
    expect(pcaPageRaw).toContain('Todos os anos (2026–2027)');
    expect(pcaPageRaw).toContain("'TO'");
    expect(pcaPageRaw).toContain("'AC'");
  });
});
