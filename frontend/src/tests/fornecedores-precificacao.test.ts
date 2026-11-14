import { describe, it, expect } from 'vitest';
import redeFornecedoresContent from '../pages/RedeFornecedoresPage.tsx?raw';
import precificacaoContent from '../pages/Precificacao/PrecificacaoPage.tsx?raw';
import academiaContent from '../pages/Academia/AcademiaPage.tsx?raw';
import expertiseFiscalContent from '../pages/ExpertiseFiscalPage.tsx?raw';

describe('STEP 2: Rede de Fornecedores, Insumos e Formação de Preço com Expertise Fiscal', () => {
  it('1. Rede de Fornecedores segue o padrão Mestre-Detalhe oficial com destaque em laranja', () => {
    // Destaque de seleção ativa na tabela
    expect(redeFornecedoresContent).toMatch(/ring-\[#FF6600\]|border-\[#FF6600\]/);
    expect(redeFornecedoresContent).toContain('bg-orange-50/40');

    // Botões primários em laranja oficial (#FF6600)
    expect(redeFornecedoresContent).toContain('bg-[#FF6600]');
    expect(redeFornecedoresContent).toContain('Cadastrar fornecedor');
    expect(redeFornecedoresContent).toContain('Editar fornecedor');
  });

  it('2. Rede de Fornecedores integra consulta oficial automática de CNPJ pela BrasilAPI', () => {
    expect(redeFornecedoresContent).toContain('https://brasilapi.com.br/api/cnpj/v1/');
    expect(redeFornecedoresContent).toContain('razao_social');
    expect(redeFornecedoresContent).toContain('cnae_fiscal_descricao');
    expect(redeFornecedoresContent).toContain('Buscar dados do CNPJ');
  });

  it('3. Rede de Fornecedores permite anexar Notas Fiscais via QR Code, Câmera e PDF monitoradas pela Luli', () => {
    expect(redeFornecedoresContent).toContain('qrcode');
    expect(redeFornecedoresContent).toContain('BarcodeDetector');
    expect(redeFornecedoresContent).toContain('capturarFotoDaCamera');
    expect(redeFornecedoresContent).toContain('Monitorada pela Luli');
    expect(redeFornecedoresContent).toContain('Ler QR Code ou Anexar Nota Fiscal');
  });

  it('4. Precificação Estratégica elimina termos técnicos proibidos (BDI, Stop-Loss)', () => {
    // Zero jargões técnicos para o usuário
    expect(precificacaoContent).not.toContain('BDI');
    expect(precificacaoContent).not.toContain('Stop-Loss');

    // Linguagem profissional da plataforma
    expect(precificacaoContent).toContain('formação de preço segura');
    expect(precificacaoContent).toContain('margem segura');
  });

  it('5. Academia do Licitante utiliza os termos oficiais (Proteção de Margem) sem Stop-Loss ou BDI', () => {
    expect(academiaContent).not.toContain('Stop-Loss');
    expect(academiaContent).not.toContain('BDI');
    expect(academiaContent).toContain('Proteção de Margem');
  });

  it('6. Expertise Fiscal atua na auditoria de retenções e simulação da Reforma Tributária (CBS/IBS)', () => {
    expect(expertiseFiscalContent).toContain('auditoria_fiscal');
    expect(expertiseFiscalContent).toContain('reforma');
    expect(expertiseFiscalContent).toContain('creditos');
    expect(expertiseFiscalContent).toContain('SIMPLES_NACIONAL');
    expect(expertiseFiscalContent).toContain('LUCRO_PRESUMIDO');
    expect(expertiseFiscalContent).toContain('LUCRO_REAL');
  });
});

