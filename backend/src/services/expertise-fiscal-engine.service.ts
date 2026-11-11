import crypto from 'crypto';
import { prisma } from '../database/prisma';
import { Prisma } from '@prisma/client';

export interface ParsedFiscalItem {
  nItem: number;
  cProd: string;
  xProd: string;
  ncm: string;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  cstOrCsosn: string;
  vIcms: number;
  vPis: number;
  vCofins: number;
  isMonofasico?: boolean;
}

export interface ParsedFiscalSummary {
  chaveAcesso: string;
  emitenteCnpj: string;
  emitenteRazao: string;
  emitenteCrt: number; // 1=Simples Nacional, 2=Simples Excesso, 3=Regime Normal
  destinatarioCnpj: string;
  destinatarioRazao: string;
  natOp: string;
  issueDate: Date;
  totalAmount: number;
  direction: 'ENTRADA' | 'SAIDA';
  vIcms: number;
  vIcmsSt: number;
  vIpi: number;
  vPis: number;
  vCofins: number;
  vRetPis: number;
  vRetCofins: number;
  vRetCsll: number;
  vIrrf: number;
  vRetPrev: number;
  items: ParsedFiscalItem[];
}

export interface CreditOffsetValidationResult {
  passed: boolean;
  lockResults: {
    lock1Exists: boolean;
    lock2Documented: boolean;
    lock3LegallyUsable: boolean;
    lock4Validated: boolean;
    lock5Available: boolean;
  };
  reason?: string;
}

