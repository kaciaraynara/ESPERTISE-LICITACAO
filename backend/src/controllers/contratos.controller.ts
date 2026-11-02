import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../database/prisma';
import { AuthRequest, resolveAuthorizedCompany } from '../shared/middlewares/auth.middleware';

const INDICES_OFICIAIS_PADRAO: Record<string, number> = {
  IPCA: 4.62,
  INPC: 4.18,
  'IGP-M': 4.89,
  INCC: 5.45,
  IST: 4.35,
};

function calcularDiasEntre(dataInicial: Date, dataFinal: Date): number {
  const diffMs = dataFinal.getTime() - dataInicial.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function gerarPdf(texto: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const documento = new PDFDocument({ margin: 50 });
    const partes: Buffer[] = [];

    documento.on('data', (parte: Buffer) => partes.push(parte));
    documento.on('end', () => resolve(Buffer.concat(partes)));
    documento.on('error', reject);
    documento.font('Helvetica').fontSize(11).text(texto, { align: 'justify', lineGap: 4 });
    documento.end();
  });
}

function nomeArquivoSeguro(nome: string): string {
  return nome.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export class ContratosController {
  /**
   * GET /api/v1/contratos
   * Lista todos os contratos da empresa ativa do usuário, enriquecidos com alertas de vencimento
   * e indicadores de elegibilidade para reajuste/repactuação.
   */
  async listar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);
      if (!company) {
        return res.json({
          success: true,
          data: {
            contratos: [],
            alertasVencimento: [],
            resumo: {
              totalContratos: 0,
              contratosAtivos: 0,
              valorTotalInicial: 0,
              valorTotalAtual: 0,
              vencendoEm60Dias: 0,
              elegiveisReajuste: 0,
            },
          },
        });
      }

      const contratosRaw = await prisma.contract.findMany({
        where: { companyId: company.id },
        include: {
          aditivos: {
            orderBy: { dataAssinatura: 'desc' },
          },
          prazosVigencia: {
            orderBy: { dataFim: 'asc' },
          },
        },
        orderBy: { dataFim: 'asc' },
      });

      const agora = new Date();

      const contratos = contratosRaw.map((contrato) => {
        const valorInicial = Number(contrato.valorInicial);
        const valorAtual = Number(contrato.valorAtual);
        const dataAssinatura = new Date(contrato.dataAssinatura);
        const dataFim = new Date(contrato.dataFim);
        const dataBase = contrato.dataBaseProposta
          ? new Date(contrato.dataBaseProposta)
          : dataAssinatura;

        const diasParaVencimento = calcularDiasEntre(agora, dataFim);
        const diasDesdeDataBase = calcularDiasEntre(dataBase, agora);
        const elegivelReajusteAnual =
          contrato.status === 'ATIVO' && diasDesdeDataBase >= 365;

        const indice = (contrato.indiceReajuste || 'IPCA').toUpperCase();
        const percentualSugerido = INDICES_OFICIAIS_PADRAO[indice] ?? 4.62;
        const potencialReajusteValor = Number(
          ((valorAtual * percentualSugerido) / 100).toFixed(2),
        );

        let nivelAlertaVencimento: 'CRITICO' | 'ATENCAO' | 'NORMAL' | 'VENCIDO' = 'NORMAL';
        if (diasParaVencimento < 0) {
          nivelAlertaVencimento = 'VENCIDO';
        } else if (diasParaVencimento <= 30) {
          nivelAlertaVencimento = 'CRITICO';
        } else if (diasParaVencimento <= 60) {
          nivelAlertaVencimento = 'ATENCAO';
        }

        return {
          id: contrato.id,
          companyId: contrato.companyId,
          cnpjEmpresa: contrato.cnpjEmpresa || company.cnpj,
          numeroContrato: contrato.numeroContrato,
          processoAdministrativo: contrato.processoAdministrativo,
          orgao: contrato.orgao,
          cnpjOrgao: contrato.cnpjOrgao,
          uf: contrato.uf,
          objeto: contrato.objeto,
          valorInicial,
          valorAtual,
          indiceReajuste: contrato.indiceReajuste || 'IPCA',
          dataBaseProposta: dataBase.toISOString(),
          dataAssinatura: dataAssinatura.toISOString(),
          dataInicioVigencia: contrato.dataInicioVigencia
            ? contrato.dataInicioVigencia.toISOString()
            : dataAssinatura.toISOString(),
          dataFim: dataFim.toISOString(),
          dedicacaoExclusiva: contrato.isMaoDeObraExclusiva,
          isMaoDeObraExclusiva: contrato.isMaoDeObraExclusiva,
          predominanciaMaoDeObra: contrato.predominanciaMaoDeObra,
          isFornecimentoGeral: contrato.isFornecimentoGeral,
          status: contrato.status,
          observacoes: contrato.observacoes,
          diasParaVencimento,
          diasDesdeDataBase,
          elegivelReajusteAnual,
          percentualSugerido,
          potencialReajusteValor,
          nivelAlertaVencimento,
          aditivos: contrato.aditivos.map((ad) => ({
            id: ad.id,
            numeroTermo: ad.numeroTermo,
            tipo: ad.tipo,
            fundamentoLegal: ad.fundamentoLegal,
            justificativa: ad.justificativa,
            valorAlteracao: ad.valorAlteracao ? Number(ad.valorAlteracao) : null,
            percentualAlteracao: ad.percentualAlteracao ? Number(ad.percentualAlteracao) : null,
            novoValorContrato: ad.novoValorContrato ? Number(ad.novoValorContrato) : null,
            novaDataFim: ad.novaDataFim ? ad.novaDataFim.toISOString() : null,
            dataAssinatura: ad.dataAssinatura.toISOString(),
          })),
          prazosVigencia: contrato.prazosVigencia.map((pv) => ({
            id: pv.id,
            titulo: pv.titulo,
            tipoMarco: pv.tipoMarco,
            dataInicio: pv.dataInicio.toISOString(),
            dataFim: pv.dataFim.toISOString(),
            dataAlerta: pv.dataAlerta ? pv.dataAlerta.toISOString() : null,
            diasAntecedenciaAlerta: pv.diasAntecedenciaAlerta,
            status: pv.status,
            observacoes: pv.observacoes,
          })),
        };
      });

      const alertasVencimento = contratos
        .filter((c) => c.status === 'ATIVO' || c.status === 'EM_RENOVACAO')
        .map((c) => ({
          contractId: c.id,
          numeroContrato: c.numeroContrato,
          orgao: c.orgao,
          objeto: c.objeto,
          dataAssinatura: c.dataAssinatura,
          dataFim: c.dataFim,
          diasParaVencimento: c.diasParaVencimento,
          nivelAlerta: c.nivelAlertaVencimento,
          valorAtual: c.valorAtual,
          recomendacao:
            c.diasParaVencimento <= 60
              ? 'Protocolar ofício de manifestação de interesse na prorrogação contratual (Art. 107 da Lei 14.133/2021).'
              : 'Vigência dentro do cronograma regular de execução.',
        }));

      const contratosAtivos = contratos.filter((c) => c.status === 'ATIVO').length;
      const valorTotalInicial = contratos.reduce((acc, c) => acc + c.valorInicial, 0);
      const valorTotalAtual = contratos
        .filter((c) => c.status === 'ATIVO' || c.status === 'EM_RENOVACAO')
        .reduce((acc, c) => acc + c.valorAtual, 0);
      const vencendoEm60Dias = contratos.filter(
        (c) => c.status === 'ATIVO' && c.diasParaVencimento >= 0 && c.diasParaVencimento <= 60,
      ).length;
      const elegiveisReajuste = contratos.filter((c) => c.elegivelReajusteAnual).length;

      return res.json({
        success: true,
        data: {
          contratos,
          alertasVencimento,
          resumo: {
            totalContratos: contratos.length,
            contratosAtivos,
            valorTotalInicial,
            valorTotalAtual,
            vencendoEm60Dias,
            elegiveisReajuste,
          },
        },
      });
    } catch (error) {
      console.error('[ContratosController.listar] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar contratos da empresa.',
      });
    }
  }

  /**
   * GET /api/v1/contratos/garantias
   * Lista garantias e valores retidos somente da empresa ativa do usuário.
   */
  async listarGarantias(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);
      if (!company) {
        return res.json({
          success: true,
          data: { totalRetido: 0, garantias: [] },
        });
      }

      const [garantiasContratuais, garantiasLegadas] = await Promise.all([
        prisma.contractGuarantee.findMany({
          where: { companyId: company.id },
          include: {
            contract: {
              select: { id: true, numeroContrato: true, orgao: true, status: true },
            },
          },
          orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'desc' }],
        }),
        prisma.guarantee.findMany({
          where: { companyId: company.id },
          include: {
            contract: {
              select: { id: true, numeroContrato: true, orgao: true, status: true },
            },
          },
          orderBy: [{ dataVencimento: 'asc' }, { createdAt: 'desc' }],
        }),
      ]);

      const data = [
        ...garantiasContratuais.map((garantia) => ({
          id: garantia.id,
          contractId: garantia.contractId,
          tipoGarantia: garantia.tipoGarantia,
          modalidade: garantia.modalidade,
          valorOriginal: Number(garantia.valorGarantido),
          status: garantia.status,
          dataVencimento: garantia.dataVencimento?.toISOString() ?? null,
          statusAlerta: null,
          comprovanteUrl: null,
          contrato: garantia.contract,
        })),
        ...garantiasLegadas.map((garantia) => ({
        id: garantia.id,
        contractId: garantia.contractId,
        tipoGarantia: garantia.tipoGarantia,
        modalidade: garantia.modalidade,
        valorOriginal: Number(garantia.valorOriginal),
        status: garantia.status,
        dataVencimento: garantia.dataVencimento?.toISOString() ?? null,
        statusAlerta: garantia.statusAlerta,
        comprovanteUrl: garantia.comprovanteUrl,
        contrato: garantia.contract,
        })),
      ].sort((a, b) => {
        if (!a.dataVencimento) return b.dataVencimento ? 1 : 0;
        if (!b.dataVencimento) return -1;
        return a.dataVencimento.localeCompare(b.dataVencimento);
      });

      return res.json({
        success: true,
        data: {
          totalRetido: data
            .filter((garantia) => garantia.status !== 'RESGATADA')
            .reduce((total, garantia) => total + garantia.valorOriginal, 0),
          garantias: data,
        },
      });
    } catch (error) {
      console.error('[ContratosController.listarGarantias] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao buscar garantias da empresa.',
      });
    }
  }

  /**
   * GET /api/v1/contratos/garantias/:id/restituicao
   * Gera o requerimento PDF de restituição para uma garantia pronta para resgate.
   */
  async gerarOficioRestituicaoGarantia(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa ativa não localizada.' });
      }

      const contractGuarantee = await prisma.contractGuarantee.findFirst({
        where: { id: req.params.id, companyId: company.id },
        include: {
          contract: {
            select: { id: true, numeroContrato: true, orgao: true, status: true },
          },
        },
      });
      const legacyGuarantee = contractGuarantee
        ? null
        : await prisma.guarantee.findFirst({
            where: { id: req.params.id, companyId: company.id },
            include: {
              contract: {
                select: { id: true, numeroContrato: true, orgao: true, status: true },
              },
            },
          });
      const garantia = contractGuarantee ?? legacyGuarantee;

      if (!garantia) {
        return res.status(404).json({ success: false, message: 'Garantia não encontrada para esta empresa.' });
      }
      if (garantia.status !== 'PRONTA_RESGATE') {
        return res.status(409).json({
          success: false,
          message: 'O requerimento só pode ser gerado quando a garantia estiver pronta para resgate.',
        });
      }

      const referenciaLegal =
        garantia.tipoGarantia === 'PROPOSTA'
          ? 'Art. 58 da Lei nº 14.133/2021'
          : 'Arts. 96 e seguintes da Lei nº 14.133/2021';
      const valorGarantia = contractGuarantee
        ? Number(contractGuarantee.valorGarantido)
        : Number(legacyGuarantee?.valorOriginal ?? 0);
      const texto = [
        'REQUERIMENTO DE RESTITUIÇÃO DE GARANTIA',
        '',
        `À ${garantia.contract?.orgao || 'Administração Pública'}`,
        '',
        `Assunto: Solicitação de restituição de garantia ${garantia.tipoGarantia.toLowerCase()}.`,
        `Empresa: ${company.razaoSocial} — CNPJ ${company.cnpj}.`,
        garantia.contract?.numeroContrato
          ? `Contrato nº ${garantia.contract.numeroContrato}.`
          : 'Garantia vinculada à proposta/participação informada no cadastro.',
        `Modalidade: ${garantia.modalidade}.`,
        `Valor original da garantia: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorGarantia)}.`,
        '',
        `Com fundamento em ${referenciaLegal}, requer-se a análise e, estando cumpridas as condições legais e contratuais aplicáveis, a restituição/liberação da garantia acima identificada.`,
        '',
        'A presente minuta deve ser conferida e complementada pelo fornecedor antes do protocolo, inclusive quanto aos dados do processo e às condições previstas no edital e no contrato.',
        '',
        `Local e data: ${company.municipio || '________________'}, ${new Intl.DateTimeFormat('pt-BR').format(new Date())}.`,
        '',
        `${company.razaoSocial}`,
        `CNPJ ${company.cnpj}`,
      ].join('\n');
      const pdf = await gerarPdf(texto);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="restituicao_garantia_${nomeArquivoSeguro(garantia.id)}.pdf"`,
      );
      return res.send(pdf);
    } catch (error) {
      console.error('[ContratosController.gerarOficioRestituicaoGarantia] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar o requerimento de restituição da garantia.',
      });
    }
  }

  /**
   * POST /api/v1/contratos
   * Salva um novo contrato vinculado à empresa ativa (CNPJ) e gera seus prazos de vigência iniciais.
   */
  async criar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);
      if (!company) {
        return res.status(400).json({
          success: false,
          message: 'Nenhuma empresa ativa encontrada para vincular o contrato.',
        });
      }

      const {
        numeroContrato,
        processoAdministrativo,
        orgao,
        cnpjOrgao,
        uf,
        objeto,
        valorInicial,
        indiceReajuste,
        dataBaseProposta,
        dataBaseOrcamento,
        dataAssinatura,
        dataFim,
        dedicacaoExclusiva,
        predominanciaMaoDeObra,
        status,
        observacoes,
      } = req.body;

      if (!numeroContrato || !orgao || !objeto || valorInicial === undefined || !dataAssinatura || !dataFim) {
        return res.status(400).json({
          success: false,
          message: 'Preencha Número do Contrato, Órgão, Objeto, Valor Inicial, Data de Assinatura e Data de Fim.',
        });
      }

      const valorNumerico = Number(valorInicial);
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({
          success: false,
          message: 'O Valor Inicial do contrato deve ser maior que zero.',
        });
      }

      const dtAssinatura = new Date(dataAssinatura);
      const dtFim = new Date(dataFim);
      const dataBaseContrato = dataBaseProposta || dataBaseOrcamento;
      const dtBase = dataBaseContrato ? new Date(dataBaseContrato) : dtAssinatura;

      const dtAlerta60Dias = new Date(dtFim.getTime() - 60 * 24 * 60 * 60 * 1000);
      const dtAniversarioReajuste = new Date(dtBase.getTime() + 365 * 24 * 60 * 60 * 1000);

      const statusNormalizado =
        status === 'ENCERRADO' || status === 'SUSPENSO' || status === 'RESCINDIDO' || status === 'EM_RENOVACAO'
          ? status
          : 'ATIVO';

      const novoContrato = await prisma.contract.create({
        data: {
          companyId: company.id,
          cnpjEmpresa: company.cnpj,
          numeroContrato: String(numeroContrato).trim(),
          processoAdministrativo: processoAdministrativo ? String(processoAdministrativo).trim() : null,
          orgao: String(orgao).trim(),
          cnpjOrgao: cnpjOrgao ? String(cnpjOrgao).replace(/\D/g, '') : null,
          uf: uf ? String(uf).trim().toUpperCase().slice(0, 2) : company.uf,
          objeto: String(objeto).trim(),
          valorInicial: valorNumerico,
          valorAtual: valorNumerico,
          indiceReajuste: indiceReajuste ? String(indiceReajuste).trim().toUpperCase() : 'IPCA',
          dataBaseProposta: dtBase,
          dataAssinatura: dtAssinatura,
          dataInicioVigencia: dtAssinatura,
          dataFim: dtFim,
          isMaoDeObraExclusiva: dedicacaoExclusiva === true,
          predominanciaMaoDeObra: predominanciaMaoDeObra === true,
          status: statusNormalizado,
          observacoes: observacoes ? String(observacoes).trim() : null,
          prazosVigencia: {
            create: [
              {
                companyId: company.id,
                titulo: `Vigência Contratual — Contrato ${String(numeroContrato).trim()}`,
                tipoMarco: 'VIGENCIA',
                dataInicio: dtAssinatura,
                dataFim: dtFim,
                dataAlerta: dtAlerta60Dias,
                diasAntecedenciaAlerta: 60,
                status: 'PENDENTE',
                observacoes: 'Monitoramento automático de vencimento e prorrogação (Art. 107 da Lei 14.133/2021).',
              },
              {
                companyId: company.id,
                titulo: `Anualidade de Reajuste (${indiceReajuste || 'IPCA'}) — Art. 92, § 3º`,
                tipoMarco: 'REAJUSTE_ANUAL',
                dataInicio: dtBase,
                dataFim: dtAniversarioReajuste,
                dataAlerta: new Date(dtAniversarioReajuste.getTime() - 30 * 24 * 60 * 60 * 1000),
                diasAntecedenciaAlerta: 30,
                status: 'PENDENTE',
                observacoes: 'Data-base atingida para cobrança de reajuste por apostilamento (Art. 136, I da Lei 14.133/2021).',
              },
            ],
          },
        },
        include: {
          aditivos: true,
          prazosVigencia: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Contrato cadastrado com sucesso na Gestão Pós-Vitória.',
        data: novoContrato,
      });
    } catch (error) {
      console.error('[ContratosController.criar] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar contrato.',
      });
    }
  }

  /**
   * PATCH /api/v1/contratos/:id
   * Atualiza status ou dados de um contrato da empresa ativa.
   */
  async atualizar(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    const contractId = req.params.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa não encontrada.' });
      }

      const existing = await prisma.contract.findFirst({
        where: { id: contractId, companyId: company.id },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Contrato não encontrado para esta empresa.' });
      }

      const { status, dataFim, valorAtual, observacoes } = req.body;

      const updated = await prisma.contract.update({
        where: { id: existing.id },
        data: {
          ...(status ? { status } : {}),
          ...(dataFim ? { dataFim: new Date(dataFim) } : {}),
          ...(valorAtual !== undefined ? { valorAtual: Number(valorAtual) } : {}),
          ...(observacoes !== undefined ? { observacoes } : {}),
        },
      });

      return res.json({
        success: true,
        message: 'Contrato atualizado com sucesso.',
        data: updated,
      });
    } catch (error) {
      console.error('[ContratosController.atualizar] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao atualizar contrato.',
      });
    }
  }

  /**
   * POST /api/v1/contratos/:id/reajuste
   * Exclusivo Plano Master (protegido por requirePlanFeatureAccess('assistente_repactuacao')).
   * Calcula o reajuste/repactuação/reequilíbrio financeiro, gera o relatório técnico jurídico
   * fundamentado na Lei 14.133/2021 e opcionalmente registra o Termo Aditivo / Apostilamento.
   */
  async gerarRelatorioReajuste(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    const contractId = req.params.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa ativa não localizada.' });
      }

      const contrato = await prisma.contract.findFirst({
        where: { id: contractId, companyId: company.id },
      });

      if (!contrato) {
        return res.status(404).json({
          success: false,
          message: 'Contrato não localizado para a empresa ativa.',
        });
      }

      const {
        tipoPleito = 'REAJUSTE', // 'REAJUSTE' | 'REPACTUACAO' | 'REEQUILIBRIO'
        indiceUtilizado,
        percentualIndice,
        variacaoMaoDeObraPercentual,
        variacaoInsumosPercentual,
        pesoMaoDeObra = 60,
        mesesRetroativos = 1,
        justificativaFatica,
        registrarAditivo = false,
      } = req.body;

      const valorBase = Number(contrato.valorAtual);
      const indiceNome = String(indiceUtilizado || contrato.indiceReajuste || 'IPCA').toUpperCase();

      let percentualFinal = Number(percentualIndice);
      if (!Number.isFinite(percentualFinal) || percentualFinal <= 0) {
        if (tipoPleito === 'REPACTUACAO' && (variacaoMaoDeObraPercentual || variacaoInsumosPercentual)) {
          const vMao = Number(variacaoMaoDeObraPercentual || 0);
          const vIns = Number(variacaoInsumosPercentual || 0);
          const pMao = Math.min(Math.max(Number(pesoMaoDeObra) || 60, 0), 100) / 100;
          const pIns = 1 - pMao;
          percentualFinal = Number((vMao * pMao + vIns * pIns).toFixed(2));
        } else {
          percentualFinal = INDICES_OFICIAIS_PADRAO[indiceNome] ?? 4.62;
        }

      }

      const acrescimoGlobal = Number(((valorBase * percentualFinal) / 100).toFixed(2));
      const novoValorContrato = Number((valorBase + acrescimoGlobal).toFixed(2));
      const impactoMensalEstimado = Number((acrescimoGlobal / 12).toFixed(2));
      const valorRetroativoEstimado = Number(
        (impactoMensalEstimado * Math.max(Number(mesesRetroativos) || 1, 1)).toFixed(2),
      );

      const fundamentoLegal =
        tipoPleito === 'REPACTUACAO'
          ? 'Arts. 92, § 4º, 135 e 136 da Lei Federal nº 14.133/2021 (Repactuação de Custos de Mão de Obra / CCT)'
          : tipoPleito === 'REEQUILIBRIO'
            ? 'Art. 124, inciso II, alínea "d" da Lei Federal nº 14.133/2021 (Reequilíbrio Econômico-Financeiro por Fato Superveniente)'
            : `Arts. 25, § 7º, 92, § 3º e 136, inciso I da Lei Federal nº 14.133/2021 (Reajuste Anual por Apostilamento — Índice ${indiceNome})`;

      const moeda = (v: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

      const dataHoje = new Intl.DateTimeFormat('pt-BR').format(new Date());
      const dataBaseFormatada = new Intl.DateTimeFormat('pt-BR').format(
        contrato.dataBaseProposta || contrato.dataAssinatura,
      );

      const relatorioTexto = [
        `REQUERIMENTO TÉCNICO-JURÍDICO DE ${tipoPleito === 'REPACTUACAO' ? 'REPACTUAÇÃO CONTRATUAL' : tipoPleito === 'REEQUILIBRIO' ? 'REEQUILÍBRIO ECONÔMICO-FINANCEIRO' : 'REAJUSTE FINANCEIRO POR APOSTILAMENTO'}`,
        `================================================================================`,
        `ÓRGÃO CONTRATANTE: ${contrato.orgao}`,
        `CONTRATO ADMINISTRATIVO Nº: ${contrato.numeroContrato}`,
        contrato.processoAdministrativo ? `PROCESSO ADMINISTRATIVO: ${contrato.processoAdministrativo}` : null,
        `EMPRESA CONTRATADA: ${company.razaoSocial} (CNPJ: ${company.cnpj})`,
        `DATA-BASE DE ANUALIDADE: ${dataBaseFormatada}`,
        `FUNDAMENTO LEGAL: ${fundamentoLegal}`,
        ``,
        `1. DO OBJETO E DA TEMPESTIVIDADE DO PLEITO`,
        `Trata-se de requerimento formal relativo ao Contrato nº ${contrato.numeroContrato}, cujo objeto é "${contrato.objeto}".`,
        `Nos termos do Art. 92, § 3º da Lei nº 14.133/2021, o equilíbrio da equação econômico-financeira é direito constitucional do contratado (Art. 37, XXI da CF/88), contada a anualidade a partir da data-base do orçamento estimado ou da proposta (${dataBaseFormatada}).`,
        justificativaFatica ? `\nJustificativa Técnica Específica: ${justificativaFatica}` : null,
        ``,
        `2. DA MEMÓRIA DE CÁLCULO FINANCEIRA AUDITADA`,
        `• Valor Contratual Vigente (Base de Cálculo): ${moeda(valorBase)}`,
        `• Índice / Variação Aplicada (${indiceNome}): +${percentualFinal.toFixed(2)}%`,
        `• Acréscimo Anual / Global Apurado: +${moeda(acrescimoGlobal)}`,
        `• Novo Valor Global Atualizado do Contrato: ${moeda(novoValorContrato)}`,
        `• Impacto Mensal Médio: +${moeda(impactoMensalEstimado)}/mês`,
        `• Diferença Retroativa Estimada (${Math.max(Number(mesesRetroativos) || 1, 1)} mês/meses): ${moeda(valorRetroativoEstimado)}`,
        ``,
        `3. DO PEDIDO`,
        `Diante do exposto, requer-se à Administração Pública:`,
        `a) O deferimento integral do presente pleito de ${tipoPleito.toLowerCase()}, atualizando-se o valor do Contrato nº ${contrato.numeroContrato} de ${moeda(valorBase)} para ${moeda(novoValorContrato)};`,
        `b) O pagamento das diferenças retroativas apuradas no montante de ${moeda(valorRetroativoEstimado)}, contadas desde o implemento da anualidade;`,
        tipoPleito === 'REAJUSTE'
          ? `c) A formalização imediata mediante simples APOSTILAMENTO, dispensada a celebração de termo aditivo, conforme determina expressamente o Art. 136, inciso I da Lei nº 14.133/2021.`
          : `c) A formalização do respectivo Termo Aditivo / Apostilamento no prazo legal do Art. 123 e Art. 92, § 6º da Lei nº 14.133/2021.`,
        ``,
        `Local e Data: ${company.municipio || 'Brasil'}/${company.uf || 'BR'}, ${dataHoje}.`,
        `${company.razaoSocial} — CNPJ ${company.cnpj}`,
      ]
        .filter((line) => line !== null)
        .join('\n');

      let aditivoCriado = null;
      if (registrarAditivo) {
        const countAditivos = await prisma.contractAmendment.count({
          where: { contractId: contrato.id },
        });
        const numeroTermo =
          tipoPleito === 'REAJUSTE'
            ? `${countAditivos + 1}º Termo de Apostilamento (${indiceNome})`
            : `${countAditivos + 1}º Termo Aditivo (${tipoPleito})`;

        aditivoCriado = await prisma.$transaction(async (tx) => {
          const amendment = await tx.contractAmendment.create({
            data: {
              contractId: contrato.id,
              companyId: company.id,
              numeroTermo,
              tipo:
                tipoPleito === 'REPACTUACAO'
                  ? 'REPACTUACAO'
                  : tipoPleito === 'REEQUILIBRIO'
                    ? 'REEQUILIBRIO'
                    : 'REAJUSTE',
              fundamentoLegal,
              justificativa: justificativaFatica || `Aplicação de ${percentualFinal}% (${indiceNome})`,
              valorAlteracao: acrescimoGlobal,
              percentualAlteracao: percentualFinal,
              novoValorContrato,
              dataAssinatura: new Date(),
            },
          });

          await tx.contract.update({
            where: { id: contrato.id },
            data: {
              valorAtual: novoValorContrato,
            },
          });

          return amendment;
        });
      }

      return res.json({
        success: true,
        message: 'Relatório de reajuste e memória de cálculo gerados com sucesso.',
        data: {
          contractId: contrato.id,
          numeroContrato: contrato.numeroContrato,
          orgao: contrato.orgao,
          tipoPleito,
          indiceUtilizado: indiceNome,
          percentualAplicado: percentualFinal,
          valorAnterior: valorBase,
          acrescimoGlobal,
          novoValorContrato,
          impactoMensalEstimado,
          mesesRetroativos: Math.max(Number(mesesRetroativos) || 1, 1),
          valorRetroativoEstimado,
          impactoFinanceiroTotal: Number((acrescimoGlobal + valorRetroativoEstimado).toFixed(2)),
          fundamentoLegal,
          relatorioTexto,
          aditivoCriado,
          geradoEm: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[ContratosController.gerarRelatorioReajuste] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar relatório de reajuste financeiro.',
      });
    }
  }

  /**
   * POST /api/v1/contratos/:id/repactuacao/oficio
   * Gera PDF de memória estimativa da variação salarial informada para CCT/ACT.
   */
  async gerarOficioRepactuacao(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    }

    try {
      const company = await resolveAuthorizedCompany(userId, req.companyId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Empresa ativa não localizada.' });
      }

      const contrato = await prisma.contract.findFirst({
        where: { id: req.params.id, companyId: company.id },
      });
      if (!contrato) {
        return res.status(404).json({
          success: false,
          message: 'Contrato não localizado para a empresa ativa.',
        });
      }
      if (!contrato.isMaoDeObraExclusiva && !contrato.predominanciaMaoDeObra) {
        return res.status(422).json({
          success: false,
          message: 'A repactuação por CCT requer contrato classificado com dedicação exclusiva ou predominância de mão de obra.',
        });
      }

      const salarioAtual = Number(req.body?.salarioAtual);
      const novoSalario = Number(req.body?.novoSalario);
      const quantidadePostos = Number(req.body?.quantidadePostos);
      if (
        !Number.isFinite(salarioAtual) ||
        salarioAtual <= 0 ||
        !Number.isFinite(novoSalario) ||
        novoSalario <= 0 ||
        !Number.isInteger(quantidadePostos) ||
        quantidadePostos <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Informe salários válidos e uma quantidade inteira de postos maior que zero.',
        });
      }

      const formatarMoeda = (valor: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
      const diferencaSalarial = Number((novoSalario - salarioAtual).toFixed(2));
      const impactoMensal = Number((diferencaSalarial * quantidadePostos).toFixed(2));
      const impactoAnual = Number((impactoMensal * 12).toFixed(2));
      const texto = [
        'REQUERIMENTO DE REPACTUAÇÃO CONTRATUAL — MEMÓRIA ESTIMATIVA',
        '',
        `À ${contrato.orgao}`,
        `Contrato nº ${contrato.numeroContrato}.`,
        `Empresa: ${company.razaoSocial} — CNPJ ${company.cnpj}.`,
        `Objeto: ${contrato.objeto}`,
        '',
        'Com fundamento no art. 135 da Lei nº 14.133/2021 e na convenção/acordo coletivo aplicável, requer-se a análise da repactuação dos custos de mão de obra, observada a documentação comprobatória e as cláusulas contratuais.',
        '',
        'MEMÓRIA DE CÁLCULO ESTIMATIVA',
        `Salário atual informado por posto: ${formatarMoeda(salarioAtual)}.`,
        `Novo salário informado pela CCT/ACT: ${formatarMoeda(novoSalario)}.`,
        `Variação salarial por posto: ${formatarMoeda(diferencaSalarial)}.`,
        `Quantidade de postos: ${quantidadePostos}.`,
        `Impacto salarial mensal estimado: ${formatarMoeda(impactoMensal)}.`,
        `Impacto salarial anual estimado: ${formatarMoeda(impactoAnual)}.`,
        '',
        'Os valores são uma estimativa salarial bruta e não incluem encargos sociais, benefícios, tributos, insumos ou demais componentes da planilha de custos. Anexe a CCT/ACT e a planilha analítica atualizada antes do protocolo.',
        '',
        `Local e data: ${company.municipio || '________________'}, ${new Intl.DateTimeFormat('pt-BR').format(new Date())}.`,
        '',
        `${company.razaoSocial}`,
        `CNPJ ${company.cnpj}`,
      ].join('\n');
      const pdf = await gerarPdf(texto);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="repactuacao_contrato_${nomeArquivoSeguro(contrato.numeroContrato)}.pdf"`,
      );
      return res.send(pdf);
    } catch (error) {
      console.error('[ContratosController.gerarOficioRepactuacao] Erro:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar o ofício de repactuação.',
      });
    }
  }
}
