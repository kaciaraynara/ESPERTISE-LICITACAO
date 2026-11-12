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
      updateMany: jest.fn(),
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
    contract: {
      findMany: jest.fn(),
    },
    contractTaxLedger: {
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
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

  describe('Módulo 05: runSmartFiscalAudit & Declaração Anexo IV', () => {
    it('deve identificar retenção indevida do Simples Nacional e CFOP inadequado para órgão público', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Mega Suprimentos Ltda',
        cnpj: '12345678000195',
        logradouro: 'Av. Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        municipio: 'São Paulo',
        uf: 'SP',
        cep: '01310-100',
      });

      (prisma.fiscalDocumentImport.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'doc-1',
          accessKeyOrPeriod: '35240312345678000195550010000000011234567890',
          direction: 'SAIDA',
          totalAmount: 10000,
          taxesSummaryJson: {
            emitenteCrt: 1, // Simples Nacional
            destinatarioRazao: 'PREFEITURA MUNICIPAL DE TESTE',
            vIrrf: 120,
            vRetPis: 65,
            vRetCofins: 300,
            vRetCsll: 100,
          },
          parsedItemsJson: [
            {
              nItem: 1,
              cProd: 'PROD-01',
              xProd: 'Material de Escritorio',
              ncm: '00000000', // NCM genérico inválido
              cfop: '5152', // Transferência (inadequado em venda para governo)
              qCom: 10,
              vUnCom: 1000,
              vProd: 10000,
              cstOrCsosn: '102',
            },
          ],
        },
      ]);

      const audit = await expertiseFiscalEngineService.runSmartFiscalAudit({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        orgaoDestinatarioNome: 'Prefeitura Municipal de Teste',
      });

      expect(audit.statusAuditoria).toBe('CRITICA');
      expect(audit.totalDivergencias).toBeGreaterThanOrEqual(2);

      // Divergência de Retenção Indevida
      const divRetencao = audit.divergencias.find((d) => d.tipo === 'RETENCAO_INDEVIDA_SIMPLES');
      expect(divRetencao).toBeDefined();
      expect(divRetencao?.severidade).toBe('ALTA');
      expect(divRetencao?.impactoFinanceiroEstimado).toBe(585);
      expect(divRetencao?.riscoNoEmpenho).toContain('glosa na liquidação do empenho');

      // Divergência de CFOP
      const divCfop = audit.divergencias.find((d) => d.tipo === 'CFOP_INADEQUADO_ORGAO_PUBLICO');
      expect(divCfop).toBeDefined();
      expect(divCfop?.severidade).toBe('ALTA');

      // Declaração Anexo IV
      expect(audit.declaracaoNaoRetencaoAnexoIV).toBeDefined();
      expect(audit.declaracaoNaoRetencaoAnexoIV.titulo).toContain('Anexo IV da IN RFB nº 1.234/2012');
      expect(audit.declaracaoNaoRetencaoAnexoIV.modeloTextoPreenchido).toContain('MEGA SUPRIMENTOS LTDA');
      expect(audit.declaracaoNaoRetencaoAnexoIV.modeloTextoPreenchido).toContain('12.345.678/0001-95');
      expect(audit.declaracaoNaoRetencaoAnexoIV.modeloTextoPreenchido).toContain('Prefeitura Municipal de Teste');
      expect(audit.declaracaoNaoRetencaoAnexoIV.modeloTextoPreenchido).toContain('INSTRUÇÃO NORMATIVA RFB Nº 1.234');
    });

    it('deve detectar NCM incompatível com o código CATMAT do edital e auditar registros SPED (0200/C170)', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Mega Suprimentos Ltda',
        cnpj: '12345678000195',
        municipio: 'São Paulo',
        uf: 'SP',
      });

      (prisma.procurementNotice.findFirst as jest.Mock).mockResolvedValue({
        id: 'notice-catmat-1',
        numeroControlePncp: '00394460000141-1-000100/2026',
        objeto: 'Aquisição de equipamentos de informática',
        items: [
          {
            id: 'item-ed-1',
            itemNumber: 1,
            description: 'Notebook Corporativo',
            catalogoCodigo: 'CATMAT-482910',
            ncm: '84713012',
          },
        ],
      });

      (prisma.fiscalDocumentImport.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'doc-sped-1',
          docType: 'SPED_FISCAL',
          accessKeyOrPeriod: '01032026_31032026',
          direction: 'SAIDA',
          totalAmount: 15000,
          taxesSummaryJson: {
            emitenteCrt: 1,
            destinatarioRazao: 'MINISTERIO DA GESTAO',
          },
          parsedItemsJson: [
            {
              nItem: 1,
              cProd: 'NB-01',
              xProd: 'Notebook Corporativo',
              ncm: '39269090', // NCM de plástico incompatível com NCM 8471 do CATMAT
              cfop: '5102',
              qCom: 3,
              vUnCom: 5000,
              vProd: 15000,
              cstOrCsosn: '102',
            },
          ],
        },
      ]);

      const audit = await expertiseFiscalEngineService.runSmartFiscalAudit({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        noticeId: 'notice-catmat-1',
      });

      const divCatmat = audit.divergencias.find((d) => d.tipo === 'NCM_INCOMPATIVEL_CATMAT');
      expect(divCatmat).toBeDefined();
      expect(divCatmat?.severidade).toBe('ALTA');
      expect(divCatmat?.descricaoDivergencia).toContain('CATMAT-482910');
    });
  });

  describe('Módulo 07: preparePerdcompAndCrossOffset', () => {
    it('deve exigir CRC ou OAB para validação de crédito e bloquear se ausente', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Empresa Teste',
        cnpj: '12345678000195',
      });

      await expect(
        expertiseFiscalEngineService.preparePerdcompAndCrossOffset({
          tenantId: 'tenant-1',
          companyId: 'comp-1',
          validationPayload: {
            creditId: 'credit-sem-registro',
            validatedByProfessionalName: '',
            validatedByRegistryCrcOab: '',
          },
        }),
      ).rejects.toThrow('É obrigatório informar o Nome Completo e o Registro Profissional');
    });

    it('deve estruturar o espelho do PER/DCOMP Web e calcular compensação cruzada na DCTFWeb', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Empresa Teste Ltda',
        cnpj: '12345678000195',
      });

      (prisma.taxCreditOpportunity.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cred-1',
          companyId: 'comp-1',
          taxType: 'IRRF_CSLL_PIS_COFINS',
          originCategory: 'RETENCAO_IN1234',
          status: 'VALIDATED',
          principalAmount: 5000,
          legalBasis: 'Art. 4º, XI da IN RFB 1.234/2012',
          calculationMemoryJson: {
            chaveAcesso: '35240312345678000195550010000000011234567890',
            dataEmissao: '2026-02-10T12:00:00Z',
          },
          validatedByProfessionalName: 'Dra. Roberta Santos',
          validatedByRegistryCrcOab: 'OAB/SP 456.789',
          validatedAt: new Date(),
          perdcompProtocol: null,
          isLegallyUsable: true,
          isAvailableForOffset: true,
        },
      ]);

      const result = await expertiseFiscalEngineService.preparePerdcompAndCrossOffset({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        debitosParaCompensar: [
          {
            tipoDebito: 'ESOCIAL_PREVIDENCIARIO',
            competencia: '03/2026',
            codigoReceita: '1082-01',
            valorOriginalDebito: 3000,
          },
        ],
      });

      expect(result.espelhosPerdcompWeb).toHaveLength(1);
      const espelho = result.espelhosPerdcompWeb[0];
      expect(espelho.valorPrincipalOriginal).toBe(5000);
      expect(espelho.valorAtualizadoTotal).toBeGreaterThan(5000); // Com juros SELIC
      expect(espelho.responsavelTecnicoValidacao.nome).toBe('Dra. Roberta Santos');
      expect(espelho.responsavelTecnicoValidacao.registroCrcOuOab).toBe('OAB/SP 456.789');
      expect(espelho.espelhoFormularioEcac.campo01_IdentificacaoContribuinte).toContain('12.345.678/0001-95');

      // Compensação Cruzada: crédito fazendário (5.000 + SELIC) abatendo débito previdenciário (3.000)
      expect(result.capacidadeAbatimentoCruzadoDctfWeb.creditosFazendariosParaDebitosPrevidenciarios).toBe(3000);
      expect(result.capacidadeAbatimentoCruzadoDctfWeb.saldoFinalDevedorAposCompensacao).toBe(0);
      expect(result.capacidadeAbatimentoCruzadoDctfWeb.saldoRestanteCreditosParaFuturasDcomp).toBeGreaterThan(2000);
      expect(result.fundamentoJuridicoCompensacaoCruzada).toContain('Lei nº 13.670/2018');
    });
  });

  describe('Módulos 01 a 03: NFS-e, Scanner de Créditos e Reforma Tributária', () => {
    it('deve fazer parse de XML de NFS-e extraindo retenções e serviços', () => {
      const nfseXml = `
        <CompNfse>
          <Nfse>
            <InfNfse>
              <Numero>202600045</Numero>
              <DataEmissao>2026-04-15T10:00:00</DataEmissao>
              <OptanteSimplesNacional>1</OptanteSimplesNacional>
              <Servico>
                <Valores>
                  <ValorServicos>20000.00</ValorServicos>
                  <ValorPis>130.00</ValorPis>
                  <ValorCofins>600.00</ValorCofins>
                  <ValorIr>300.00</ValorIr>
                  <ValorCsll>200.00</ValorCsll>
                  <ValorInss>2200.00</ValorInss>
                </Valores>
                <ItemListaServico>07.02</ItemListaServico>
                <Discriminacao>Servicos de manutencao predial</Discriminacao>
              </Servico>
              <PrestadorServico>
                <Cnpj>12345678000195</Cnpj>
                <RazaoSocial>SERVICOS EXPERTISE LTDA</RazaoSocial>
              </PrestadorServico>
              <TomadorServico>
                <Cnpj>00394460000141</Cnpj>
                <RazaoSocial>MINISTERIO DA FAZENDA</RazaoSocial>
              </TomadorServico>
            </InfNfse>
          </Nfse>
        </CompNfse>
      `;

      const parsed = expertiseFiscalEngineService.parseNfeXml(nfseXml, '12.345.678/0001-95');
      expect(parsed.chaveAcesso).toContain('NFSE_202600045');
      expect(parsed.emitenteCrt).toBe(1);
      expect(parsed.direction).toBe('SAIDA');
      expect(parsed.totalAmount).toBe(20000);
      expect(parsed.vIrrf).toBe(300);
      expect(parsed.vRetPrev).toBe(2200);
      expect(parsed.items).toHaveLength(1);
    });

    it('deve detectar retenção a maior no Regime Normal (CRT=3) e ICMS-ST no Simples Nacional', async () => {
      (prisma.taxRuleVersion.findMany as jest.Mock).mockResolvedValue([
        { ruleCode: 'IN1234_BENS_TOTAL', ratePercent: 5.85 },
      ]);
      (prisma.fiscalDocumentImport.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'doc-crt3',
          docType: 'NFE_XML',
          accessKeyOrPeriod: '35260412345678000195550010000000991234567890',
          issueDate: new Date('2026-04-10T10:00:00Z'),
          totalAmount: 10000,
          taxesSummaryJson: {
            emitenteCrt: 3,
            vIrrf: 480,
            vRetCsll: 100,
            vRetPis: 65,
            vRetCofins: 300, // Total = 945 (9.45% cobrado sobre venda de bens cujo limite é 5.85% = 585)
          },
          parsedItemsJson: [
            {
              nItem: 1,
              cProd: 'BEM-01',
              xProd: 'Computador Desktop',
              ncm: '84715010',
              cfop: '5102',
              vProd: 10000,
              cstOrCsosn: '00',
            },
          ],
        },
        {
          id: 'doc-icms-st',
          docType: 'NFE_XML',
          accessKeyOrPeriod: '35260412345678000195550010000001001234567890',
          issueDate: new Date('2026-04-11T10:00:00Z'),
          totalAmount: 20000,
          taxesSummaryJson: {
            emitenteCrt: 1,
            vIcmsSt: 0,
          },
          parsedItemsJson: [
            {
              nItem: 1,
              cProd: 'ST-01',
              xProd: 'Autopeca com ST',
              ncm: '87083090',
              cfop: '5405',
              vProd: 20000,
              cstOrCsosn: '500',
            },
          ],
        },
      ]);
      (prisma.taxCreditOpportunity.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.taxCreditOpportunity.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 'opp-created', ...data }),
      );

      const opps = await expertiseFiscalEngineService.scanTaxCreditsAndDebits({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
      });

      const in1234Opp = opps.find((o) => o.originCategory === 'RETENCAO_IN1234');
      expect(in1234Opp).toBeDefined();
      expect(Number(in1234Opp.principalAmount)).toBeCloseTo(360, 1); // 945 - 585 = 360

      const icmsStOpp = opps.find((o) => o.originCategory === 'ICMS_ST');
      expect(icmsStOpp).toBeDefined();
      expect(Number(icmsStOpp.principalAmount)).toBeGreaterThan(0);
    });

    it('deve simular transição da Reforma Tributária com redutor de 100% (Cesta Básica) e comparativo de regimes', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Alimentos Brasil Ltda',
        cnpj: '12345678000195',
      });
      (prisma.taxRuleVersion.findMany as jest.Mock).mockResolvedValue([
        { ruleCode: 'REFORMA_TESTE_2026_CBS', ratePercent: 0.9 },
        { ruleCode: 'REFORMA_TESTE_2026_IBS', ratePercent: 0.1 },
        { ruleCode: 'REFORMA_IVA_DUAL_PADRAO', ratePercent: 26.5 },
      ]);

      const sim = await expertiseFiscalEngineService.simulateTaxReformTransition({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        grossRevenueAnnual: 1000000,
        taxRegime: 'LUCRO_PRESUMIDO',
        operationType: 'CESTA_BASICA_ISENTO',
      });

      expect(sim.cenarioAtual.regimeTributario).toBe('LUCRO_PRESUMIDO');
      expect(sim.cenarioAtual.cargaTributariaPercent).toBe(14.25);
      expect(sim.cenarioPlenoIvaDual.reducerPercent).toBe(100);
      expect(sim.cenarioPlenoIvaDual.aliquotaEfetivaFinalPercent).toBe(0);
      expect(sim.cenarioPlenoIvaDual.retencaoSplitPaymentGoverno).toBe(0);
    });
  });

  describe('Módulo 06: analyzeContractTaxEquilibrium (Reequilíbrio por Fato do Príncipe)', () => {
    it('deve vincular contrato ao ContractTaxLedger, calcular diferença tributária sobre o saldo e gerar minuta do Art. 124, II, "d" c/c Art. 134 da Lei 14.133/2021', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Engenharia e Suprimentos Brasil Ltda',
        cnpj: '12345678000195',
        municipio: 'Brasília',
        uf: 'DF',
      });

      (prisma.contract.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'contract-1',
          companyId: 'comp-1',
          proposalId: 'prop-1',
          numeroContrato: '045/2026',
          processoAdministrativo: '23000.012345/2026-11',
          orgao: 'Ministério da Saúde',
          cnpjOrgao: '00394544000185',
          objeto: 'Fornecimento contínuo de equipamentos hospitalares',
          valorInicial: 500000,
          valorAtual: 400000, // Saldo contratual vigente
          dataBaseProposta: new Date('2025-10-01T10:00:00Z'),
          dataAssinatura: new Date('2025-11-15T10:00:00Z'),
          status: 'ATIVO',
          proposal: {
            id: 'prop-1',
            createdAt: new Date('2025-10-01T10:00:00Z'),
            items: [{ tributosPercentual: 8.5 }],
          },
          taxLedgers: [],
        },
      ]);

      (prisma.taxRuleVersion.findMany as jest.Mock).mockResolvedValue([
        {
          id: '11111111-1111-1111-1111-111111111111',
          ruleCode: 'REFORMA_IVA_DUAL_SAUDE_60',
          taxName: 'IVA_DUAL',
          versionNumber: 2,
          ratePercent: 13.5, // Aumento de 8.5% para 13.5% (+5.00 p.p.) após a proposta
          legalBasis: 'Art. 134 da Lei 14.133/2021 c/c LC 214/2025',
          effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      (prisma.contractTaxLedger.create as jest.Mock).mockResolvedValue({
        id: 'ledger-created-1',
      });

      const res = await expertiseFiscalEngineService.analyzeContractTaxEquilibrium({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
      });

      expect(res.totalContratosAnalisados).toBe(1);
      expect(res.contratosComDireitoAReequilibrio).toBe(1);
      // 400.000 * (13.5% - 8.5%) = 20.000
      expect(res.impactoFinanceiroTotalAcumulado).toBeCloseTo(20000, 2);

      const item = res.contratosAnalisados[0];
      expect(item.baselineTaxLoadPercent).toBe(8.5);
      expect(item.effectiveTaxLoadPercent).toBe(13.5);
      expect(item.custoTributarioOriginalSaldo).toBeCloseTo(34000, 2);
      expect(item.novoCustoTributarioSaldo).toBeCloseTo(54000, 2);
      expect(item.impactoFinanceiroDesequilibrio).toBeCloseTo(20000, 2);
      expect(item.rebalanceJustified).toBe(true);
      expect(item.ledgerId).toBe('ledger-created-1');
      expect(item.planilhaDemonstrativaImpacto).toHaveLength(4);
      expect(item.minutaPedidoReequilibrioTexto).toContain('ART. 124, INCISO II, ALÍNEA "D", C/C ART. 134 DA LEI FEDERAL Nº 14.133/2021');
      expect(item.minutaPedidoReequilibrioTexto).toContain('045/2026');
      expect(prisma.contractTaxLedger.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Módulo 08: askGroundedTaxAssistant (Assistente Tributário com IA e Governança LGPD)', () => {
    it('deve responder citando dispositivo legal, TaxRuleVersion.versionNumber, memória de cálculo e aviso de governança CRC/OAB', async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        razaoSocial: 'Tech Licitações Ltda',
        cnpj: '12345678000195',
      });

      (prisma.taxRuleVersion.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-1234',
          ruleCode: 'IN1234_SIMPLES_ISENCAO',
          taxName: 'IRRF_CSLL_PIS_COFINS',
          versionNumber: 3,
          ratePercent: 0,
          legalBasis: 'Art. 4º, inciso XI da IN RFB nº 1.234/2012 c/c LC 123/2006',
          effectiveFrom: new Date('2024-01-01T00:00:00Z'),
        },
      ]);

      (prisma.fiscalDocumentImport.findMany as jest.Mock).mockResolvedValue([
        { id: 'doc-1', totalAmount: 50000 },
      ]);

      (prisma.taxCreditOpportunity.findMany as jest.Mock).mockResolvedValue([
        { id: 'cred-1', status: 'VALIDATED', principalAmount: 2925 },
      ]);

      const response = await expertiseFiscalEngineService.askGroundedTaxAssistant({
        tenantId: 'tenant-1',
        companyId: 'comp-1',
        userId: 'user-1',
        question: 'Como funciona a dispensa de retenção da IN 1234 para o Simples Nacional?',
        exportFormat: 'PARECER_TECNICO',
      });

      expect(response.regrasAplicadas[0].ruleCode).toBe('IN1234_SIMPLES_ISENCAO');
      expect(response.regrasAplicadas[0].versionNumber).toBe(3);
      expect(response.answer).toContain('versionNumber: 3');
      expect(response.answer).toContain('IN RFB nº 1.234/2012');
      expect(response.memoriaDeCalculo.documentosFiscaisConsideradosCount).toBe(1);
      expect(response.memoriaDeCalculo.creditosFiscaisConsideradosCount).toBe(1);
      expect(response.avisoGovernancaTecnica).toContain('CRC');
      expect(response.avisoGovernancaTecnica).toContain('OAB');
      expect(response.lgpdAuditLogRecorded).toBe(true);
    });
  });
});

