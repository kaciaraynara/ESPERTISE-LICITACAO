import { describe, expect, test } from 'vitest';
import credenciamentoRaw from '../pages/CredenciamentoPage.tsx?raw';
import catalogoRaw from '../pages/Catalogo/CatalogoPage.tsx?raw';
import precificacaoRaw from '../pages/Precificacao/PrecificacaoPage.tsx?raw';
import integracoesRaw from '../pages/IntegracoesPage.tsx?raw';

describe('Etapa 6 — SICAF, CATMAT/CATSER, APIs Abertas e Layout Responsivo', () => {
  test('CredenciamentoPage remove placeholders antigos e consome integracoesApi.consultarSicaf', () => {
    expect(credenciamentoRaw).toContain('integracoesApi.consultarSicaf');
    expect(credenciamentoRaw).not.toContain('ainda não está integrada');
    expect(credenciamentoRaw).not.toContain('const portais: PortalCredenciamento[] = []');
    expect(credenciamentoRaw).toContain('grid-cols-1');
    expect(credenciamentoRaw).toContain('md:hidden');
    expect(credenciamentoRaw).toContain('hidden md:block');
  });

  test('CatalogoPage expoe aba oficial CATMAT/CATSER com norte de mediana e importacao', () => {
    expect(catalogoRaw).toContain('catalogoApi.buscarCatmatCatser');
    expect(catalogoRaw).toContain('Catálogo Oficial CATMAT / CATSER & Preços');
    expect(catalogoRaw).toContain('Meu Catálogo da Empresa');
    expect(catalogoRaw).toContain('Mediana (Norte Recomendado)');
    expect(catalogoRaw).toContain('Simular na Precificação');
  });

  test('PrecificacaoPage e IntegracoesPage integram CATMAT/CATSER e Indices BCB SGS', () => {
    expect(precificacaoRaw).toContain('Aplicar Mediana como Referência');
    expect(precificacaoRaw).toContain('CATSER');
    expect(precificacaoRaw).toContain('CATMAT');

    expect(integracoesRaw).toContain('integracoesApi.indicesEconomicos');
    expect(integracoesRaw).toContain('IPCA Acumulado');
    expect(integracoesRaw).toContain('IGP-M Acumulado');
    expect(integracoesRaw).toContain('Taxa SELIC Meta Anual');
  });
});
