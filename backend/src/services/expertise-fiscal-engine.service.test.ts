import { expertiseFiscalEngineService } from './expertise-fiscal-engine.service';
import { prisma } from '../database/prisma';

jest.mock('../database/prisma', () => ({
  prisma: {
    fiscalDocumentImport: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    taxCreditOpportunity: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    catalogItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    procurementNotice: {
      findFirst: jest.fn(),
    },
    taxRuleVersion: {
      findMany: jest.fn(),
    },
  },
}));

describe('ExpertiseFiscalEngineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isMonophasicNcm', () => {
    it('deve identificar corretamente NCMs sujeitos à tributação monofásica de PIS/COFINS', () => {
      // Autopeças
      expect(expertiseFiscalEngineService.isMonophasicNcm('87082999')).toBe(true);
      // Medicamentos
      expect(expertiseFiscalEngineService.isMonophasicNcm('30049099')).toBe(true);
      // Cosméticos
      expect(expertiseFiscalEngineService.isMonophasicNcm('33049990')).toBe(true);
      // Bebidas frias
      expect(expertiseFiscalEngineService.isMonophasicNcm('22021000')).toBe(true);
      // Combustíveis
      expect(expertiseFiscalEngineService.isMonophasicNcm('27101932')).toBe(true);
    });

    it('deve retornar false para NCMs tributados no regime geral', () => {
      expect(expertiseFiscalEngineService.isMonophasicNcm('96081000')).toBe(false); // Caneta
      expect(expertiseFiscalEngineService.isMonophasicNcm('84713012')).toBe(false); // Notebook
      expect(expertiseFiscalEngineService.isMonophasicNcm('48025610')).toBe(false); // Papel sulfite
      expect(expertiseFiscalEngineService.isMonophasicNcm('')).toBe(false);
    });
  });

  describe('parseNfeXml', () => {
    it('deve extrair chave de acesso, emitente, destinatário, CRT, retenções e itens', () => {
      const mockXml = `
        <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
          <NFe>
            <infNFe Id="NFe35240312345678000195550010000000011234567890">
              <ide>
                <natOp>Venda para Orgao Publico</natOp>
                <dhEmi>2026-03-15T10:00:00-03:00</dhEmi>
              </ide>
              <emit>
                <CNPJ>12345678000195</CNPJ>
                <xNome>Licitante Vencedor Ltda</xNome>
                <CRT>1</CRT>
              </emit>
              <dest>
                <CNPJ>00394460000141</CNPJ>
                <xNome>Ministerio da Fazenda</xNome>
              </dest>
              <det nItem="1">
                <prod>
                  <cProd>AUTO-001</cProd>
                  <xProd>Pastilha de Freio Automotiva</xProd>
                  <NCM>87083090</NCM>
                  <CFOP>5102</CFOP>
                  <uCom>JG</uCom>
                  <qCom>10.0000</qCom>
                  <vUnCom>120.0000000000</vUnCom>
                  <vProd>1200.00</vProd>
                </prod>
                <imposto>
                  <ICMS><ICMSSN102><CSOSN>102</CSOSN></ICMSSN102></ICMS>
                  <PIS><vPIS>0.00</vPIS></PIS>
                  <COFINS><vCOFINS>0.00</vCOFINS></COFINS>
                </imposto>
              </det>
              <total>
                <ICMSTot>
                  <vNF>1200.00</vNF>
                  <vICMS>0.00</vICMS>
                  <vPIS>0.00</vPIS>
                  <vCOFINS>0.00</vCOFINS>
                </ICMSTot>
                <retTrib>
                  <vRetPIS>7.80</vRetPIS>
                  <vRetCOFINS>36.00</vRetCOFINS>
                  <vRetCSLL>12.00</vRetCSLL>
                  <vIRRF>14.40</vIRRF>
                  <vRetPrev>0.00</vRetPrev>
                </retTrib>
              </total>
            </infNFe>
          </NFe>
        </nfeProc>
      `;

      const summary = expertiseFiscalEngineService.parseNfeXml(mockXml, '12345678000195');

      expect(summary.chaveAcesso).toBe('35240312345678000195550010000000011234567890');
      expect(summary.emitenteCnpj).toBe('12345678000195');
      expect(summary.emitenteCrt).toBe(1); // Simples Nacional
      expect(summary.direction).toBe('SAIDA');
      expect(summary.totalAmount).toBe(1200.0);
      expect(summary.vRetPis).toBe(7.8);
      expect(summary.vRetCofins).toBe(36.0);
      expect(summary.vRetCsll).toBe(12.0);
      expect(summary.vIrrf).toBe(14.4);
      expect(summary.items.length).toBe(1);
      expect(summary.items[0].cProd).toBe('AUTO-001');
      expect(summary.items[0].isMonofasico).toBe(true);
    });
  });

  describe('validateCreditLock (Trava de 5 Etapas)', () => {
    it('deve reprovar crédito com status POTENTIAL na Trava 4 (Pendente de Validação CRC/OAB)', async () => {
      (prisma.taxCreditOpportunity.findFirst as jest.Mock).mockResolvedValue({
        id: 'credit-1',
        companyId: 'comp-1',
        principalAmount: 5000,
        isDocumented: true,
        isLegallyUsable: true,
        status: 'POTENTIAL',
        isAvailableForOffset: true,
        usedInProposalId: null,
      });

      const result = await expertiseFiscalEngineService.validateCreditLock('credit-1', 'comp-1');

      expect(result.passed).toBe(false);
      expect(result.lockResults.lock1Exists).toBe(true);
      expect(result.lockResults.lock2Documented).toBe(true);
      expect(result.lockResults.lock3LegallyUsable).toBe(true);
      expect(result.lockResults.lock4Validated).toBe(false);
      expect(result.reason).toContain('Trava 4 violada');
    });

    it('deve aprovar com 5/5 quando o crédito estiver VALIDATED e documentado', async () => {
      (prisma.taxCreditOpportunity.findFirst as jest.Mock).mockResolvedValue({
        id: 'credit-2',
        companyId: 'comp-1',
        principalAmount: 3500,
        isDocumented: true,
        isLegallyUsable: true,
        status: 'VALIDATED',
        isAvailableForOffset: true,
        usedInProposalId: null,
      });

      const result = await expertiseFiscalEngineService.validateCreditLock('credit-2', 'comp-1');

      expect(result.passed).toBe(true);
      expect(result.lockResults.lock1Exists).toBe(true);
      expect(result.lockResults.lock2Documented).toBe(true);
      expect(result.lockResults.lock3LegallyUsable).toBe(true);
      expect(result.lockResults.lock4Validated).toBe(true);
      expect(result.lockResults.lock5Available).toBe(true);
    });
  });

  describe('simulateBiddingPriceWithTaxIntelligence', () => {
    it('deve calcular Cenário A e Cenário B respeitando o piso legal de exequibilidade do Art. 59', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Fornecedor Teste',
        cnpj: '12345678000195',
      });

      (prisma.procurementNotice.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.taxRuleVersion.findMany as jest.Mock).mockResolvedValue([]);

      const result = await expertiseFiscalEngineService.simulateBiddingPriceWithTaxIntelligence({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        directCost: 10000,
        operationalExpenses: 1000,
        targetMarginPercent: 15,
        creditOpportunityIds: [],
      });

      expect(result.premissas.custoTotal).toBe(11000);
      expect(result.cenarioA_Padrao.precoVenda).toBeGreaterThan(11000);
      expect(result.premissas.pisoExequibilidadeLei14133Art59).toBeGreaterThan(11000);
      expect(result.cenarioA_Padrao.precoVenda).toBeGreaterThanOrEqual(result.premissas.pisoExequibilidadeLei14133Art59);
      expect(result.cenarioA_Padrao.statusExequibilidade).toBe('EXEQUIBILIDADE_PLENA');
    });
  });
});

