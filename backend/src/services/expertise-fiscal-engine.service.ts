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

export interface FiscalAuditDivergence {
  id: string;
  tipo:
    | 'NCM_INCOMPATIVEL_CATMAT'
    | 'NCM_GENERICO_INVALIDO'
    | 'CFOP_INADEQUADO_ORGAO_PUBLICO'
    | 'RETENCAO_INDEVIDA_SIMPLES'
    | 'RETENCAO_AUSENTE_REGIME_NORMAL'
    | 'MONOFASICO_NAO_SEGREGADO';
  severidade: 'ALTA' | 'MEDIA' | 'BAIXA';
  chaveAcesso: string;
  itemNumero?: number;
  itemDescricao?: string;
  ncm?: string;
  cfop?: string;
  descricaoDivergencia: string;
  impactoFinanceiroEstimado: number;
  riscoNoEmpenho: string;
  orientacaoCorrecao: string;
  baseLegal: string;
}

export interface SmartFiscalAuditResult {
  empresa: {
    id: string;
    razaoSocial: string;
    cnpj: string;
    crt: number;
    regimeTributario: string;
  };
  editalAuditado?: {
    id: string;
    numeroControlePncp: string;
    objeto: string;
    itensCount: number;
  } | null;
  documentosAnalisadosCount: number;
  totalDivergencias: number;
  statusAuditoria: 'CRITICA' | 'ATENCAO' | 'REGULAR';
  divergencias: FiscalAuditDivergence[];
  resumoFinanceiro: {
    valorTotalDocumentosAuditados: number;
    impactoFinanceiroRiscoGlosa: number;
    creditosRecuperaveisIdentificados: number;
  };
  declaracaoNaoRetencaoAnexoIV: {
    titulo: string;
    baseLegal: string;
    modeloTextoPreenchido: string;
    instrucoesUso: string;
  };
}

export interface PerdcompMirrorItem {
  creditId: string;
  numeroOrdem: number;
  tipoDocumentoDcomp: 'DECLARACAO_COMPENSACAO' | 'PEDIDO_RESTITUICAO';
  tipoCreditoEcac: string;
  codigoReceitaDarfOuDas: string;
  periodoApuracaoCompetencia: string;
  dataArrecadacaoOuRetencao: string;
  chaveAcessoDocumento: string;
  valorPrincipalOriginal: number;
  taxaSelicAcumuladaPercent: number;
  valorJurosSelic: number;
  valorAtualizadoTotal: number;
  saldoDisponivelCompensacao: number;
  origemCategoria: string;
  baseLegal: string;
  responsavelTecnicoValidacao: {
    nome: string;
    registroCrcOuOab: string;
    dataValidacao: string;
  };
  protocoloPerdcomp: string;
  statusTransmitido: boolean;
  espelhoFormularioEcac: {
    campo01_IdentificacaoContribuinte: string;
    campo02_GrupoCredito: string;
    campo03_TipoCredito: string;
    campo04_CompetenciaOuPeriodo: string;
    campo05_CodigoReceitaPrincipal: string;
    campo06_DataPagamentoOuRetencao: string;
    campo07_ValorOriginal: string;
    campo08_IndiceSelic: string;
    campo09_ValorTotalComSelic: string;
    campo10_InformacoesComplementares: string;
  };
}

export interface CrossOffsetDebitoItem {
  tipoDebito: 'ESOCIAL_PREVIDENCIARIO' | 'REINF_RETENCOES' | 'DARF_FAZENDARIO' | 'DAS_SIMPLES';
  competencia: string;
  codigoReceita: string;
  valorOriginalDebito: number;
}

export interface CrossOffsetBatchResult {
  empresa: {
    id: string;
    razaoSocial: string;
    cnpj: string;
  };
  totalCreditosValidadosDisponiveis: number;
  totalCreditosValidadosValor: number;
  totalCreditosComSelicValor: number;
  totalDebitosSubmetidosValor: number;
  capacidadeAbatimentoCruzadoDctfWeb: {
    creditosFazendariosParaDebitosPrevidenciarios: number;
    creditosPrevidenciariosParaDebitosFazendarios: number;
    saldoFinalDevedorAposCompensacao: number;
    saldoRestanteCreditosParaFuturasDcomp: number;
  };
  espelhosPerdcompWeb: PerdcompMirrorItem[];
  fundamentoJuridicoCompensacaoCruzada: string;
  passoAPassoTransmissaoEcac: string[];
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
    const isNfse =
      /<(?:[a-zA-Z0-9_-]+:)?(?:InfNfse|CompNfse|ConsultarNfseResposta|GerarNfseResposta|Nfse)/i.test(xmlContent) &&
      !/<(?:[a-zA-Z0-9_-]+:)?infNFe/i.test(xmlContent);

    if (isNfse) {
      const numeroNfse =
        this.extractTagValue(xmlContent, 'Numero') ||
        this.extractTagValue(xmlContent, 'CodigoVerificacao');
      const hash = crypto.createHash('sha256').update(xmlContent).digest('hex');
      const chaveAcesso = numeroNfse ? `NFSE_${numeroNfse}_${hash.slice(0, 12)}` : `NFSE_${hash.slice(0, 24)}`;

      const prestadorBlock =
        this.extractTagValue(xmlContent, 'PrestadorServico') ||
        this.extractTagValue(xmlContent, 'Prestador');
      const emitenteCnpj =
        this.extractTagValue(prestadorBlock, 'Cnpj') ||
        this.extractTagValue(prestadorBlock, 'CNPJ') ||
        this.extractTagValue(prestadorBlock, 'Cpf');
      const emitenteRazao =
        this.extractTagValue(prestadorBlock, 'RazaoSocial') ||
        this.extractTagValue(prestadorBlock, 'NomeFantasia') ||
        'Prestador NFS-e';
      const optanteSimples = this.extractTagValue(xmlContent, 'OptanteSimplesNacional');
      const emitenteCrt = optanteSimples === '1' ? 1 : 3;

      const tomadorBlock =
        this.extractTagValue(xmlContent, 'TomadorServico') ||
        this.extractTagValue(xmlContent, 'Tomador');
      const destinatarioCnpj =
        this.extractTagValue(tomadorBlock, 'Cnpj') ||
        this.extractTagValue(tomadorBlock, 'CNPJ') ||
        this.extractTagValue(tomadorBlock, 'Cpf');
      const destinatarioRazao =
        this.extractTagValue(tomadorBlock, 'RazaoSocial') || 'Tomador NFS-e';

      const dhEmiRaw =
        this.extractTagValue(xmlContent, 'DataEmissao') ||
        this.extractTagValue(xmlContent, 'Competencia');
      const issueDate = dhEmiRaw ? new Date(dhEmiRaw) : new Date();

      const cleanCompanyCnpj = (companyCnpj || '').replace(/\D/g, '');
      const cleanEmitCnpj = (emitenteCnpj || '').replace(/\D/g, '');
      const direction: 'ENTRADA' | 'SAIDA' = cleanEmitCnpj === cleanCompanyCnpj ? 'SAIDA' : 'ENTRADA';

      const servicoBlock = this.extractTagValue(xmlContent, 'Servico') || xmlContent;
      const valoresBlock = this.extractTagValue(servicoBlock, 'Valores') || servicoBlock;

      const totalAmount = this.parseXmlNumber(
        this.extractTagValue(valoresBlock, 'ValorServicos') ||
          this.extractTagValue(valoresBlock, 'ValorLiquidoNfse'),
      );
      const vPis = this.parseXmlNumber(this.extractTagValue(valoresBlock, 'ValorPis'));
      const vCofins = this.parseXmlNumber(this.extractTagValue(valoresBlock, 'ValorCofins'));
      const vRetCsll = this.parseXmlNumber(this.extractTagValue(valoresBlock, 'ValorCsll'));
      const vIrrf = this.parseXmlNumber(this.extractTagValue(valoresBlock, 'ValorIr'));
      const vRetPrev = this.parseXmlNumber(this.extractTagValue(valoresBlock, 'ValorInss'));
      const discriminacao =
        this.extractTagValue(servicoBlock, 'Discriminacao') || 'Prestação de Serviços (NFS-e)';
      const itemListaServico =
        this.extractTagValue(servicoBlock, 'ItemListaServico') || 'SERV-01';

      return {
        chaveAcesso,
        emitenteCnpj,
        emitenteRazao,
        emitenteCrt,
        destinatarioCnpj,
        destinatarioRazao,
        natOp: 'Prestação de Serviços (NFS-e)',
        issueDate,
        totalAmount,
        direction,
        vIcms: 0,
        vIcmsSt: 0,
        vIpi: 0,
        vPis,
        vCofins,
        vRetPis: vPis,
        vRetCofins: vCofins,
        vRetCsll,
        vIrrf,
        vRetPrev,
        items: [
          {
            nItem: 1,
            cProd: itemListaServico,
            xProd: discriminacao,
            ncm: '00000000',
            cfop: '5933',
            uCom: 'SV',
            qCom: 1,
            vUnCom: totalAmount,
            vProd: totalAmount,
            cstOrCsosn: emitenteCrt === 1 ? '101' : '00',
            vIcms: 0,
            vPis,
            vCofins,
            isMonofasico: false,
          },
        ],
      };
    }

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
      // Extrai período, itens (0200 + C170) e totais do SPED Fiscal / EFD-Contribuições
      const lines = fileContent.split('\n');
      let dtIni = '';
      let dtFin = '';
      let totalVnf = 0;
      const spedCatalog = new Map<string, { descr: string; ncm: string; unid: string }>();
      const spedItems: ParsedFiscalItem[] = [];