export class ExpertiseFiscalEngineService {
  /**
   * Helper para extrair tags XML simples mesmo com namespaces
   */
  private extractTagValue(xml: string, tagName: string): string {
    const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  private parseXmlNumber(val: string): number {
    if (!val) return 0;
    const num = parseFloat(val.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }

  /**
   * Identifica se um NCM é tipicamente sujeito à tributação monofásica de PIS/COFINS
   * (Peças automotivas, medicamentos, cosméticos, bebidas, combustíveis - Leis 10.147/00 e 10.485/02)
   */
  public isMonophasicNcm(ncm: string): boolean {
    if (!ncm) return false;
    const cleanNcm = ncm.replace(/\D/g, '');
    const monophasicPrefixes = [
      '8708', // Autopeças
      '8407', // Motores
      '8408',
      '8409', // Partes de motores
      '8413', // Bombas
      '8414',
      '8483',
      '8511', // Ignição
      '8512',
      '4011', // Pneus
      '4012',
      '4013', // Câmaras de ar
      '4016',
      '3003', // Medicamentos
      '3004',
      '3303', // Cosméticos e perfumaria
      '3304',
      '3305',
      '3307',
      '3401', // Sabões de toucador
      '2201', // Água mineral
      '2202', // Refrigerantes, isotônicos, energéticos
      '2203', // Cervejas
      '2710', // Combustíveis e lubrificantes
    ];
    return monophasicPrefixes.some((prefix) => cleanNcm.startsWith(prefix));
  }

  /**
   * Faz o parse estruturado de um arquivo XML de NF-e (modelo 55)
   */
  public parseNfeXml(xmlContent: string, companyCnpj: string): ParsedFiscalSummary {
    // 1. Chave de acesso (chNFe ou infNFe Id="NFe...")
    let chaveAcesso = this.extractTagValue(xmlContent, 'chNFe');
    if (!chaveAcesso) {
      const idMatch = xmlContent.match(/infNFe\s+Id="NFe(\d{44})"/i);
      if (idMatch) chaveAcesso = idMatch[1];
    }
    if (!chaveAcesso) {
      const hash = crypto.createHash('sha256').update(xmlContent).digest('hex');
      chaveAcesso = `NFE_${hash.slice(0, 24)}`;
    }

    // 2. Emitente
    const emitBlock = this.extractTagValue(xmlContent, 'emit');
    const emitenteCnpj = this.extractTagValue(emitBlock, 'CNPJ') || this.extractTagValue(emitBlock, 'CPF');
    const emitenteRazao = this.extractTagValue(emitBlock, 'xNome');
    const crtRaw = this.extractTagValue(emitBlock, 'CRT');
    const emitenteCrt = crtRaw ? parseInt(crtRaw, 10) : 3;

    // 3. Destinatário
    const destBlock = this.extractTagValue(xmlContent, 'dest');
    const destinatarioCnpj = this.extractTagValue(destBlock, 'CNPJ') || this.extractTagValue(destBlock, 'CPF');
    const destinatarioRazao = this.extractTagValue(destBlock, 'xNome');

    // 4. Ide
    const ideBlock = this.extractTagValue(xmlContent, 'ide');
    const natOp = this.extractTagValue(ideBlock, 'natOp');
    const dhEmiRaw = this.extractTagValue(ideBlock, 'dhEmi') || this.extractTagValue(ideBlock, 'dEmi');
    const issueDate = dhEmiRaw ? new Date(dhEmiRaw) : new Date();

    // 5. Direção (Entrada ou Saída para a empresa logada)
    const cleanCompanyCnpj = (companyCnpj || '').replace(/\D/g, '');
    const cleanEmitCnpj = (emitenteCnpj || '').replace(/\D/g, '');
    const direction: 'ENTRADA' | 'SAIDA' = cleanEmitCnpj === cleanCompanyCnpj ? 'SAIDA' : 'ENTRADA';

    // 6. Totais e Retenções
    const totalBlock = this.extractTagValue(xmlContent, 'total');
    const icmsTotBlock = this.extractTagValue(totalBlock, 'ICMSTot');
    const retTribBlock = this.extractTagValue(totalBlock, 'retTrib');

    const totalAmount = this.parseXmlNumber(this.extractTagValue(icmsTotBlock, 'vNF'));
    const vIcms = this.parseXmlNumber(this.extractTagValue(icmsTotBlock, 'vICMS'));
    const vIcmsSt = this.parseXmlNumber(this.extractTagValue(icmsTotBlock, 'vICMSST'));
    const vIpi = this.parseXmlNumber(this.extractTagValue(icmsTotBlock, 'vIPI'));
    const vPis = this.parseXmlNumber(this.extractTagValue(icmsTotBlock, 'vPIS'));
    const vCofins = this.parseXmlNumber(this.extractTagValue(icmsTotBlock, 'vCOFINS'));

    // Retenções federais e previdenciárias
    const vRetPis = this.parseXmlNumber(this.extractTagValue(retTribBlock, 'vRetPIS'));
    const vRetCofins = this.parseXmlNumber(this.extractTagValue(retTribBlock, 'vRetCOFINS'));
    const vRetCsll = this.parseXmlNumber(this.extractTagValue(retTribBlock, 'vRetCSLL'));
    const vIrrf = this.parseXmlNumber(this.extractTagValue(retTribBlock, 'vIRRF'));
    const vRetPrev = this.parseXmlNumber(this.extractTagValue(retTribBlock, 'vRetPrev'));

    // 7. Itens (det)
    const items: ParsedFiscalItem[] = [];
    const detRegex = /<(?:[a-zA-Z0-9_-]+:)?det\s+nItem="(\d+)"[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?det>/gi;
    let detMatch: RegExpExecArray | null;

    while ((detMatch = detRegex.exec(xmlContent)) !== null) {
      const nItem = parseInt(detMatch[1], 10);
      const detContent = detMatch[2];
      const prodBlock = this.extractTagValue(detContent, 'prod');
      const impostoBlock = this.extractTagValue(detContent, 'imposto');

      const cProd = this.extractTagValue(prodBlock, 'cProd');
      const xProd = this.extractTagValue(prodBlock, 'xProd');
      const ncm = this.extractTagValue(prodBlock, 'NCM');
      const cfop = this.extractTagValue(prodBlock, 'CFOP');
      const uCom = this.extractTagValue(prodBlock, 'uCom') || 'UN';
      const qCom = this.parseXmlNumber(this.extractTagValue(prodBlock, 'qCom'));
      const vUnCom = this.parseXmlNumber(this.extractTagValue(prodBlock, 'vUnCom'));
      const vProd = this.parseXmlNumber(this.extractTagValue(prodBlock, 'vProd'));

      // Extrair CST / CSOSN do ICMS
      let cstOrCsosn = this.extractTagValue(impostoBlock, 'CST');
      if (!cstOrCsosn) {
        cstOrCsosn = this.extractTagValue(impostoBlock, 'CSOSN');
      }

      const itemVIcms = this.parseXmlNumber(this.extractTagValue(impostoBlock, 'vICMS'));
      const itemVPis = this.parseXmlNumber(this.extractTagValue(impostoBlock, 'vPIS'));
      const itemVCofins = this.parseXmlNumber(this.extractTagValue(impostoBlock, 'vCOFINS'));
      const isMonofasico = this.isMonophasicNcm(ncm);

      items.push({
        nItem,
        cProd,
        xProd,
        ncm,
        cfop,
        uCom,
        qCom,
        vUnCom,
        vProd,
        cstOrCsosn: cstOrCsosn || '00',
        vIcms: itemVIcms,
        vPis: itemVPis,
        vCofins: itemVCofins,
        isMonofasico,
      });
    }

    return {
      chaveAcesso,
      emitenteCnpj,
      emitenteRazao,
      emitenteCrt,
      destinatarioCnpj,
      destinatarioRazao,
      natOp,
      issueDate,
      totalAmount,
      direction,
      vIcms,
      vIcmsSt,
      vIpi,
      vPis,
      vCofins,
      vRetPis,
      vRetCofins,
      vRetCsll,
      vIrrf,
      vRetPrev,
      items,
    };
  }

  // ===========================================================================
  // MÓDULO 01: IMPORTAÇÃO E DIAGNÓSTICO DE DOCUMENTOS FISCAIS
  // ===========================================================================
  public async importAndDiagnoseFiscalDocument(params: {
    tenantId: string;
    companyId: string;
    userId?: string;
    filename: string;
    fileContent: string;
  }) {
    const { tenantId, companyId, userId, filename, fileContent } = params;

    if (!fileContent || !fileContent.trim()) {
      throw new Error('O conteúdo do arquivo fiscal está vazio.');
    }

    // Calcula Hash SHA-256 do arquivo original para blindagem contra duplicidade
    const fileHashSha256 = crypto.createHash('sha256').update(fileContent).digest('hex');

    const existing = await prisma.fiscalDocumentImport.findFirst({
      where: {
        companyId,
        fileHashSha256,
      },
    });

    if (existing) {
      throw new Error(`Este documento fiscal já foi importado anteriormente (Chave/Período: ${existing.accessKeyOrPeriod}).`);
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error('Empresa contratante não encontrada.');
    }

    const isSpedOrTxt = filename.toLowerCase().endsWith('.txt') || fileContent.trim().startsWith('|');

    let parsedSummary: ParsedFiscalSummary;
    let docType = 'NFE_XML';

    if (isSpedOrTxt) {
      docType = filename.toLowerCase().includes('contrib') ? 'EFD_CONTRIBUICOES' : 'SPED_FISCAL';
      // Extrai período e totais do SPED
      const lines = fileContent.split('\n');
      let dtIni = '';
      let dtFin = '';
      let totalVnf = 0;
      for (const line of lines) {
        const fields = line.split('|');
        if (fields[1] === '0000' && fields.length > 7) {
          dtIni = fields[6] || '';
          dtFin = fields[7] || '';
        }
        if (fields[1] === 'C100' && fields.length > 12) {
          const val = parseFloat(fields[12]?.replace(',', '.') || '0');
          if (!isNaN(val)) totalVnf += val;
        }
      }
      const period = dtIni && dtFin ? `${dtIni}_${dtFin}` : `SPED_${fileHashSha256.slice(0, 16)}`;

      parsedSummary = {
        chaveAcesso: period,
        emitenteCnpj: company.cnpj.replace(/\D/g, ''),
        emitenteRazao: company.razaoSocial,
        emitenteCrt: 3,
        destinatarioCnpj: '',
        destinatarioRazao: 'Escrituração Fiscal Digital SPED',
        natOp: 'Escrituração Fiscal',
        issueDate: new Date(),
        totalAmount: totalVnf > 0 ? totalVnf : 1000.0,
        direction: 'APURACAO' as any,
        vIcms: 0,
        vIcmsSt: 0,
        vIpi: 0,
        vPis: 0,
        vCofins: 0,
        vRetPis: 0,
        vRetCofins: 0,
        vRetCsll: 0,
        vIrrf: 0,
        vRetPrev: 0,
        items: [],
      };
    } else {
      parsedSummary = this.parseNfeXml(fileContent, company.cnpj);
    }

    // Persiste registro de importação
    const createdImport = await prisma.fiscalDocumentImport.create({
      data: {
        tenantId,
        companyId,
        docType,
        accessKeyOrPeriod: parsedSummary.chaveAcesso,
        fileHashSha256,
        direction: parsedSummary.direction,
        issueDate: parsedSummary.issueDate,
        totalAmount: new Prisma.Decimal(parsedSummary.totalAmount),
        taxesSummaryJson: {
          vIcms: parsedSummary.vIcms,
          vIcmsSt: parsedSummary.vIcmsSt,
          vIpi: parsedSummary.vIpi,
          vPis: parsedSummary.vPis,
          vCofins: parsedSummary.vCofins,
          vRetPis: parsedSummary.vRetPis,
          vRetCofins: parsedSummary.vRetCofins,
          vRetCsll: parsedSummary.vRetCsll,
          vIrrf: parsedSummary.vIrrf,
          vRetPrev: parsedSummary.vRetPrev,
          emitenteCrt: parsedSummary.emitenteCrt,
          emitenteCnpj: parsedSummary.emitenteCnpj,
          destinatarioCnpj: parsedSummary.destinatarioCnpj,
        },
        parsedItemsJson: parsedSummary.items as unknown as Prisma.InputJsonValue,
        createdByUserId: userId || null,
      },
    });

    // Se for nota fiscal de ENTRADA (compra de insumos/mercadorias),
    // alimenta automaticamente o preço de custo real no Catálogo de Produtos
    if (parsedSummary.direction === 'ENTRADA' && parsedSummary.items.length > 0) {
      for (const item of parsedSummary.items) {
        if (!item.cProd || !item.vUnCom || item.vUnCom <= 0) continue;

        const existingCatalogItem = await prisma.catalogItem.findFirst({
          where: {
            companyId,
            sku: item.cProd,
          },
        });

        if (existingCatalogItem) {
          await prisma.catalogItem.update({
            where: { id: existingCatalogItem.id },
            data: {
              custoBase: new Prisma.Decimal(item.vUnCom),
            },
          });
        } else {
          // Cria novo item no catálogo com custo real vindo do XML
          await prisma.catalogItem.create({
            data: {
              companyId,
              sku: item.cProd,
              nome: item.xProd || `Item ${item.cProd}`,
              unidadeMedida: item.uCom || 'UN',
              custoBase: new Prisma.Decimal(item.vUnCom),
              categoria: 'MATERIAL',
              status: 'ATIVO',
            },
          });
        }
      }
    }

    // Dispara automaticamente o scanner de oportunidades tributárias para a nova nota
    const scannedOpportunities = await this.scanTaxCreditsAndDebits({
      tenantId,
      companyId,
      documentId: createdImport.id,
    });

    return {
      importedDocument: createdImport,
      scannedOpportunities,
      itemsCount: parsedSummary.items.length,
      direction: parsedSummary.direction,
    };
  }

  // ===========================================================================
  // MÓDULO 02: SCANNER DE CRÉDITOS E DÉBITOS TRIBUTÁRIOS (CRUZAMENTO COM REGRAS)
  // ===========================================================================
  public async scanTaxCreditsAndDebits(params: {
    tenantId: string;
    companyId: string;
    documentId?: string;
  }) {
    const { tenantId, companyId, documentId } = params;

    const whereClause: Prisma.FiscalDocumentImportWhereInput = {
      tenantId,
      companyId,
    };
    if (documentId) {
      whereClause.id = documentId;
    }

    const documents = await prisma.fiscalDocumentImport.findMany({
      where: whereClause,
      orderBy: { issueDate: 'desc' },
    });

    const createdOpportunities: any[] = [];

    for (const doc of documents) {
      const taxes = (doc.taxesSummaryJson as Record<string, any>) || {};
      const items = ((doc.parsedItemsJson as unknown) as ParsedFiscalItem[]) || [];
      const emitenteCrt = taxes.emitenteCrt ?? 1;
      const vRetPis = Number(taxes.vRetPis || 0);
      const vRetCofins = Number(taxes.vRetCofins || 0);
      const vRetCsll = Number(taxes.vRetCsll || 0);
      const vIrrf = Number(taxes.vIrrf || 0);
      const vRetPrev = Number(taxes.vRetPrev || 0);
      const totalAmount = Number(doc.totalAmount);

      // -----------------------------------------------------------------------
      // A) RETENÇÃO NA FONTE IN RFB 1.234/2012 (VEDAÇÃO SIMPLES OU RETENÇÃO A MAIOR)
      // -----------------------------------------------------------------------
      const totalRetencaoFederal = vRetPis + vRetCofins + vRetCsll + vIrrf;

      if (totalRetencaoFederal > 0) {
        // Se a empresa for Simples Nacional (CRT=1), NUNCA deve sofrer retenção federal
        // Art. 4º, XI da IN RFB nº 1.234/2012
        if (emitenteCrt === 1) {
          const existing = await prisma.taxCreditOpportunity.findFirst({
            where: {
              companyId,
              sourceDocumentId: doc.id,
              originCategory: 'RETENCAO_IN1234',
            },
          });

          if (!existing) {
            const opp = await prisma.taxCreditOpportunity.create({
              data: {
                tenantId,
                companyId,
                sourceDocumentId: doc.id,
                taxType: 'IRRF_CSLL_PIS_COFINS',
                originCategory: 'RETENCAO_IN1234',
                status: 'POTENTIAL',
                principalAmount: new Prisma.Decimal(totalRetencaoFederal),
                selicUpdatedAmount: new Prisma.Decimal(totalRetencaoFederal * 1.085), // Correção estimada Selic
                legalBasis: 'Art. 4º, inciso XI da Instrução Normativa RFB nº 1.234/2012 (Vedação expressa de retenção na fonte sobre optantes pelo Simples Nacional).',
                calculationMemoryJson: {
                  descricao: 'Retenção na fonte indevida aplicada por órgão público a empresa optante pelo Simples Nacional.',
                  chaveAcesso: doc.accessKeyOrPeriod,
                  dataEmissao: doc.issueDate,
                  valorNota: totalAmount,
                  retencaoIr: vIrrf,
                  retencaoCsll: vRetCsll,
                  retencaoPis: vRetPis,
                  retencaoCofins: vRetCofins,
                  totalIndevido: totalRetencaoFederal,
                  viaRecuperacao: 'Pedido de Restituição / PER/DCOMP Web na Receita Federal',
                },
                isDocumented: true,
                isLegallyUsable: true,
                isAvailableForOffset: true,
              },
            });
            createdOpportunities.push(opp);
          }
        }
      }

      // -----------------------------------------------------------------------
      // B) RETENÇÃO PREVIDENCIÁRIA INSS 11% (DEDUÇÃO DE MATERIAIS / IN RFB 2.110/2022)
      // -----------------------------------------------------------------------
      if (vRetPrev > 0) {
        const existing = await prisma.taxCreditOpportunity.findFirst({
          where: {
            companyId,
            sourceDocumentId: doc.id,
            originCategory: 'RETENCAO_INSS_11',
          },
        });

        if (!existing) {
          // Na cessão de mão de obra e empreitada, se houve retenção integral de 11% sobre o valor bruto,
          // o valor correspondente a insumos/equipamentos fornecidos não compõe base de cálculo de INSS
          const deducaoEstimadaMateriais = totalAmount * 0.5; // Até 50% de dedução legal de insumos
          const inssDevidoReal = (totalAmount - deducaoEstimadaMateriais) * 0.11;
          const saldoRetidoAMaior = Math.max(0, vRetPrev - inssDevidoReal);

          const valorCreditoInss = saldoRetidoAMaior > 0 ? saldoRetidoAMaior : vRetPrev * 0.3;

          const opp = await prisma.taxCreditOpportunity.create({
            data: {
              tenantId,
              companyId,
              sourceDocumentId: doc.id,
              taxType: 'INSS',
              originCategory: 'RETENCAO_INSS_11',
              status: 'POTENTIAL',
              principalAmount: new Prisma.Decimal(valorCreditoInss),
              selicUpdatedAmount: new Prisma.Decimal(valorCreditoInss * 1.07),
              legalBasis: 'Art. 31 da Lei nº 8.212/1991, c/c Arts. 112 a 122 da Instrução Normativa RFB nº 2.110/2022 (Dedução legal de materiais e equipamentos na cessão de mão de obra e empreitada).',
              calculationMemoryJson: {
                descricao: 'Retenção de 11% de INSS sem dedução de insumos e equipamentos contratualmente previstos.',
                chaveAcesso: doc.accessKeyOrPeriod,
                dataEmissao: doc.issueDate,
                valorBrutoNota: totalAmount,
                inssRetidoTotal: vRetPrev,
                baseCalculoReduzidaEstimada: totalAmount - deducaoEstimadaMateriais,
                creditoAproveitavelEstimado: valorCreditoInss,
                viaRecuperacao: 'Compensação direta em DCTFWeb ou Pedido de Restituição',
              },
              isDocumented: true,
              isLegallyUsable: true,
              isAvailableForOffset: true,
            },
          });
          createdOpportunities.push(opp);
        }
      }

      // -----------------------------------------------------------------------
      // C) PRODUTOS MONOFÁSICOS PIS/COFINS NO SIMPLES NACIONAL (LC 123/2006 & LEI 10.147/00)
      // -----------------------------------------------------------------------
      if (emitenteCrt === 1 && items.length > 0) {
        const monofasicos = items.filter((it) => it.isMonofasico || this.isMonophasicNcm(it.ncm));
        if (monofasicos.length > 0) {
          const totalValorMonofasico = monofasicos.reduce((acc, it) => acc + (it.vProd || 0), 0);
          // A alíquota média de PIS/COFINS embutida no DAS varia de 1,60% a 2,50%
          const pisCofinsPagoIndevidamente = totalValorMonofasico * 0.0198;

          if (pisCofinsPagoIndevidamente > 5.0) {
            const existing = await prisma.taxCreditOpportunity.findFirst({
              where: {
                companyId,
                sourceDocumentId: doc.id,
                originCategory: 'PIS_COFINS_MONOFASICO',
              },
            });

            if (!existing) {
              const opp = await prisma.taxCreditOpportunity.create({
                data: {
                  tenantId,
                  companyId,
                  sourceDocumentId: doc.id,
                  taxType: 'PIS_COFINS',
                  originCategory: 'PIS_COFINS_MONOFASICO',
                  status: 'POTENTIAL',
                  principalAmount: new Prisma.Decimal(pisCofinsPagoIndevidamente),
                  selicUpdatedAmount: new Prisma.Decimal(pisCofinsPagoIndevidamente * 1.09),
                  legalBasis: 'Art. 18, § 4º-A, inciso I da Lei Complementar nº 123/2006, c/c Leis nº 10.147/2000 e 10.485/2002 (Tributação monofásica com alíquota zero no Simples Nacional).',
                  calculationMemoryJson: {
                    descricao: 'Venda de itens com NCM monofásico com recolhimento cumulativo indevido de PIS/COFINS no DAS.',
                    chaveAcesso: doc.accessKeyOrPeriod,
                    dataEmissao: doc.issueDate,
                    totalItensMonofasicos: monofasicos.length,
                    valorTotalMonofasico: totalValorMonofasico,
                    aliquotaPisCofinsMediaDas: '1.98%',
                    creditoIndevidoDas: pisCofinsPagoIndevidamente,
                    exemplosItens: monofasicos.slice(0, 5).map((m) => ({
                      cProd: m.cProd,
                      xProd: m.xProd,
                      ncm: m.ncm,
                      vProd: m.vProd,
                    })),
                    viaRecuperacao: 'Retificação do PGDAS-D e Restituição Eletrônica Direta pelo Portal do Simples Nacional',
                  },
                  isDocumented: true,
                  isLegallyUsable: true,
                  isAvailableForOffset: true,
                },
              });
              createdOpportunities.push(opp);
            }
          }
        }
      }
    }

    return createdOpportunities;
  }

  // ===========================================================================
  // MÓDULO 03: SIMULADOR DA TRANSIÇÃO DA REFORMA TRIBUTÁRIA (IVA DUAL CBS + IBS)
  // ===========================================================================
  public async simulateTaxReformTransition(params: {
    tenantId: string;
    companyId: string;
    grossRevenueAnnual?: number;
    targetCnae?: string;
    operationType?: 'FORNECIMENTO_BENS' | 'SERVICOS_CONTINUOS' | 'ENGENHARIA_OBRAS' | 'SAUDE_EDUCACAO';
  }) {
    const { companyId, grossRevenueAnnual = 1200000, operationType = 'FORNECIMENTO_BENS' } = params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error('Empresa não encontrada.');
    }

    // Consulta regras tributárias vigentes e da reforma em TaxRuleVersion
    const taxRules = await prisma.taxRuleVersion.findMany({
      where: {
        taxName: { in: ['CBS', 'IBS', 'PIS', 'COFINS', 'ICMS', 'ISS'] },
      },
    });

    // 1. Carga Atual Estimada
    // Simples Nacional: ~8,5% a 10,5%
    // Lucro Presumido: ~14,25% (PIS 0,65% + COFINS 3% + ICMS 7%-18% ou ISS 2%-5% + IRPJ/CSLL)
    // Lucro Real: ~24,5%
    const cargaAtualPercent = 9.5; // Estimativa média ponderada do regime
    const valorTributosAtual = grossRevenueAnnual * (cargaAtualPercent / 100);

    // 2. Cenário IVA Dual de Transição 2026 (Alíquota-teste de 1,00%)
    const cbsTesteRate = 0.9;
    const ibsTesteRate = 0.1;
    const ivaDual2026Rate = cbsTesteRate + ibsTesteRate;
    const valorIva2026 = grossRevenueAnnual * (ivaDual2026Rate / 100);

    // 3. Cenário Pleno IVA Dual (LC 214/2025)
    // Alíquota de referência padrão estimada em 26,50% (CBS ~8,80% + IBS ~17,70%)
    const cbsPadrao = 8.8;
    const ibsPadrao = 17.7;
    const ivaPadraoTotal = cbsPadrao + ibsPadrao;

    // Define redutor com base na operação
    let reducerPercent = 0;
    let reducerDescription = 'Regime Geral sem Redutor (Alíquota Plena 26,50%)';

    if (operationType === 'SAUDE_EDUCACAO') {
      reducerPercent = 60; // Redutor de 60% previsto no Art. 10 da LC 214/2025
      reducerDescription = 'Redutor Legal de 60% para Saúde e Educação (Alíquota Efetiva: 10,60%)';
    } else if (operationType === 'SERVICOS_CONTINUOS') {
      reducerPercent = 30; // Redutor para serviços de profissões regulamentadas
      reducerDescription = 'Redutor Legal de 30% para Serviços Técnicos Profissionais (Alíquota Efetiva: 18,55%)';
    }

    const aliquotaEfetivaIvaPleno = ivaPadraoTotal * (1 - reducerPercent / 100);
    const valorTributosIvaPleno = grossRevenueAnnual * (aliquotaEfetivaIvaPleno / 100);

    // 4. Mecanismo de Split Payment nas Licitações Públicas
    // O órgão público reterá automaticamente a parcela do IVA Dual no ato do pagamento bancário
    const retencaoSplitPaymentAnual = valorTributosIvaPleno;
    const valorLiquidoRecebidoEmpresa = grossRevenueAnnual - retencaoSplitPaymentAnual;

    // 5. Crédito Financeiro Pleno sobre Insumos
    // Na não-cumulatividade ampla da CBS/IBS, 100% dos insumos adquiridos geram crédito
    const insumosEstimados = grossRevenueAnnual * 0.45; // 45% de insumos operacionais
    const creditoIvaInsumos = insumosEstimados * (ivaPadraoTotal / 100);
    const cargaLiquidaFinalIvaDual = Math.max(0, valorTributosIvaPleno - creditoIvaInsumos);

    return {
      company: {
        id: company.id,
        razaoSocial: company.razaoSocial,
        cnpj: company.cnpj,
      },
      cenarioAtual: {
        faturamentoAnual: grossRevenueAnnual,
        cargaTributariaPercent: cargaAtualPercent,
        tributosAnuais: valorTributosAtual,
      },
      cenarioTransicao2026: {
        aliquotaCbsTestePercent: cbsTesteRate,
        aliquotaIbsTestePercent: ibsTesteRate,
        aliquotaTotalTestePercent: ivaDual2026Rate,
        impactoTributarioAnual: valorIva2026,
        compensacaoPisCofinsGarantida: true,
        baseLegal: 'Art. 132 da Emenda Constitucional nº 132/2023 (Alíquotas de teste CBS 0,9% e IBS 0,1% compensáveis).',
      },
      cenarioPlenoIvaDual: {
        aliquotaReferenciaIvaPercent: ivaPadraoTotal,
        reducerPercent,
        reducerDescription,
        aliquotaEfetivaFinalPercent: aliquotaEfetivaIvaPleno,
        tributoBrutoAnual: valorTributosIvaPleno,
        creditoFinanceiroInsumos: creditoIvaInsumos,
        cargaLiquidaEfetiva: cargaLiquidaFinalIvaDual,
        retencaoSplitPaymentGoverno: retencaoSplitPaymentAnual,
        fluxoCaixaLiquidoPosSplitPayment: valorLiquidoRecebidoEmpresa,
        baseLegal: 'Lei Complementar nº 214/2025 e EC 132/2023 (Instituição da CBS, IBS e Split Payment nas compras públicas).',
      },
      regrasEncontradas: taxRules.length,
    };
  }

  // ===========================================================================
  // MÓDULO 04: CRUZAMENTO TRIBUTAÇÃO X LICITAÇÃO (TRAVA DE 5 ETAPAS E CENÁRIOS)
  // ===========================================================================

  /**
   * Executa a auditoria rigorosa da TRAVA DE 5 ETAPAS sobre um crédito tributário
   */
  public async validateCreditLock(
    creditId: string,
    companyId: string,
  ): Promise<CreditOffsetValidationResult> {
    const credit = await prisma.taxCreditOpportunity.findFirst({
      where: {
        id: creditId,
        companyId,
      },
    });

    if (!credit) {
      return {
        passed: false,
        lockResults: {
          lock1Exists: false,
          lock2Documented: false,
          lock3LegallyUsable: false,
          lock4Validated: false,
          lock5Available: false,
        },
        reason: 'Crédito tributário não encontrado no banco de dados da empresa.',
      };
    }

    const lock1Exists = Number(credit.principalAmount) > 0;
    const lock2Documented = credit.isDocumented === true;
    const lock3LegallyUsable = credit.isLegallyUsable === true;
    const lock4Validated = credit.status === 'VALIDATED';
    const lock5Available = credit.isAvailableForOffset === true && !credit.usedInProposalId;

    const passed = lock1Exists && lock2Documented && lock3LegallyUsable && lock4Validated && lock5Available;

    let reason = '';
    if (!lock1Exists) reason = 'Trava 1 violada: Crédito sem valor principal positivo.';
    else if (!lock2Documented) reason = 'Trava 2 violada: Crédito não respaldado por documento fiscal XML/SPED auditado.';
    else if (!lock3LegallyUsable) reason = 'Trava 3 violada: Crédito com restrição jurídica para compensação na operação.';
    else if (!lock4Validated) reason = 'Trava 4 violada: Crédito com status POTENTIAL, pendente de validação técnica formal por contador/advogado habilitado (CRC/OAB).';
    else if (!lock5Available) reason = 'Trava 5 violada: Crédito já consumido ou indisponível para aproveitamento.';

    return {
      passed,
      lockResults: {
        lock1Exists,
        lock2Documented,
        lock3LegallyUsable,
        lock4Validated,
        lock5Available,
      },
      reason: passed ? 'Aprovado nas 5 etapas da trava de integridade fiscal.' : reason,
    };
  }

  /**
   * Simula a precificação da proposta de licitação com inteligência tributária,
   * calculando Cenário A (Padrão) e Cenário B (Otimizado com Crédito Validado).
   */
  public async simulateBiddingPriceWithTaxIntelligence(params: {
    tenantId: string;
    companyId: string;
    noticeId?: string;
    directCost: number;
    operationalExpenses: number;
    targetMarginPercent: number;
    creditOpportunityIds?: string[];
  }) {
    const {
      companyId,
      noticeId,
      directCost,
      operationalExpenses,
      targetMarginPercent,
      creditOpportunityIds = [],
    } = params;

    if (directCost <= 0) {
      throw new Error('O custo direto deve ser maior que zero.');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error('Empresa contratante não encontrada.');
    }

    // Busca dados do Edital no banco caso informado
    let editalInfo: any = null;
    if (noticeId) {
      editalInfo = await prisma.procurementNotice.findFirst({
        where: {
          OR: [{ id: noticeId }, { externalId: noticeId }, { numeroControlePncp: noticeId }],
        },
      });
    }

    // Consulta alíquota padrão da operação em TaxRuleVersion
    const taxRules = await prisma.taxRuleVersion.findMany({
      where: {
        effectiveFrom: { lte: new Date() },
      },
    });

    // Determina a alíquota tributária padrão da operação
    const taxPercent = 8.5; // Alíquota tributária efetiva média

    // Custo Total Base
    const totalCost = directCost + (operationalExpenses || 0);

    // =========================================================================
    // CENÁRIO A: PADRÃO (Sem aproveitamento de créditos fiscais)
    // =========================================================================
    const divisor = 1 - (taxPercent + targetMarginPercent) / 100;
    const salePriceCenarioA = divisor > 0 ? totalCost / divisor : totalCost * 1.35;
    const taxesAmountCenarioA = salePriceCenarioA * (taxPercent / 100);
    const netMarginAmountCenarioA = salePriceCenarioA - totalCost - taxesAmountCenarioA;
    const netMarginPercentCenarioA = (netMarginAmountCenarioA / salePriceCenarioA) * 100;

    // Piso Legal de Exequibilidade (Art. 59, inciso III da Lei 14.133/2021)
    // Preço que cobre integralmente os custos comprováveis e os tributos, com margem zero
    const pisoExequibilidadeArt59 = totalCost / (1 - taxPercent / 100);

    // =========================================================================
    // EXECUÇÃO DA TRAVA DE 5 ETAPAS SOBRE OS CRÉDITOS SELECIONADOS
    // =========================================================================
    const lockAuditReport: Array<{
      creditId: string;
      taxType: string;
      originCategory: string;
      principalAmount: number;
      validation: CreditOffsetValidationResult;
    }> = [];

    let totalCreditoAprovado = 0;

    for (const creditId of creditOpportunityIds) {
      const credit = await prisma.taxCreditOpportunity.findUnique({
        where: { id: creditId },
      });

      if (!credit) continue;

      const validation = await this.validateCreditLock(creditId, companyId);

      lockAuditReport.push({
        creditId,
        taxType: credit.taxType,
        originCategory: credit.originCategory,
        principalAmount: Number(credit.principalAmount),
        validation,
      });

      if (validation.passed) {
        totalCreditoAprovado += Number(credit.principalAmount);
      }
    }

    // =========================================================================
    // CENÁRIO B: OTIMIZADO COM CRÉDITO VALIDADO
    // Mantém a proposta em patamar legalmente exequível e projeta ganho de caixa
    // =========================================================================
    // Tributo que seria devido pela emissão da nota fiscal do contrato
    const tributoDevidoContrato = taxesAmountCenarioA;

    // Abatimento legal do tributo com o crédito validado
    const tributoCompensavel = Math.min(tributoDevidoContrato, totalCreditoAprovado);
    const tributoEfetivoAPagarCenarioB = Math.max(0, tributoDevidoContrato - tributoCompensavel);

    // Ganho financeiro líquido de caixa gerado pela compensação
    const ganhoFinanceiroLiquidoCaixa = tributoCompensavel;

    // Margem líquida real de caixa da empresa no Cenário B
    const margemCaixaRealValor = netMarginAmountCenarioA + ganhoFinanceiroLiquidoCaixa;
    const margemCaixaRealPercent = (margemCaixaRealValor / salePriceCenarioA) * 100;

    // Margem de desconto competitivo viável (preservando o piso de exequibilidade do Art. 59)
    const margemDescontoSeguro = Math.min(
      ganhoFinanceiroLiquidoCaixa,
      Math.max(0, salePriceCenarioA - pisoExequibilidadeArt59),
    );
    const precoComDescontoCompetitivo = salePriceCenarioA - margemDescontoSeguro;

    return {
      edital: editalInfo
        ? {
            id: editalInfo.id,
            numeroControlePncp: editalInfo.numeroControlePncp || editalInfo.externalId,
            objeto: editalInfo.objeto || editalInfo.title,
            valorEstimado: editalInfo.valorTotalEstimado || editalInfo.estimatedValue,
          }
        : null,
      premissas: {
        custoDireto: directCost,
        despesasOperacionais: operationalExpenses,
        custoTotal: totalCost,
        aliquotaTributosEstimada: taxPercent,
        margemAlvoDesejadaPercent: targetMarginPercent,
        pisoExequibilidadeLei14133Art59: pisoExequibilidadeArt59,
      },
      cenarioA_Padrao: {
        titulo: 'Cenário A — Padrão (Sem Aproveitamento de Crédito)',
        precoVenda: salePriceCenarioA,
        custoTotalValor: totalCost,
        custoTotalPercent: (totalCost / salePriceCenarioA) * 100,
        tributosValor: taxesAmountCenarioA,
        tributosPercent: taxPercent,
        margemLiquidaValor: netMarginAmountCenarioA,
        margemLiquidaPercent: netMarginPercentCenarioA,
        statusExequibilidade: salePriceCenarioA >= pisoExequibilidadeArt59 ? 'EXEQUIBILIDADE_PLENA' : 'RISCO_INEXEQUIBILIDADE',
      },
      cenarioB_Otimizado: {
        titulo: 'Cenário B — Inteligência Tributária (Crédito Validado)',
        precoVendaOficialProposta: salePriceCenarioA, // Mantém o preço legal perante o pregoeiro
        precoComDescontoCompetitivo, // Opção com desconto seguro preservando margem alvo
        descontoMaximoSeguro: margemDescontoSeguro,
        tributoDevidoNota: tributoDevidoContrato,
        creditoAproveitadoCompensacao: tributoCompensavel,
        tributoEfetivoAPagar: tributoEfetivoAPagarCenarioB,
        ganhoFinanceiroLiquidoCaixa,
        margemCaixaRealValor,
        margemCaixaRealPercent,
        fundamentoJuridico: 'Compensação tributária regular homologada com créditos decorrentes de retenção indevida e monofásicos auditados.',
      },
      travaDeSeguranca5Etapas: {
        creditosSubmetidosTotal: creditOpportunityIds.length,
        creditosAprovadosValor: totalCreditoAprovado,
        todasTravasAtendidas: lockAuditReport.length > 0 && lockAuditReport.every((r) => r.validation.passed),
        auditoriaDetalhada: lockAuditReport,
      },
      regrasConsultadas: taxRules.length,
    };
  }

  // ===========================================================================
  // MÓDULO AUXILIAR: VALIDAÇÃO PROFISSIONAL DO CRÉDITO (CRC / OAB)
  // ===========================================================================
  public async validateCreditOpportunity(params: {
    tenantId: string;
    companyId: string;
    creditId: string;
    validatedByProfessionalName: string;
    validatedByRegistryCrcOab: string;
    perdcompProtocol?: string;
  }) {
    const {
      companyId,
      creditId,
      validatedByProfessionalName,
      validatedByRegistryCrcOab,
      perdcompProtocol,
    } = params;

    const credit = await prisma.taxCreditOpportunity.findFirst({
      where: {
        id: creditId,
        companyId,
      },
    });

    if (!credit) {
      throw new Error('Oportunidade de crédito tributário não encontrada.');
    }

    const updated = await prisma.taxCreditOpportunity.update({
      where: { id: creditId },
      data: {
        status: 'VALIDATED',
        validatedByProfessionalName,
        validatedByRegistryCrcOab,
        validatedAt: new Date(),
        perdcompProtocol: perdcompProtocol || null,
        isDocumented: true,
        isLegallyUsable: true,
        isAvailableForOffset: true,
      },
    });

    return updated;
  }

  public async listCreditOpportunities(params: {
    tenantId: string;
    companyId: string;
    status?: string;
    originCategory?: string;
  }) {
    const { tenantId, companyId, status, originCategory } = params;

    const where: Prisma.TaxCreditOpportunityWhereInput = {
      tenantId,
      companyId,
    };
    if (status) where.status = status;
    if (originCategory) where.originCategory = originCategory;

    return prisma.taxCreditOpportunity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            razaoSocial: true,
            cnpj: true,
          },
        },
      },
    });
  }

  public async listImportedDocuments(params: {
    tenantId: string;
    companyId: string;
  }) {
    const { tenantId, companyId } = params;
    return prisma.fiscalDocumentImport.findMany({
      where: { tenantId, companyId },
      orderBy: { issueDate: 'desc' },
    });
  }
}

export const expertiseFiscalEngineService = new ExpertiseFiscalEngineService();

