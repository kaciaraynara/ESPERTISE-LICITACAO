import { describe, it, expect } from 'vitest';
import DossieEditalModal from '../components/DossieEditalModal';
import modalContent from '../components/DossieEditalModal.tsx?raw';
import pageContent from '../pages/LicitacoesPage.tsx?raw';

describe('Dossiê Estratégico do Edital (DossieEditalModal.tsx)', () => {
  it('1. Exporta DossieEditalModal como componente React válido', () => {
    expect(typeof DossieEditalModal).toBe('function');
  });

  it('2. Cabeçalho possui o título oficial e os dois botões de ação exigidos', () => {
    // Título oficial
    expect(modalContent).toContain('Dossiê Estratégico do Edital');

    // Botões de Ação
    expect(modalContent).toContain('Baixar em PDF');
    expect(modalContent).toContain('Ver no Portal Oficial do PNCP ↗');
  });

  it('3. Seção 1: Identificação do certame com todos os dados e objeto integral', () => {
    expect(modalContent).toContain('Seção 1: Identificação do Certame');
    expect(modalContent).toContain('Órgão Comprador');
    expect(modalContent).toContain('CNPJ Oficial & Registro');
    expect(modalContent).toContain('Amparo Legal & Modalidade');
    expect(modalContent).toContain('Lei 14.133/2021');
    expect(modalContent).toContain('Objeto Integral da Contratação');
    expect(modalContent).toContain('Termo de Referência');
    // Não tem line-clamp truncando o objeto na Seção 1
    expect(modalContent).toContain('whitespace-pre-wrap');
  });

  it('4. Seção 2: Tabela oficial de itens e valores com colunas especificadas', () => {
    expect(modalContent).toContain('Seção 2: Tabela Oficial de Itens e Valores');
    expect(modalContent).toContain('Item #');
    expect(modalContent).toContain('Descrição Detalhada');
    expect(modalContent).toContain('Quantidade');
    expect(modalContent).toContain('Unidade');
    expect(modalContent).toContain('Valor Unitário Estimado');
    expect(modalContent).toContain('Valor Total');
  });

  it('5. Seção 3: Checklist de Habilitação Documental com os 6 requisitos legais', () => {
    expect(modalContent).toContain('Seção 3: Checklist de Habilitação Documental');
    expect(modalContent).toContain('Habilitação Jurídica');
    expect(modalContent).toContain('Regularidade Fiscal');
    expect(modalContent).toContain('Regularidade Trabalhista');
    expect(modalContent).toContain('Qualificação Econômico-Financeira');
    expect(modalContent).toContain('Atestados de Capacidade Técnica');
    expect(modalContent).toContain('Declarações da Lei 14.133/2021');
  });

  it('6. Seção 4: Passo a Passo Operacional para disputar com as 3 etapas', () => {
    expect(modalContent).toContain('Seção 4: Passo a Passo Operacional para Disputar');
    expect(modalContent).toContain('Cadastrar proposta de preços');
    expect(modalContent).toContain('Inserir declarações e documentos');
    expect(modalContent).toContain('Acessar sala de lances com antecedência');
  });

  it('7. LicitacoesPage integra DossieEditalModal com acionamento ao clicar na linha ou no botão', () => {
    expect(pageContent).toContain('DossieEditalModal');
    expect(pageContent).toContain('setEditalParaDossie');
    expect(pageContent).toContain('Dossiê do Edital');
  });
});