      for (const line of lines) {
        const fields = line.split('|');
        const reg = fields[1];
        if (reg === '0000' && fields.length > 7) {
          dtIni = fields[6] || '';
          dtFin = fields[7] || '';
        } else if (reg === '0200' && fields.length > 8) {
          const codItem = (fields[2] || '').trim();
          const descrItem = (fields[3] || '').trim();
          const unidInv = (fields[6] || 'UN').trim();
          const codNcm = (fields[8] || '').trim();
          if (codItem) {
            spedCatalog.set(codItem, { descr: descrItem, ncm: codNcm, unid: unidInv });
          }
        } else if (reg === 'C100' && fields.length > 12) {
          const val = parseFloat(fields[12]?.replace(',', '.') || '0');
          if (!isNaN(val)) totalVnf += val;
        } else if (reg === 'C170' && fields.length > 11) {
          const numItem = parseInt(fields[2] || String(spedItems.length + 1), 10) || spedItems.length + 1;
          const codItem = (fields[3] || '').trim();
          const descrCompl = (fields[4] || '').trim();
          const qtd = parseFloat((fields[5] || '1').replace(',', '.')) || 1;
          const unid = (fields[6] || 'UN').trim();
          const vlItem = parseFloat((fields[7] || '0').replace(',', '.')) || 0;
          const cstIcms = (fields[10] || '00').trim();
          const cfop = (fields[11] || '5102').trim();
          const catInfo = spedCatalog.get(codItem);
          const ncm = catInfo?.ncm || '00000000';
          spedItems.push({
            nItem: numItem,
            cProd: codItem || `SPED-${numItem}`,
            xProd: descrCompl || catInfo?.descr || `Item SPED ${numItem}`,
            ncm,
            cfop,
            uCom: unid || catInfo?.unid || 'UN',
            qCom: qtd,
            vUnCom: qtd > 0 ? vlItem / qtd : vlItem,
            vProd: vlItem,
            cstOrCsosn: cstIcms,
            vIcms: 0,
            vPis: 0,
            vCofins: 0,
            isMonofasico: this.isMonophasicNcm(ncm),
          });
        }
      }
      const period = dtIni && dtFin ? `${dtIni}_${dtFin}` : `SPED_${fileHashSha256.slice(0, 16)}`;
      const sumSpedItems = spedItems.reduce((acc, it) => acc + it.vProd, 0);

      parsedSummary = {
        chaveAcesso: period,
        emitenteCnpj: company.cnpj.replace(/\D/g, ''),
        emitenteRazao: company.razaoSocial,
        emitenteCrt: 3,
        destinatarioCnpj: '',
        destinatarioRazao: 'Escrituração Fiscal Digital SPED - Administração Pública',
        natOp: 'Escrituração Fiscal',
        issueDate: new Date(),
        totalAmount: totalVnf > 0 ? totalVnf : sumSpedItems > 0 ? sumSpedItems : 1000.0,
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
        items: spedItems,
      };
    } else {
      parsedSummary = this.parseNfeXml(fileContent, company.cnpj);
      if (parsedSummary.chaveAcesso.startsWith('NFSE_')) {
        docType = 'NFSE_XML';
      }
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
          emitenteRazao: parsedSummary.emitenteRazao,
          destinatarioCnpj: parsedSummary.destinatarioCnpj,
          destinatarioRazao: parsedSummary.destinatarioRazao,
          natOp: parsedSummary.natOp,
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
      const vIcmsSt = Number(taxes.vIcmsSt || 0);
      const vRetPis = Number(taxes.vRetPis || 0);
      const vRetCofins = Number(taxes.vRetCofins || 0);
      const vRetCsll = Number(taxes.vRetCsll || 0);
      const vIrrf = Number(taxes.vIrrf || 0);
      const vRetPrev = Number(taxes.vRetPrev || 0);
      const totalAmount = Number(doc.totalAmount);

      // Consulta regras vigentes na data de emissão da nota (com fallback seguro)
      const docIssueDate = doc.issueDate ? new Date(doc.issueDate) : new Date();
      let activeRulesOnDate: any[] = [];
      if (prisma.taxRuleVersion?.findMany) {
        activeRulesOnDate =
          (await prisma.taxRuleVersion.findMany({
            where: {
              effectiveFrom: { lte: docIssueDate },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: docIssueDate } }],
            },
          })) || [];
      }

      const ruleBensIn1234 = activeRulesOnDate.find((r) => r.ruleCode === 'IN1234_BENS_TOTAL');
      const ruleServicosIn1234 = activeRulesOnDate.find((r) => r.ruleCode === 'IN1234_SERVICOS_TOTAL');
      const legalMaxBensRate = ruleBensIn1234 ? Number(ruleBensIn1234.ratePercent) : 5.85;
      const legalMaxServicosRate = ruleServicosIn1234 ? Number(ruleServicosIn1234.ratePercent) : 9.45;

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
                  regrasVigentesConsultadas: activeRulesOnDate.length,
                  viaRecuperacao: 'Pedido de Restituição / PER/DCOMP Web na Receita Federal',
                },
                isDocumented: true,
                isLegallyUsable: true,
                isAvailableForOffset: true,
              },
            });
            createdOpportunities.push(opp);
          }
        } else if (totalAmount > 0) {
          // Regime Normal / Presumido (CRT 2 ou 3): verifica se houve retenção acima da alíquota legal do Anexo I da IN RFB 1.234/2012
          const isServiceInvoice =
            doc.docType === 'NFSE_XML' ||
            items.some((it) => ['5933', '6933'].includes((it.cfop || '').replace(/\D/g, '')));
          const legalRatePercent = isServiceInvoice ? legalMaxServicosRate : legalMaxBensRate;
          const maxLegalRetentionAmount = totalAmount * (legalRatePercent / 100);
          const excessRetention = totalRetencaoFederal - maxLegalRetentionAmount;

          if (excessRetention > 1.0) {
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
                  principalAmount: new Prisma.Decimal(excessRetention),
                  selicUpdatedAmount: new Prisma.Decimal(excessRetention * 1.085),
                  legalBasis: `Art. 2º e Anexo I da Instrução Normativa RFB nº 1.234/2012 (Retenção em vendas para órgãos públicos acima da alíquota legal de ${legalRatePercent.toFixed(2)}%).`,
                  calculationMemoryJson: {
                    descricao: `Retenção na fonte acima do limite legal do Anexo I da IN RFB 1.234/2012 (${legalRatePercent.toFixed(2)}%).`,
                    chaveAcesso: doc.accessKeyOrPeriod,
                    dataEmissao: doc.issueDate,
                    valorNota: totalAmount,
                    aliquotaLegalAnexoI: `${legalRatePercent.toFixed(2)}%`,
                    retencaoMaximaDevida: Number(maxLegalRetentionAmount.toFixed(2)),
                    retencaoTotalSofrida: totalRetencaoFederal,
                    totalIndevido: Number(excessRetention.toFixed(2)),
                    regrasVigentesConsultadas: activeRulesOnDate.length,
                    viaRecuperacao: 'Pedido de Restituição / Compensação via PER/DCOMP Web na Receita Federal',
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

        // ---------------------------------------------------------------------
        // D) SUBSTITUIÇÃO TRIBUTÁRIA DE ICMS (ICMS-ST) NO SIMPLES NACIONAL
        // ---------------------------------------------------------------------
        const itensIcmsSt = items.filter((it) => {
          const cfopClean = (it.cfop || '').replace(/\D/g, '');
          const csosnClean = (it.cstOrCsosn || '').replace(/\D/g, '');
          return (
            ['5405', '5403', '6404', '6403'].includes(cfopClean) ||
            ['500', '202', '60'].includes(csosnClean)
          );
        });

        if (itensIcmsSt.length > 0 || vIcmsSt > 0) {
          const totalBaseIcmsSt =
            itensIcmsSt.length > 0
              ? itensIcmsSt.reduce((acc, it) => acc + (it.vProd || 0), 0)
              : totalAmount;
          const icmsPagoIndevidamenteDas = vIcmsSt > 0 ? vIcmsSt : totalBaseIcmsSt * 0.025;

          if (icmsPagoIndevidamenteDas > 5.0) {
            const existingSt = await prisma.taxCreditOpportunity.findFirst({
              where: {
                companyId,
                sourceDocumentId: doc.id,
                originCategory: 'ICMS_ST',
              },
            });

            if (!existingSt) {
              const oppSt = await prisma.taxCreditOpportunity.create({
                data: {
                  tenantId,
                  companyId,
                  sourceDocumentId: doc.id,
                  taxType: 'ICMS_ST',
                  originCategory: 'ICMS_ST',
                  status: 'POTENTIAL',
                  principalAmount: new Prisma.Decimal(icmsPagoIndevidamenteDas),
                  selicUpdatedAmount: new Prisma.Decimal(icmsPagoIndevidamenteDas * 1.08),
                  legalBasis: 'Art. 18, § 4º-A, inciso I da Lei Complementar nº 123/2006 (Segregação de receitas sujeitas à Substituição Tributária de ICMS no PGDAS-D).',
                  calculationMemoryJson: {
                    descricao: 'Itens sujeitos à Substituição Tributária de ICMS (ICMS-ST) com tributação cumulativa indevida na parcela do ICMS dentro do Simples Nacional.',
                    chaveAcesso: doc.accessKeyOrPeriod,
                    dataEmissao: doc.issueDate,
                    totalItensIcmsSt: itensIcmsSt.length,
                    valorBaseIcmsSt: totalBaseIcmsSt,
                    creditoEstimadoIcmsDas: icmsPagoIndevidamenteDas,
                    exemplosItens: itensIcmsSt.slice(0, 5).map((m) => ({
                      cProd: m.cProd,
                      xProd: m.xProd,
                      ncm: m.ncm,
                      cfop: m.cfop,
                      cstOrCsosn: m.cstOrCsosn,
                      vProd: m.vProd,
                    })),
                    viaRecuperacao: 'Retificação do PGDAS-D com segregação da receita com Substituição Tributária de ICMS',
                  },
                  isDocumented: true,
                  isLegallyUsable: true,
                  isAvailableForOffset: true,
                },
              });
              createdOpportunities.push(oppSt);
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
    taxRegime?: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
    operationType?:
      | 'FORNECIMENTO_BENS'
      | 'SERVICOS_CONTINUOS'
      | 'ENGENHARIA_OBRAS'
      | 'SAUDE_EDUCACAO'
      | 'CESTA_BASICA_ISENTO';
  }) {
    const {
      companyId,
      grossRevenueAnnual = 1200000,
      taxRegime = 'SIMPLES_NACIONAL',
      operationType = 'FORNECIMENTO_BENS',
    } = params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error('Empresa não encontrada.');
    }

    // Consulta regras tributárias vigentes e da reforma em TaxRuleVersion
    const taxRules =
      (await prisma.taxRuleVersion.findMany({
        where: {
          taxName: { in: ['CBS', 'IBS', 'IVA_DUAL', 'PIS', 'COFINS', 'ICMS', 'ISS'] },
        },
      })) || [];

    // 1. Carga Atual Estimada por Regime (Simples Nacional, Lucro Presumido ou Lucro Real)
    const cargaPorRegime: Record<string, number> = {
      SIMPLES_NACIONAL: 9.5,
      LUCRO_PRESUMIDO: 14.25,
      LUCRO_REAL: 21.5,
    };
    const cargaAtualPercent = cargaPorRegime[taxRegime] ?? 9.5;
    const valorTributosAtual = grossRevenueAnnual * (cargaAtualPercent / 100);

    // 2. Cenário IVA Dual de Transição 2026 (Alíquota-teste de 1,00% - consulta TaxRuleVersion com fallback)
    const ruleCbs2026 = taxRules.find((r) => r.ruleCode === 'REFORMA_TESTE_2026_CBS');
    const ruleIbs2026 = taxRules.find((r) => r.ruleCode === 'REFORMA_TESTE_2026_IBS');
    const cbsTesteRate = ruleCbs2026 ? Number(ruleCbs2026.ratePercent) : 0.9;
    const ibsTesteRate = ruleIbs2026 ? Number(ruleIbs2026.ratePercent) : 0.1;
    const ivaDual2026Rate = cbsTesteRate + ibsTesteRate;
    const valorIva2026 = grossRevenueAnnual * (ivaDual2026Rate / 100);

    // 3. Cenário Pleno IVA Dual (LC 214/2025) - consulta TaxRuleVersion com fallback
    const ruleIvaPadrao = taxRules.find((r) => r.ruleCode === 'REFORMA_IVA_DUAL_PADRAO');
    const cbsPadrao = 8.8;
    const ibsPadrao = 17.7;
    const ivaPadraoTotal = ruleIvaPadrao ? Number(ruleIvaPadrao.ratePercent) : cbsPadrao + ibsPadrao;

    // Define redutor com base na operação (0%, 30%, 60%, 100%)
    let reducerPercent = 0;
    let reducerDescription = 'Regime Geral sem Redutor (Alíquota Plena 26,50%)';

    if (operationType === 'CESTA_BASICA_ISENTO') {
      reducerPercent = 100; // Redutor de 100% (Alíquota Zero - Cesta Básica Nacional / Medicamentos Críticos)
      reducerDescription = 'Redutor Legal de 100% — Alíquota Zero (Cesta Básica Nacional / Medicamentos Essenciais: 0,00%)';
    } else if (operationType === 'SAUDE_EDUCACAO') {
      const rule60 = taxRules.find((r) => r.ruleCode === 'REFORMA_IVA_DUAL_SAUDE_EDUCACAO_60');
      reducerPercent = rule60?.reducerPercent ? Number(rule60.reducerPercent) : 60;
      reducerDescription = 'Redutor Legal de 60% para Saúde e Educação (Alíquota Efetiva: 10,60%)';
    } else if (operationType === 'SERVICOS_CONTINUOS') {
      const rule30 = taxRules.find((r) => r.ruleCode === 'REFORMA_IVA_DUAL_PROF_REGULAMENTADA_30');
      reducerPercent = rule30?.reducerPercent ? Number(rule30.reducerPercent) : 30;
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
        regimeTributario: taxRegime,
        faturamentoAnual: grossRevenueAnnual,
        cargaTributariaPercent: cargaAtualPercent,
        tributosAnuais: valorTributosAtual,
        comparativoRegimes: {
          SIMPLES_NACIONAL: {
            aliquotaMediaPercent: cargaPorRegime.SIMPLES_NACIONAL,
            tributosAnuais: grossRevenueAnnual * (cargaPorRegime.SIMPLES_NACIONAL / 100),
          },
          LUCRO_PRESUMIDO: {
            aliquotaMediaPercent: cargaPorRegime.LUCRO_PRESUMIDO,
            tributosAnuais: grossRevenueAnnual * (cargaPorRegime.LUCRO_PRESUMIDO / 100),
          },
          LUCRO_REAL: {
            aliquotaMediaPercent: cargaPorRegime.LUCRO_REAL,
            tributosAnuais: grossRevenueAnnual * (cargaPorRegime.LUCRO_REAL / 100),
          },
        },
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
    const taxRules =
      (await prisma.taxRuleVersion.findMany({
        where: {
          effectiveFrom: { lte: new Date() },
        },
      })) || [];

    // Determina a alíquota tributária padrão da operação a partir de TaxRuleVersion (ou 8.5% como padrão seguro)
    const ruleSimplesOrPadrao = taxRules.find(
      (r) => r.ruleCode === 'SIMPLES_ANEXO_I_MEDIA' || r.ruleCode === 'CARGA_PADRAO_LICITACAO',
    );
    const taxPercent = ruleSimplesOrPadrao ? Number(ruleSimplesOrPadrao.ratePercent) : 8.5;

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

    if (
      !validatedByProfessionalName ||
      !validatedByProfessionalName.trim() ||
      !validatedByRegistryCrcOab ||
      !validatedByRegistryCrcOab.trim()
    ) {
      throw new Error(
        'É obrigatório informar o Nome Completo e o Registro Profissional (CRC do Contador ou OAB do Advogado Tributarista) para validar o crédito fiscal.',
      );
    }

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
        validatedByProfessionalName: validatedByProfessionalName.trim(),
        validatedByRegistryCrcOab: validatedByRegistryCrcOab.trim(),
        validatedAt: new Date(),
        perdcompProtocol: perdcompProtocol ? perdcompProtocol.trim() : null,
        isDocumented: true,
        isLegallyUsable: true,
        isAvailableForOffset: true,
      },
    });

    return updated;
  }

  /**
   * Formata data para o padrão formal brasileiro por extenso
   */
  public formatBrazilianDate(date: Date): string {
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ];
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = meses[date.getMonth()];
    const ano = date.getFullYear();
    return `${dia} de ${mes} de ${ano}`;
  }

  public formatCnpj(cnpj: string): string {
    const clean = (cnpj || '').replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj || '';
  }

  /**
   * Gera o modelo preenchido da Declaração de Não Retenção do Simples Nacional
   * (Anexo IV da Instrução Normativa RFB nº 1.234/2012)
   */
  public generateAnexoIVDeclaration(params: {
    empresaRazaoSocial: string;
    empresaCnpj: string;
    empresaEnderecoCompleto: string;
    orgaoDestinatarioNome?: string;
    orgaoDestinatarioCnpj?: string;
    cidade?: string;
    uf?: string;
    dataEmissao?: Date;
    representanteNome?: string;
    representanteCpf?: string;
  }): {
    titulo: string;
    baseLegal: string;
    modeloTextoPreenchido: string;
    instrucoesUso: string;
  } {
    const data = params.dataEmissao || new Date();
    const dataFormatada = this.formatBrazilianDate(data);
    const local = `${params.cidade || 'Município Sede'} - ${params.uf || 'UF'}`;
    const orgaoNome = params.orgaoDestinatarioNome?.trim() || 'ÓRGÃO PÚBLICO CONTRATANTE';
    const orgaoCnpj = params.orgaoDestinatarioCnpj?.trim() ? ` (CNPJ: ${this.formatCnpj(params.orgaoDestinatarioCnpj)})` : '';
    const repIdentificacao = params.representanteNome
      ? `\nRepresentante Legal: ${params.representanteNome}${params.representanteCpf ? ` - CPF: ${params.representanteCpf}` : ''}`
      : '\n[Assinatura do Representante Legal da Empresa ou Certificado Digital ICP-Brasil / Gov.br]';

    const texto = `DECLARAÇÃO A QUE SE REFERE O INCISO XI DO ART. 4º DA INSTRUÇÃO NORMATIVA RFB Nº 1.234, DE 11 DE JANEIRO DE 2012

Ilmo. Senhor
Ordenador de Despesas / Responsável Financeiro de ${orgaoNome}${orgaoCnpj}

A empresa ${params.empresaRazaoSocial.toUpperCase()}, inscrita no CNPJ sob o nº ${this.formatCnpj(params.empresaCnpj)}, com sede em ${params.empresaEnderecoCompleto || 'Endereço da sede cadastrada'}, por intermédio de seu representante legal devidamente constituído, DECLARA à ${orgaoNome}, para fins de NÃO INCIDÊNCIA NA FONTE do IRPJ, da CSLL, da COFINS e da contribuição para o PIS/PASEP a que se refere o art. 64 da Lei nº 9.430, de 27 de dezembro de 1996, que é regularmente optante pelo Regime Especial Unificado de Arrecadação de Tributos e Contribuições devidos pelas Microempresas e Empresas de Pequeno Porte (Simples Nacional), de que trata o art. 12 da Lei Complementar nº 123, de 14 de dezembro de 2006.

Para esse efeito, a declarante declara que:
I - preenche todos os requisitos legais exigidos para a adesão e permanência no Simples Nacional;
II - está ciente de que a falsidade na prestação destas informações a sujeitará, juntamente com as demais pessoas que para ela concorrerem, às penalidades previstas na legislação criminal e tributária, relativas à falsidade ideológica (art. 299 do Código Penal) e a crime contra a ordem tributária (art. 1º da Lei nº 8.137, de 27 de dezembro de 1990).

O declarante compromete-se a informar imediatamente a esse órgão/entidade qualquer alteração na presente situação, sob pena de responsabilidade administrativa, civil e criminal.

Local e Data: ${local}, ${dataFormatada}.

____________________________________________________________________
${params.empresaRazaoSocial.toUpperCase()}
CNPJ: ${this.formatCnpj(params.empresaCnpj)}${repIdentificacao}`;

    return {
      titulo: 'Declaração de Não Retenção na Fonte - Simples Nacional (Anexo IV da IN RFB nº 1.234/2012)',
      baseLegal: 'Art. 4º, inciso XI e Anexo IV da Instrução Normativa RFB nº 1.234/2012; Art. 64 da Lei nº 9.430/1996; Art. 12 da Lei Complementar nº 123/2006.',
      modeloTextoPreenchido: texto,
      instrucoesUso: 'Imprima esta declaração em papel timbrado da empresa ou assine digitalmente via Certificado Digital ICP-Brasil / Assinatura Eletrônica Gov.br. Ela deve ser anexada obrigatoriamente a cada Nota Fiscal emitida para a Administração Pública para impedir a glosa ou retenção indevida na liquidação da nota de empenho.',
    };
  }

  // ===========================================================================
  // MÓDULO 05: AUDITORIA FISCAL INTELIGENTE E RELATÓRIO DE DIVERGÊNCIAS
  // ===========================================================================
  public async runSmartFiscalAudit(params: {
    tenantId: string;
    companyId: string;
    noticeId?: string;
    documentId?: string;
    orgaoDestinatarioNome?: string;
    orgaoDestinatarioCnpj?: string;
  }): Promise<SmartFiscalAuditResult> {
    const { tenantId, companyId, noticeId, documentId, orgaoDestinatarioNome, orgaoDestinatarioCnpj } = params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error('Empresa contratante não encontrada.');
    }

    const whereDoc: Prisma.FiscalDocumentImportWhereInput = {
      tenantId,
      companyId,
    };
    if (documentId) {
      whereDoc.id = documentId;
    }

    const documents = await prisma.fiscalDocumentImport.findMany({
      where: whereDoc,
      orderBy: { issueDate: 'desc' },
      take: 50,
    });

    let editalInfo: any = null;
    let editalItens: any[] = [];

    if (noticeId) {
      editalInfo = await prisma.procurementNotice.findFirst({
        where: {
          OR: [{ id: noticeId }, { externalId: noticeId }, { numeroControlePncp: noticeId }],
        },
        include: {
          items: true,
        },
      });
      if (editalInfo && Array.isArray(editalInfo.items)) {
        editalItens = editalInfo.items;
      }
    }

    const divergencias: FiscalAuditDivergence[] = [];
    let valorTotalDocumentosAuditados = 0;
    let impactoFinanceiroRiscoGlosa = 0;
    let creditosRecuperaveisIdentificados = 0;

    const companyCrt = 1; // Padrão Simples Nacional para PMEs
    const regimeTributarioNome = companyCrt === 1 ? 'Simples Nacional (LC 123/2006)' : 'Regime Normal (Lucro Presumido/Real)';

    for (const doc of documents) {
      const taxes = (doc.taxesSummaryJson as Record<string, any>) || {};
      const items = ((doc.parsedItemsJson as unknown) as ParsedFiscalItem[]) || [];
      const docCrt = taxes.emitenteCrt ?? companyCrt;
      const docTotal = Number(doc.totalAmount || 0);
      valorTotalDocumentosAuditados += docTotal;

      const vRetPis = Number(taxes.vRetPis || 0);
      const vRetCofins = Number(taxes.vRetCofins || 0);
      const vRetCsll = Number(taxes.vRetCsll || 0);
      const vIrrf = Number(taxes.vIrrf || 0);
      const totalRetencaoFederal = vRetPis + vRetCofins + vRetCsll + vIrrf;

      const destRazao = String(taxes.destinatarioRazao || doc.accessKeyOrPeriod || '').toUpperCase();
      const isVendaPoderPublico =
        doc.direction === 'SAIDA' ||
        destRazao.includes('PREFEITURA') ||
        destRazao.includes('MUNICIPIO') ||
        destRazao.includes('ESTADO') ||
        destRazao.includes('SECRETARIA') ||
        destRazao.includes('MINISTERIO') ||
        destRazao.includes('HOSPITAL') ||
        destRazao.includes('AUTARQUIA') ||
        destRazao.includes('FUNDACAO') ||
        destRazao.includes('CONSELHO') ||
        destRazao.includes('CAMARA') ||
        Boolean(orgaoDestinatarioNome);

      // 1. Auditoria de Retenção da IN RFB 1.234/2012 (Risco de Glosa no Empenho)
      if (docCrt === 1 && totalRetencaoFederal > 0) {
        impactoFinanceiroRiscoGlosa += totalRetencaoFederal;
        divergencias.push({
          id: `DIV_RET_${doc.id}_${divergencias.length + 1}`,
          tipo: 'RETENCAO_INDEVIDA_SIMPLES',
          severidade: 'ALTA',
          chaveAcesso: doc.accessKeyOrPeriod,
          descricaoDivergencia: `NF-e emitida com destaque de retenção federal (R$ ${totalRetencaoFederal.toFixed(2)}) sendo a empresa optante pelo Simples Nacional.`,
          impactoFinanceiroEstimado: totalRetencaoFederal,
          riscoNoEmpenho: `Risco iminente de glosa na liquidação do empenho e retenção indevida de tributos federais (IRRF, CSLL, PIS e COFINS). O setor financeiro do órgão reterá R$ ${totalRetencaoFederal.toFixed(2)}, violando o Art. 4º, XI da IN RFB 1.234/2012.`,
          orientacaoCorrecao: `Emitir Carta de Correção Eletrônica (CC-e) zerando o campo de retenção ou cancelar e reemitir a NF-e sem retenções, anexando a Declaração de Não Retenção (Anexo IV da IN RFB 1.234/2012). Caso o órgão já tenha retido, protocolar PER/DCOMP Web de Pagamento Indevido.`,
          baseLegal: 'Art. 4º, inciso XI da Instrução Normativa RFB nº 1.234/2012 (Vedação expressa de retenção sobre optantes do Simples Nacional).',
        });
      } else if (docCrt === 3 && totalRetencaoFederal === 0 && isVendaPoderPublico && docTotal > 100) {
        const retencaoEsperada = docTotal * 0.0585;
        divergencias.push({
          id: `DIV_RET_NORMAL_${doc.id}_${divergencias.length + 1}`,
          tipo: 'RETENCAO_AUSENTE_REGIME_NORMAL',
          severidade: 'MEDIA',
          chaveAcesso: doc.accessKeyOrPeriod,
          descricaoDivergencia: `Venda para o poder público sem destaque das retenções federais da IN RFB 1.234/2012 (estimado em R$ ${retencaoEsperada.toFixed(2)}).`,
          impactoFinanceiroEstimado: retencaoEsperada,
          riscoNoEmpenho: `O órgão público efetuará a retenção de ofício ao pagar o empenho, gerando divergência contábil entre a NF-e e o valor creditado na conta bancária.`,
          orientacaoCorrecao: `Destacar os tributos federais retidos (Código 5952 / 1708) conforme tabela do Anexo I da IN RFB 1.234/2012 no corpo da nota e nos campos específicos da NF-e.`,
          baseLegal: 'Art. 2º e Anexo I da Instrução Normativa RFB nº 1.234/2012.',
        });
      }

      // 2. Auditoria de Itens: NCM, CFOP e Cruzamento com CATMAT / Edital
      for (const item of items) {
        const cleanNcm = (item.ncm || '').replace(/\D/g, '');
        const cleanCfop = (item.cfop || '').replace(/\D/g, '');

        if (!cleanNcm || cleanNcm.length !== 8 || cleanNcm === '00000000' || cleanNcm === '99999999') {
          divergencias.push({
            id: `DIV_NCM_GEN_${doc.id}_${item.nItem}`,
            tipo: 'NCM_GENERICO_INVALIDO',
            severidade: 'MEDIA',
            chaveAcesso: doc.accessKeyOrPeriod,
            itemNumero: item.nItem,
            itemDescricao: item.xProd,
            ncm: item.ncm,
            cfop: item.cfop,
            descricaoDivergencia: `Item ${item.nItem} ("${item.xProd}") possui código NCM "${item.ncm || 'vazio'}" incompleto ou genérico.`,
            impactoFinanceiroEstimado: item.vProd * 0.05,
            riscoNoEmpenho: `Recusa do recebimento definitivo pelo fiscal do contrato por divergência cadastral ou autuação por erro na classificação fiscal (Art. 527 do RICMS).`,
            orientacaoCorrecao: `Classificar a mercadoria na NCM correta de 8 dígitos da Tabela TIPI compatível com o Termo de Referência do edital.`,
            baseLegal: 'Art. 76 do Decreto nº 7.212/2010 (RIPI) e Resolução Gecex/Camex nº 272/2021.',
          });
        }

        if (editalItens.length > 0) {
          const matchingEditalItem = editalItens.find((ei) => {
            const descEdital = (ei.description || '').toLowerCase();
            const descItem = (item.xProd || '').toLowerCase();
            return (
              descEdital.includes(descItem) ||
              descItem.includes(descEdital) ||
              (ei.itemNumber && String(ei.itemNumber) === String(item.nItem))
            );
          });

          if (matchingEditalItem) {
            const catmat = String(
              matchingEditalItem.catalogoCodigo ||
                matchingEditalItem.codigoItemCatalogo ||
                matchingEditalItem.catmat ||
                matchingEditalItem.itemNumber ||
                '',
            );
            const editalNcmPrefix = String(matchingEditalItem.ncm || '').replace(/\D/g, '').slice(0, 4);
            const isNcmMismatchWithEdital =
              cleanNcm.startsWith('00') ||
              cleanNcm.length !== 8 ||
              (editalNcmPrefix.length === 4 && !cleanNcm.startsWith(editalNcmPrefix));

            if (catmat && isNcmMismatchWithEdital) {
              divergencias.push({
                id: `DIV_CATMAT_${doc.id}_${item.nItem}`,
                tipo: 'NCM_INCOMPATIVEL_CATMAT',
                severidade: 'ALTA',
                chaveAcesso: doc.accessKeyOrPeriod,
                itemNumero: item.nItem,
                itemDescricao: item.xProd,
                ncm: item.ncm,
                descricaoDivergencia: `NCM "${item.ncm}" incompatível com o código CATMAT/CATSER ${catmat} (${matchingEditalItem.description}) exigido no edital.`,
                impactoFinanceiroEstimado: item.vProd,
                riscoNoEmpenho: `Glosa total da fatura e bloqueio da emissão da nota de liquidação no Almoxarifado do órgão licitante.`,
                orientacaoCorrecao: `Ajustar a NCM do produto para corresponder à subclasse exata do código CATMAT ${catmat} catalogado no Compras.gov.br.`,
                baseLegal: 'Instrução Normativa SEGES/ME nº 73/2022 e Catálogo Unificado de Materiais do Governo Federal (CATMAT).',
              });
            }
          }
        }

        if (isVendaPoderPublico && cleanCfop) {
          const cfopsInvalidosVenda = ['5151', '5152', '6151', '6152', '5201', '5202', '6201', '6202', '5910', '6910', '5556'];
          if (cfopsInvalidosVenda.includes(cleanCfop)) {
            divergencias.push({
              id: `DIV_CFOP_${doc.id}_${item.nItem}`,
              tipo: 'CFOP_INADEQUADO_ORGAO_PUBLICO',
              severidade: 'ALTA',
              chaveAcesso: doc.accessKeyOrPeriod,
              itemNumero: item.nItem,
              itemDescricao: item.xProd,
              cfop: item.cfop,
              descricaoDivergencia: `Item ${item.nItem} faturado com CFOP ${item.cfop} (operação não comercial ou transferência/devolução) em fornecimento ao poder público.`,
              impactoFinanceiroEstimado: item.vProd,
              riscoNoEmpenho: `O setor de liquidação contábil do órgão rejeitará a nota fiscal, impedindo a atestação e o pagamento do contrato.`,
              orientacaoCorrecao: `Substituir por CFOP de venda comercial compatível: 5.102 (revenda interna), 5.101 (produção interna), 6.102 (revenda interestadual) ou 6.101 (produção interestadual).`,
              baseLegal: 'Ajuste SINIEF 07/2001 e Tabela CFOP do Convênio S/Nº de 1970.',
            });
          }
        }

        if (docCrt === 1 && this.isMonophasicNcm(cleanNcm) && item.cstOrCsosn && item.cstOrCsosn !== '500') {
          const pisCofinsBiTributado = item.vProd * 0.0198;
          creditosRecuperaveisIdentificados += pisCofinsBiTributado;
          divergencias.push({
            id: `DIV_MONO_${doc.id}_${item.nItem}`,
            tipo: 'MONOFASICO_NAO_SEGREGADO',
            severidade: 'MEDIA',
            chaveAcesso: doc.accessKeyOrPeriod,
            itemNumero: item.nItem,
            itemDescricao: item.xProd,
            ncm: item.ncm,
            descricaoDivergencia: `Item ${item.nItem} possui NCM Monofásico (${item.ncm}), mas foi emitido com CSOSN ${item.cstOrCsosn} em vez de CSOSN 500, gerando bitributação de PIS/COFINS no DAS.`,
            impactoFinanceiroEstimado: pisCofinsBiTributado,
            riscoNoEmpenho: `A empresa está pagando 1,98% a mais no DAS do Simples Nacional sem necessidade, reduzindo a margem líquida do contrato.`,
            orientacaoCorrecao: `Segregar a receita desse item na apuração do PGDAS-D como "Receita com Tributação Monofásica de PIS/COFINS", gerando crédito recuperável via restituição eletrônica direta no e-CAC.`,
            baseLegal: 'Art. 18, § 4º-A, inciso I da Lei Complementar nº 123/2006.',
          });
        }
      }
    }

    const totalDivergencias = divergencias.length;
    let statusAuditoria: 'CRITICA' | 'ATENCAO' | 'REGULAR' = 'REGULAR';
    if (divergencias.some((d) => d.severidade === 'ALTA')) {
      statusAuditoria = 'CRITICA';
    } else if (divergencias.some((d) => d.severidade === 'MEDIA')) {
      statusAuditoria = 'ATENCAO';
    }

    const enderecoCompleto = [company.municipio, company.uf]
      .filter(Boolean)
      .join(' - ') || 'Sede da Empresa';

    const declaracaoAnexoIV = this.generateAnexoIVDeclaration({
      empresaRazaoSocial: company.razaoSocial,
      empresaCnpj: company.cnpj,
      empresaEnderecoCompleto: enderecoCompleto,
      orgaoDestinatarioNome,
      orgaoDestinatarioCnpj,
      cidade: company.municipio || undefined,
      uf: company.uf || undefined,
      dataEmissao: new Date(),
    });

    return {
      empresa: {
        id: company.id,
        razaoSocial: company.razaoSocial,
        cnpj: company.cnpj,
        crt: companyCrt,
        regimeTributario: regimeTributarioNome,
      },
      editalAuditado: editalInfo
        ? {
            id: editalInfo.id,
            numeroControlePncp: editalInfo.numeroControlePncp || editalInfo.externalId,
            objeto: editalInfo.objeto || editalInfo.title,
            itensCount: editalItens.length,
          }
        : null,
      documentosAnalisadosCount: documents.length,
      totalDivergencias,
      statusAuditoria,
      divergencias,
      resumoFinanceiro: {
        valorTotalDocumentosAuditados,
        impactoFinanceiroRiscoGlosa,
        creditosRecuperaveisIdentificados,
      },
      declaracaoNaoRetencaoAnexoIV: declaracaoAnexoIV,
    };
  }

  // ===========================================================================
  // MÓDULO 07: PREPARAÇÃO PER/DCOMP E COMPENSAÇÃO CRUZADA DCTFWEB
  // ===========================================================================
  public async preparePerdcompAndCrossOffset(params: {
    tenantId: string;
    companyId: string;
    creditIds?: string[];
    validationPayload?: {
      creditId: string;
      validatedByProfessionalName: string;
      validatedByRegistryCrcOab: string;
    };
    debitosParaCompensar?: CrossOffsetDebitoItem[];
    protocolosParaRegistrar?: {
      creditId: string;
      protocolo: string;
    }[];
  }): Promise<CrossOffsetBatchResult> {
    const { tenantId, companyId, creditIds, validationPayload, debitosParaCompensar = [], protocolosParaRegistrar = [] } = params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error('Empresa contratante não encontrada.');
    }

    // 1. Validação com exigência estrita de Nome e Registro Profissional (CRC / OAB)
    if (validationPayload) {
      await this.validateCreditOpportunity({
        tenantId,
        companyId,
        creditId: validationPayload.creditId,
        validatedByProfessionalName: validationPayload.validatedByProfessionalName,
        validatedByRegistryCrcOab: validationPayload.validatedByRegistryCrcOab,
      });
    }

    // 2. Registro de protocolos PER/DCOMP transmitidos
    if (protocolosParaRegistrar.length > 0) {
      for (const item of protocolosParaRegistrar) {
        if (!item.creditId || !item.protocolo) continue;
        await prisma.taxCreditOpportunity.updateMany({
          where: { id: item.creditId, companyId },
          data: {
            perdcompProtocol: item.protocolo.trim(),
            status: 'VALIDATED',
          },
        });
      }
    }

    // 3. Busca créditos com status VALIDATED elegíveis para PER/DCOMP e Compensação Cruzada
    const whereCredit: Prisma.TaxCreditOpportunityWhereInput = {
      tenantId,
      companyId,
      status: 'VALIDATED',
      isLegallyUsable: true,
      isAvailableForOffset: true,
    };
    if (creditIds && creditIds.length > 0) {
      whereCredit.id = { in: creditIds };
    }

    const validCredits = await prisma.taxCreditOpportunity.findMany({
      where: whereCredit,
      include: {
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (validCredits.length === 0) {
      throw new Error(
        'Nenhum crédito fiscal com status VALIDATED e apto para compensação foi encontrado. Valide os créditos informando o responsável técnico (CRC/OAB) antes de gerar o PER/DCOMP.',
      );
    }

    const espelhosPerdcompWeb: PerdcompMirrorItem[] = [];
    let totalCreditosValidadosValor = 0;
    let totalCreditosComSelicValor = 0;
    let saldoFazendarioDisponivel = 0;
    let saldoPrevidenciarioDisponivel = 0;

    const taxaSelicPadraoPercent = 10.25;

    for (let i = 0; i < validCredits.length; i++) {
      const credit = validCredits[i];
      const principal = Number(credit.principalAmount);
      const jurosSelic = principal * (taxaSelicPadraoPercent / 100);
      const totalAtualizado = principal + jurosSelic;

      totalCreditosValidadosValor += principal;
      totalCreditosComSelicValor += totalAtualizado;

      const isPrevidenciario = credit.taxType === 'INSS' || credit.originCategory === 'RETENCAO_INSS_11';
      if (isPrevidenciario) {
        saldoPrevidenciarioDisponivel += totalAtualizado;
      } else {
        saldoFazendarioDisponivel += totalAtualizado;
      }

      let codigoReceita = '5952';
      let tipoCreditoEcac = 'Pagamento Indevido ou a Maior';
      let tipoDocDcomp: 'DECLARACAO_COMPENSACAO' | 'PEDIDO_RESTITUICAO' = 'DECLARACAO_COMPENSACAO';

      if (credit.originCategory === 'RETENCAO_IN1234') {
        codigoReceita = '5952 / 1708';
        tipoCreditoEcac = 'Pagamento Indevido ou a Maior - Tributos Federais Retidos na Fonte (IN RFB 1.234/2012)';
      } else if (credit.originCategory === 'RETENCAO_INSS_11') {
        codigoReceita = '2631 (INSS Retenção Lei 9.711/98)';
        tipoCreditoEcac = 'Retenção de Contribuição Previdenciária sobre Cessão de Mão de Obra (Lei nº 9.711/1998)';
      } else if (credit.originCategory === 'PIS_COFINS_MONOFASICO') {
        codigoReceita = '1500 (PGDAS-D Simples Nacional)';
        tipoCreditoEcac = 'Pagamento Indevido ou a Maior no Simples Nacional (LC 123/2006)';
        tipoDocDcomp = 'PEDIDO_RESTITUICAO';
      }

      const memory = (credit.calculationMemoryJson as Record<string, any>) || {};
      const chaveAcesso = memory.chaveAcesso || credit.sourceDocumentId || 'ORIGEM_DOCUMENTADA';
      const dataArrecadacao = memory.dataEmissao
        ? new Date(memory.dataEmissao).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const competencia = dataArrecadacao.slice(0, 7).split('-').reverse().join('/');

      const respNome = credit.validatedByProfessionalName || 'Responsável Técnico Habilitado';
      const respReg = credit.validatedByRegistryCrcOab || 'Registro Profissional Homologado';
      const respData = credit.validatedAt
        ? credit.validatedAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const mirror: PerdcompMirrorItem = {
        creditId: credit.id,
        numeroOrdem: i + 1,
        tipoDocumentoDcomp: tipoDocDcomp,
        tipoCreditoEcac,
        codigoReceitaDarfOuDas: codigoReceita,
        periodoApuracaoCompetencia: competencia,
        dataArrecadacaoOuRetencao: dataArrecadacao,
        chaveAcessoDocumento: chaveAcesso,
        valorPrincipalOriginal: principal,
        taxaSelicAcumuladaPercent: taxaSelicPadraoPercent,
        valorJurosSelic: jurosSelic,
        valorAtualizadoTotal: totalAtualizado,
        saldoDisponivelCompensacao: totalAtualizado,
        origemCategoria: credit.originCategory,
        baseLegal: credit.legalBasis,
        responsavelTecnicoValidacao: {
          nome: respNome,
          registroCrcOuOab: respReg,
          dataValidacao: respData,
        },
        protocoloPerdcomp: credit.perdcompProtocol || 'PENDENTE_DE_TRANSMISSAO',
        statusTransmitido: Boolean(credit.perdcompProtocol),
        espelhoFormularioEcac: {
          campo01_IdentificacaoContribuinte: `CNPJ: ${this.formatCnpj(company.cnpj)} - ${company.razaoSocial}`,
          campo02_GrupoCredito: isPrevidenciario ? 'Créditos da Contribuição Previdenciária (INSS)' : 'Créditos Fazendários Administrados pela RFB',
          campo03_TipoCredito: tipoCreditoEcac,
          campo04_CompetenciaOuPeriodo: competencia,
          campo05_CodigoReceitaPrincipal: codigoReceita,
          campo06_DataPagamentoOuRetencao: dataArrecadacao,
          campo07_ValorOriginal: `R$ ${principal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          campo08_IndiceSelic: `${taxaSelicPadraoPercent.toFixed(2)}% (Art. 39, § 4º da Lei 9.250/95)`,
          campo09_ValorTotalComSelic: `R$ ${totalAtualizado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          campo10_InformacoesComplementares: `Crédito fiscal homologado formalmente por ${respNome} (${respReg}). Chave/Origem: ${chaveAcesso}. Fundamento: ${credit.legalBasis}.`,
        },
      };

      espelhosPerdcompWeb.push(mirror);
    }

    let totalDebitosSubmetidosValor = 0;
    let debitosPrevidenciariosTotal = 0;
    let debitosFazendariosTotal = 0;

    for (const deb of debitosParaCompensar) {
      const val = Number(deb.valorOriginalDebito || 0);
      totalDebitosSubmetidosValor += val;
      if (deb.tipoDebito === 'ESOCIAL_PREVIDENCIARIO' || deb.tipoDebito === 'REINF_RETENCOES') {
        debitosPrevidenciariosTotal += val;
      } else {
        debitosFazendariosTotal += val;
      }
    }

    const fazendarioAbatePrevidenciario = Math.min(saldoFazendarioDisponivel, debitosPrevidenciariosTotal);
    const saldoFazendarioRestante = saldoFazendarioDisponivel - fazendarioAbatePrevidenciario;
    const debitosPrevidenciariosRestantes = debitosPrevidenciariosTotal - fazendarioAbatePrevidenciario;

    const previdenciarioAbateFazendario = Math.min(saldoPrevidenciarioDisponivel, debitosFazendariosTotal);
    const saldoPrevidenciarioRestante = saldoPrevidenciarioDisponivel - previdenciarioAbateFazendario;
    const debitosFazendariosRestantes = debitosFazendariosTotal - previdenciarioAbateFazendario;

    const fazendarioAbateFazendario = Math.min(saldoFazendarioRestante, debitosFazendariosRestantes);
    const previdenciarioAbatePrevidenciario = Math.min(saldoPrevidenciarioRestante, debitosPrevidenciariosRestantes);

    const saldoFinalDevedor =
      debitosPrevidenciariosRestantes -
      previdenciarioAbatePrevidenciario +
      (debitosFazendariosRestantes - fazendarioAbateFazendario);

    const saldoRestanteCreditos =
      saldoFazendarioRestante -
      fazendarioAbateFazendario +
      (saldoPrevidenciarioRestante - previdenciarioAbatePrevidenciario);

    return {
      empresa: {
        id: company.id,
        razaoSocial: company.razaoSocial,
        cnpj: company.cnpj,
      },
      totalCreditosValidadosDisponiveis: validCredits.length,
      totalCreditosValidadosValor,
      totalCreditosComSelicValor,
      totalDebitosSubmetidosValor,
      capacidadeAbatimentoCruzadoDctfWeb: {
        creditosFazendariosParaDebitosPrevidenciarios: fazendarioAbatePrevidenciario,
        creditosPrevidenciariosParaDebitosFazendarios: previdenciarioAbateFazendario,
        saldoFinalDevedorAposCompensacao: Math.max(0, saldoFinalDevedor),
        saldoRestanteCreditosParaFuturasDcomp: Math.max(0, saldoRestanteCreditos),
      },
      espelhosPerdcompWeb,
      fundamentoJuridicoCompensacaoCruzada:
        'Art. 74 da Lei nº 9.430/1996 com redação dada pela Lei nº 13.670/2018 e Instrução Normativa RFB nº 2.055/2021. Empresas que transmitem a DCTFWeb e eSocial podem compensar débitos previdenciários com créditos fazendários da União e vice-versa.',
      passoAPassoTransmissaoEcac: [
        '1. Acesse o Portal e-CAC da Receita Federal (cav.receita.fazenda.gov.br) com Certificado Digital da empresa.',
        '2. Navegue até o menu "Restituição e Compensação" > "Acessar PER/DCOMP Web".',
        '3. Clique em "Novo Documento" e selecione "Declaração de Compensação" (ou Pedido de Restituição para o Simples Nacional).',
        '4. Copie os dados exatos do espelho gerado nesta tela (Grupo de Crédito, Código da Receita, Período de Apuração e Valor Original).',
        '5. Vincule os débitos declarados na DCTFWeb que deseja abater via Compensação Cruzada.',
        '6. Transmita a DCOMP e copie o número do recibo/protocolo de transmissão gerado pela Receita Federal.',
        '7. Registre o número do protocolo no sistema Expertise para blindar a auditoria e acompanhar o processamento.',
      ],
    };
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

