import { prisma } from '../database/prisma';
import {
  createProposalDraftSchema,
  createProposalItemSchema,
  type CreateProposalDraftInput,
  type CreateProposalItemInput,
  type UpdateProposalInput,
} from '../shared/validations/proposal.validation';
import { getPlanLimits } from './plans/plan.constants';
import { planGuardService } from './plans/plan-guard.service';

export class ProposalServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProposalServiceError';
  }
}

export interface ProposalComplianceReport {
  isCompliant: boolean;
  warnings: string[];
  errors: string[];
  declaracoesObrigatorias: {
    elaboracaoIndependente: boolean;
    habilitacaoCompleta: boolean;
    naoEmpregoMenor: boolean;
    inexistenciaImpedimento: boolean;
    reservaCargosPcd: boolean;
    meEpp: boolean;
  };
  validadeDias: number;
  validadeSuficiente: boolean; // >= 60 dias (Art. 90, § 3º)
  itensInexequiveis: number;
}

export class ProposalService {
  async createDraft(userId: string, rawInput: CreateProposalDraftInput) {
    const input = createProposalDraftSchema.parse(rawInput);
    const planId = await planGuardService.resolveUserPlan(userId);
    const proposalLimit = getPlanLimits(planId).maxProposalsMonth;

    return prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: {
          id: input.companyId,
          userId,
        },
        select: {
          id: true,
          tenantId: true,
        },
      });

      if (!company) {
        throw new ProposalServiceError(
          'company_not_found',
          404,
          'Empresa não encontrada para o usuário autenticado.',
        );
      }

      if (proposalLimit !== null) {
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);

        const proposalsCreatedThisMonth = await tx.proposal.count({
          where: {
            company: {
              tenantId: company.tenantId,
            },
            createdAt: {
              gte: monthStart,
            },
          },
        });

        if (proposalsCreatedThisMonth >= proposalLimit) {
          throw new ProposalServiceError(
            'proposal_monthly_limit_reached',
            403,
            `O plano ${planId} permite até ${proposalLimit} proposta(s) por mês.`,
          );
        }
      }

      if (
        input.responsibleUserId &&
        input.responsibleUserId !== userId
      ) {
        throw new ProposalServiceError(
          'invalid_responsible_user',
          403,
          'O responsável informado não pertence à conta autenticada.',
        );
      }

      if (input.procurementNoticeId) {
        const notice = await tx.procurementNotice.findUnique({
          where: {
            id: input.procurementNoticeId,
          },
          select: {
            id: true,
            tenantId: true,
          },
        });

        if (!notice) {
          throw new ProposalServiceError(
            'procurement_notice_not_found',
            404,
            'Edital não encontrado.',
          );
        }

        if (notice.tenantId && notice.tenantId !== company.tenantId) {
          throw new ProposalServiceError(
            'procurement_notice_forbidden',
            403,
            'O edital informado não pertence ao ambiente da empresa.',
          );
        }
      }

      const validadeDias = input.validadeDias ?? 60;

      return tx.proposal.create({
        data: {
          companyId: company.id,
          procurementNoticeId: input.procurementNoticeId ?? null,
          titulo: input.titulo,
          status: 'RASCUNHO',
          moeda: input.moeda,
          validadeDias,
          validadeAte: input.validadeAte
            ? new Date(input.validadeAte)
            : null,
          prazoEntregaDias: input.prazoEntregaDias ?? null,
          condicoesPagamento: input.condicoesPagamento ?? null,
          garantia: input.garantia ?? null,
          observacoes: input.observacoes ?? null,
          criterioJulgamento: input.criterioJulgamento ?? null,
          bdiGeral: input.bdiGeral !== undefined && input.bdiGeral !== null ? input.bdiGeral : null,
          encargosSociais: input.encargosSociais !== undefined && input.encargosSociais !== null ? input.encargosSociais : null,
          margemMinimaSustentavel: input.margemMinimaSustentavel !== undefined && input.margemMinimaSustentavel !== null ? input.margemMinimaSustentavel : null,
          declaracaoIndependente: input.declaracaoIndependente ?? false,
          declaracaoHabilitacao: input.declaracaoHabilitacao ?? false,
          declaracaoMenor: input.declaracaoMenor ?? false,
          declaracaoMeEpp: input.declaracaoMeEpp ?? false,
          declaracaoInidoneidade: input.declaracaoInidoneidade ?? false,
          declaracaoAcessibilidade: input.declaracaoAcessibilidade ?? false,
          createdById: userId,
          responsibleUserId: input.responsibleUserId ?? userId,
        },
      });
    }, {
      isolationLevel: 'Serializable',
    });
  }

  async addItem(userId: string, proposalId: string, rawItemInput: CreateProposalItemInput) {
    const itemInput = createProposalItemSchema.parse(rawItemInput);

    return prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findUnique({
        where: { id: proposalId },
        include: {
          company: true,
          procurementNotice: true,
          items: true,
        },
      });

      if (!proposal) {
        throw new ProposalServiceError('proposal_not_found', 404, 'Proposta não encontrada.');
      }

      if (proposal.company.userId !== userId && proposal.createdById !== userId) {
        throw new ProposalServiceError('access_denied', 403, 'Acesso negado à proposta.');
      }

      const nextPosicao = proposal.items.length + 1;
      const custoDireto = itemInput.custoDireto ?? itemInput.custoUnitario ?? null;
      const custoIndireto = itemInput.custoIndireto ?? null;
      const custoBase = custoDireto === null && custoIndireto === null
        ? null
        : (custoDireto ?? 0) + (custoIndireto ?? 0);

      const bdi = itemInput.bdiPercentual ?? (proposal.bdiGeral ? Number(proposal.bdiGeral) : 0);
      const margemLucro = itemInput.margemLucroPercentual ?? (proposal.margemMinimaSustentavel ? Number(proposal.margemMinimaSustentavel) : 0);

      const precoUnitarioInformado = itemInput.precoUnitarioProposto ?? itemInput.valorUnitario;
      const precoUnitario = precoUnitarioInformado !== undefined && precoUnitarioInformado !== null
        ? precoUnitarioInformado
        : custoBase !== null && custoBase > 0
          ? Number((custoBase * (1 + (bdi / 100)) * (1 + (margemLucro / 100))).toFixed(4))
          : null;

      const precoTotal = precoUnitario === null
        ? null
        : Number((precoUnitario * itemInput.quantidade).toFixed(2));

      // Verificação de Inexequibilidade (Art. 59, III da Lei 14.133/2021)
      let inexequivel = false;
      if (custoBase !== null && custoBase > 0 && precoUnitario !== null && precoUnitario <= custoBase) {
        inexequivel = true;
      }

      const createdItem = await tx.proposalItem.create({
        data: {
          proposalId: proposal.id,
          posicao: nextPosicao,
          numero: itemInput.numero ?? (itemInput.numeroItem !== undefined && itemInput.numeroItem !== null ? String(itemInput.numeroItem) : String(nextPosicao)),
          codigo: itemInput.codigo ?? null,
          descricao: itemInput.descricao,
          unidade: itemInput.unidade,
          quantidade: itemInput.quantidade,
          marca: itemInput.marca ?? null,
          modelo: itemInput.modelo ?? null,
          custoUnitario: itemInput.custoUnitario ?? custoDireto,
          custoDireto,
          custoIndireto,
          tributosPercentual: itemInput.tributosPercentual ?? null,
          encargosPercentual: itemInput.encargosPercentual ?? (proposal.encargosSociais ? Number(proposal.encargosSociais) : null),
          bdiPercentual: bdi,
          margemLucroPercentual: margemLucro,
          descontoPercentual: itemInput.descontoPercentual ?? null,
          precoUnitarioProposto: precoUnitario,
          precoTotalProposto: precoTotal,
          inexequivel,
          prazoGarantiaMeses: itemInput.prazoGarantiaMeses ?? 12,
          observacoes: itemInput.observacoes ?? null,
        },
      });

      // Recalcula valor total da proposta
      const allItems = [...proposal.items, createdItem];
      const novoTotal = allItems.every((item) => item.precoTotalProposto !== null)
        ? allItems.reduce((acc, curr) => acc + Number(curr.precoTotalProposto), 0)
        : null;

      await tx.proposal.update({
        where: { id: proposalId },
        data: { valorTotalProposto: novoTotal },
      });

      return createdItem;
    });
  }

  async validateCompliance(userId: string, proposalId: string): Promise<ProposalComplianceReport> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        company: true,
        procurementNotice: true,
        items: true,
      },
    });

    if (!proposal) {
      throw new ProposalServiceError('proposal_not_found', 404, 'Proposta não encontrada.');
    }

    if (proposal.company.userId !== userId && proposal.createdById !== userId) {
      throw new ProposalServiceError('access_denied', 403, 'Acesso negado à proposta.');
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    const validadeDias = proposal.validadeDias ?? 0;
    const validadeSuficiente = validadeDias >= 60;

    if (!validadeSuficiente) {
      warnings.push(`O prazo de validade da proposta (${validadeDias} dias) é inferior ao padrão legal de 60 dias corridos previsto no Art. 90, § 3º da Lei 14.133/2021.`);
    }

    if (!proposal.declaracaoIndependente) {
      errors.push('A Declaração de Elaboração Independente de Proposta (Art. 63, I da Lei 14.133/21) é obrigatória.');
    }
    if (!proposal.declaracaoHabilitacao) {
      errors.push('A Declaração de Cumprimento dos Requisitos de Habilitação (Art. 63, I da Lei 14.133/21) é obrigatória.');
    }
    if (!proposal.declaracaoMenor) {
      errors.push('A Declaração de Cumprimento do Art. 7º, XXXIII da CF (proibição de trabalho noturno/perigoso a menor) é obrigatória.');
    }
    if (!proposal.declaracaoInidoneidade) {
      errors.push('A Declaração de Inexistência de Impedimento ou Inidoneidade (Art. 14 da Lei 14.133/21) é obrigatória.');
    }

    if (!proposal.procurementNotice) {
      errors.push('Vincule um edital à proposta para preencher corretamente o órgão, o objeto e os dados do certame.');
    }

    if (proposal.items.length === 0) {
      errors.push('A proposta não possui nenhum item cadastrado na planilha orçamentária.');
    }

    let inexequiveisCount = 0;
    for (const item of proposal.items) {
      if (item.precoUnitarioProposto === null || item.precoTotalProposto === null) {
        errors.push(`Item ${item.posicao} (${item.descricao}): informe o preço unitário antes de gerar o documento.`);
      }

      const custoInformado = item.custoDireto ?? item.custoUnitario;
      if (custoInformado === null) {
        warnings.push(`Item ${item.posicao} (${item.descricao}): custo não informado; não é possível avaliar a margem real.`);
      }

      const custo = Number(custoInformado) || 0;
      const preco = Number(item.precoUnitarioProposto) || 0;
      const isInex = item.inexequivel || (custo > 0 && preco <= custo);
      if (isInex) {
        inexequiveisCount++;
        warnings.push(`Item ${item.posicao} (${item.descricao}): Alerta de inexequibilidade (Art. 59, III da Lei 14.133/2021). O preço unitário proposto (R$ ${preco.toFixed(2)}) é inferior ou igual aos custos diretos calculados.`);
      }
    }

    return {
      isCompliant: errors.length === 0,
      warnings,
      errors,
      declaracoesObrigatorias: {
        elaboracaoIndependente: proposal.declaracaoIndependente,
        habilitacaoCompleta: proposal.declaracaoHabilitacao,
        naoEmpregoMenor: proposal.declaracaoMenor,
        inexistenciaImpedimento: proposal.declaracaoInidoneidade,
        reservaCargosPcd: proposal.declaracaoAcessibilidade,
        meEpp: proposal.declaracaoMeEpp,
      },
      validadeDias,
      validadeSuficiente,
      itensInexequiveis: inexequiveisCount,
    };
  }

  async generateOfficialProposalDocument(userId: string, proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        company: true,
        procurementNotice: true,
        items: {
          orderBy: { posicao: 'asc' },
        },
        createdBy: true,
      },
    });

    if (!proposal) {
      throw new ProposalServiceError('proposal_not_found', 404, 'Proposta não encontrada.');
    }

    if (proposal.company.userId !== userId && proposal.createdById !== userId) {
      throw new ProposalServiceError('access_denied', 403, 'Acesso negado à proposta.');
    }

    const compliance = await this.validateCompliance(userId, proposalId);

    if (!compliance.isCompliant) {
      throw new ProposalServiceError(
        'proposal_not_compliant',
        422,
        `Não é possível gerar o documento: ${compliance.errors.join(' ')}`,
      );
    }

    // Trava de Segurança Legal (Art. 59, III da Lei 14.133/21)
    const itensInexequiveis = proposal.items.filter(it => {
      const custo = Number(it.custoDireto || it.custoUnitario) || 0;
      const preco = Number(it.precoUnitarioProposto) || 0;
      return it.inexequivel || (custo > 0 && preco <= custo);
    });
    if (itensInexequiveis.length > 0) {
      throw new ProposalServiceError(
        'proposal_price_below_cost',
        422,
        `Não é possível gerar o documento: ${itensInexequiveis.length} item(ns) possuem preço unitário abaixo ou igual ao custo informado.`,
      );
    }

    const now = new Date();
    const dataEmissaoExtenso = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const totalCalculado = proposal.items.reduce(
      (acc, it) => acc + (Number(it.precoTotalProposto) || 0),
      0,
    );

    const formatCurrency = (val: number | null | undefined) => {
      const num = Number(val) || 0;
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Montagem do Documento Oficial Lei 14.133/2021
    const lines: string[] = [];

    lines.push('================================================================================');
    lines.push('                     PROPOSTA COMERCIAL E PLANILHA DE PREÇOS                    ');
    lines.push('                      ADEQUADA À LEI FEDERAL Nº 14.133/2021                     ');
    lines.push('================================================================================\n');

    lines.push('1. IDENTIFICAÇÃO DO PROPONENTE');
    lines.push(`Razão Social: ${proposal.company.razaoSocial}`);
    lines.push(`CNPJ: ${proposal.company.cnpj}`);
    if (proposal.company.nomeFantasia) lines.push(`Nome Fantasia: ${proposal.company.nomeFantasia}`);
    lines.push(`Localização: ${[proposal.company.municipio, proposal.company.uf].filter(Boolean).join(' - ') || 'N/A'}`);
    lines.push(`Enquadramento Legal: ${proposal.declaracaoMeEpp ? 'Microempresa ou Empresa de Pequeno Porte (LC 123/06)' : 'Ampla Concorrência'}`);
    lines.push(`Responsável Legal: ${proposal.createdBy.nome || 'Representante Autorizado'}\n`);

    lines.push('2. IDENTIFICAÇÃO DO ÓRGÃO E DO CERTAME PÚBLICO');
    if (proposal.procurementNotice) {
      lines.push(`Órgão Licitante: ${proposal.procurementNotice.buyerName || 'Órgão Público'}`);
      if (proposal.procurementNotice.buyerDocument) lines.push(`CNPJ do Órgão: ${proposal.procurementNotice.buyerDocument}`);
      lines.push(`Processo Administrativo nº: ${proposal.procurementNotice.processoAdministrativo || proposal.procurementNotice.noticeNumber || 'Conforme Edital'}`);
      lines.push(`Edital / Aviso nº: ${proposal.procurementNotice.noticeNumber || 'S/N'}`);
      lines.push(`Modalidade: ${proposal.procurementNotice.modality || 'Pregão Eletrônico (Lei 14.133/2021)'}`);
      lines.push(`Amparo Legal: ${proposal.procurementNotice.amparoLegal || 'Lei Federal nº 14.133/2021'}`);
      lines.push(`Critério de Julgamento: ${proposal.criterioJulgamento ? proposal.criterioJulgamento.replace('_', ' ').toUpperCase() : 'Menor Preço / Maior Desconto'}`);
      lines.push(`Objeto Licitado: ${proposal.procurementNotice.object}`);
    } else {
      lines.push(`Referência: ${proposal.titulo}`);
      lines.push('Certame: Edital cadastrado diretamente pelo proponente sob a égide da Lei 14.133/2021.');
    }
    lines.push('');

    lines.push('3. PLANILHA DE PREÇOS UNITÁRIOS E TOTAIS (ART. 59, LEI 14.133/2021)');
    lines.push('--------------------------------------------------------------------------------');
    lines.push('| Item | Descrição / Especificação | Marca/Mod. | Qtd | Unid | Preço Unit. | Total Proposto |');
    lines.push('--------------------------------------------------------------------------------');

    if (proposal.items.length === 0) {
      lines.push('| (Nenhum item adicionado à planilha orçamentária até o momento)               |');
    } else {
      for (const item of proposal.items) {
        const desc = item.descricao.length > 25 ? `${item.descricao.slice(0, 22)}...` : item.descricao.padEnd(25);
        const marca = ([item.marca, item.modelo].filter(Boolean).join(' ') || 'Conforme Edital').slice(0, 10).padEnd(10);
        const qtd = String(Number(item.quantidade)).padStart(4);
        const unit = item.unidade.slice(0, 4).padEnd(4);
        const pUnit = formatCurrency(Number(item.precoUnitarioProposto)).padStart(12);
        const pTotal = formatCurrency(Number(item.precoTotalProposto)).padStart(14);
        lines.push(`| ${String(item.posicao).padStart(4)} | ${desc} | ${marca} | ${qtd} | ${unit} | ${pUnit} | ${pTotal} |`);
      }
    }
    lines.push('--------------------------------------------------------------------------------');
    lines.push(`VALOR TOTAL PROPOSTO: ${formatCurrency(totalCalculado)}`);
    if (proposal.bdiGeral) lines.push(`B.D.I. Geral Aplicado: ${Number(proposal.bdiGeral).toFixed(2)}% (Acórdão 2.622/2013-TCU)`);
    if (proposal.encargosSociais) lines.push(`Encargos Sociais Previstos: ${Number(proposal.encargosSociais).toFixed(2)}%`);
    lines.push('');

    lines.push('4. CONDIÇÕES GERAIS DE FORNECIMENTO E EXECUÇÃO (ART. 90 E 92, LEI 14.133/2021)');
    lines.push(`- Prazo de Validade da Proposta: ${proposal.validadeDias || 60} (sessenta) dias corridos, contados da data limite de envio.`);
    lines.push(`- Prazo de Entrega / Execução: ${proposal.prazoEntregaDias ? `${proposal.prazoEntregaDias} dias corridos` : 'Imediato, conforme estipulado no Termo de Referência.'}`);
    lines.push(`- Condições de Pagamento: ${proposal.condicoesPagamento || 'Até 30 dias após liquidação e ateste de nota fiscal, conforme Art. 92, VI da Lei 14.133/2021.'}`);
    lines.push(`- Garantia Oferecida: ${proposal.garantia || 'Garantia legal de 12 meses contra defeitos de fabricação ou vícios redibitórios.'}`);
    if (proposal.observacoes) lines.push(`- Observações Complementares: ${proposal.observacoes}`);
    lines.push('');

    lines.push('5. AS 6 DECLARAÇÕES OFICIAIS OBRIGATÓRIAS (ART. 63 DA LEI 14.133/2021 E TCU)');
    lines.push('Sob as penas da lei e em estrito cumprimento às exigências editalícias e legais da Nova Lei de Licitações:');
    lines.push('1) DECLARAÇÃO DE PLENO CUMPRIMENTO DOS REQUISITOS DE HABILITAÇÃO: Declaramos cumprir plenamente todos os requisitos de habilitação técnica, jurídica, fiscal e econômico-financeira fixados no Edital (Art. 63, I da Lei 14.133/2021).');
    lines.push('2) DECLARAÇÃO DE ELABORAÇÃO INDEPENDENTE DE PROPOSTA: Declaramos que a presente proposta foi elaborada de maneira estritamente independente, sem conluio, ajuste prévio ou compartilhamento de preços com quaisquer outros licitantes concorrentes (Art. 63, I da Lei 14.133/2021).');
    lines.push('3) DECLARAÇÃO DO TRABALHO DE MENOR (ART. 7º, XXXIII DA CF/88): Declaramos não empregar menor de dezoito anos em trabalho noturno, perigoso ou insalubre e não empregar menor de dezesseis anos, salvo na condição de aprendiz a partir dos quatorze anos (Art. 63, VI da Lei 14.133/2021).');
    lines.push('4) DECLARAÇÃO DE INEXISTÊNCIA DE FATOS IMPEDITIVOS: Declaramos inexistir qualquer fato superveniente que impeça nossa participação no certame, não incorrendo nas vedações do Art. 14 da Lei 14.133/2021 (inidoneidade, suspensão ou impedimento).');
    lines.push('5) DECLARAÇÃO DE RESERVA DE CARGOS PCD E REABILITADOS: Declaramos atender às regras de acessibilidade e cumprir as reservas de cargos legalmente previstas para pessoa com deficiência e para reabilitado da Previdência Social (Art. 63, IV da Lei 14.133/2021).');
    if (proposal.declaracaoMeEpp) {
      lines.push('6) DECLARAÇÃO DE ENQUADRAMENTO COMO ME/EPP: Declaramos sob as penas do Art. 299 do Código Penal que preenchemos os requisitos de Microempresa ou Empresa de Pequeno Porte (LC 123/2006 c/c Art. 4º da Lei 14.133/2021), não estando enquadrados em nenhuma das vedações do §4º do Art. 3º da LC 123/2006.');
    } else {
      lines.push('6) DECLARAÇÃO DE SUSTENTABILIDADE E CRITÉRIOS AMBIENTAIS: Declaramos pleno atendimento aos critérios e padrões de sustentabilidade ambiental, logística reversa e descarte adequado exigidos na contratação (Art. 11, IV e Art. 63 da Lei 14.133/2021).');
    }
    lines.push('');

    lines.push('6. COMPROMISSO DE FORNECIMENTO E FECHAMENTO');
    lines.push('Declaramos que nos preços propostos estão inclusos todos os custos diretos, indiretos, tributos, taxas, frete, BDI e encargos sociais e trabalhistas incidentes.');
    lines.push('');
    lines.push(`${[proposal.company.municipio, proposal.company.uf].filter(Boolean).join(' - ') || 'Brasília - DF'}, ${dataEmissaoExtenso}.`);
    lines.push('\n\n___________________________________________________________');
    lines.push(`${proposal.company.razaoSocial}`);
    lines.push(`CNPJ: ${proposal.company.cnpj}`);
    lines.push(`Representante: ${proposal.createdBy.nome || 'Representante Legal Autorizado'}`);

    const documentText = lines.join('\n');

    // Salva o texto formatado no registro da proposta
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        propostaFormatadaText: documentText,
        valorTotalProposto: totalCalculado,
      },
    });

    return {
      proposalId,
      document: documentText,
      compliance,
      valorTotal: totalCalculado,
    };
  }

  async getById(userId: string, proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        company: true,
        items: true,
        procurementNotice: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!proposal || proposal.company.userId !== userId) {
      throw new ProposalServiceError('proposal_not_found', 404, 'Proposta não encontrada.');
    }

    return proposal;
  }

  async list(userId: string, query?: { companyId?: string }) {
    const companies = await prisma.company.findMany({
      where: { userId },
      select: { id: true },
    });
    const companyIds = companies.map((c) => c.id);

    if (query?.companyId) {
      if (!companyIds.includes(query.companyId)) {
        throw new ProposalServiceError(
          'company_forbidden',
          403,
          'Você não tem permissão para acessar propostas desta empresa.',
        );
      }
    }

    return prisma.proposal.findMany({
      where: {
        companyId: query?.companyId ? query.companyId : { in: companyIds },
      },
      include: {
        company: true,
        procurementNotice: true,
        items: {
          orderBy: { posicao: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProposal(
    userId: string,
    proposalId: string,
    input: UpdateProposalInput,
  ) {
    const proposal = await this.getById(userId, proposalId);

    const dataToUpdate: any = {};
    if (typeof input.titulo === 'string' && input.titulo.trim()) {
      dataToUpdate.titulo = input.titulo.trim();
    }
    if (input.validadeDias !== undefined) {
      dataToUpdate.validadeDias = input.validadeDias;
    }
    if (input.prazoEntregaDias !== undefined) {
      dataToUpdate.prazoEntregaDias = input.prazoEntregaDias;
    }
    if (input.garantia !== undefined) {
      dataToUpdate.garantia = input.garantia;
    }
    if (input.condicoesPagamento !== undefined) {
      dataToUpdate.condicoesPagamento = input.condicoesPagamento;
    }
    if (input.declaracaoIndependente !== undefined) dataToUpdate.declaracaoIndependente = input.declaracaoIndependente;
    if (input.declaracaoHabilitacao !== undefined) dataToUpdate.declaracaoHabilitacao = input.declaracaoHabilitacao;
    if (input.declaracaoMenor !== undefined) dataToUpdate.declaracaoMenor = input.declaracaoMenor;
    if (input.declaracaoMeEpp !== undefined) dataToUpdate.declaracaoMeEpp = input.declaracaoMeEpp;
    if (input.declaracaoInidoneidade !== undefined) dataToUpdate.declaracaoInidoneidade = input.declaracaoInidoneidade;
    if (input.declaracaoAcessibilidade !== undefined) dataToUpdate.declaracaoAcessibilidade = input.declaracaoAcessibilidade;

    return prisma.proposal.update({
      where: { id: proposal.id },
      data: dataToUpdate,
      include: {
        company: true,
        procurementNotice: true,
        items: {
          orderBy: { posicao: 'asc' },
        },
      },
    });
  }

  async updateItem(
    userId: string,
    proposalId: string,
    itemId: string,
    input: {
      posicao?: number;
      numero?: string;
      description?: string;
      descricao?: string;
      quantity?: number;
      quantidade?: number;
      unit?: string | null;
      unidade?: string | null;
      unitCost?: number | null;
      custoDireto?: number | null;
      encargosPercentual?: number | null;
      bdiPercentual?: number | null;
      marginPercent?: number | null;
      margemLucroPercentual?: number | null;
      proposedPrice?: number | null;
      precoUnitarioProposto?: number | null;
      marca?: string | null;
      modelo?: string | null;
      prazoGarantiaMeses?: number | null;
    },
  ) {
    const proposal = await this.getById(userId, proposalId);
    const existingItem = proposal.items.find((item) => item.id === itemId);

    if (!existingItem) {
      throw new ProposalServiceError('proposal_item_not_found', 404, 'Item da proposta não encontrado.');
    }

    const rawQty = input.quantidade ?? input.quantity;
    const quantidade = rawQty != null ? Number(rawQty) : Number(existingItem.quantidade ?? 1);

    const rawCost = input.custoDireto !== undefined ? input.custoDireto : input.unitCost;
    const custoDireto =
      rawCost !== undefined
        ? rawCost != null
          ? Number(rawCost)
          : null
        : existingItem.custoDireto != null
          ? Number(existingItem.custoDireto)
          : null;

    const rawMargin = input.margemLucroPercentual !== undefined
      ? input.margemLucroPercentual
      : input.marginPercent;
    const margemLucroPercentual =
      rawMargin !== undefined
        ? rawMargin != null
          ? Number(rawMargin)
          : null
        : existingItem.margemLucroPercentual != null
          ? Number(existingItem.margemLucroPercentual)
          : null;

    const rawEncargos = input.encargosPercentual !== undefined
      ? input.encargosPercentual
      : input.bdiPercentual;
    const encargosPercentual =
      rawEncargos !== undefined
        ? rawEncargos != null
          ? Number(rawEncargos)
          : null
        : existingItem.encargosPercentual != null
          ? Number(existingItem.encargosPercentual)
          : existingItem.bdiPercentual != null
            ? Number(existingItem.bdiPercentual)
            : null;

    const rawProposed = input.precoUnitarioProposto !== undefined
      ? input.precoUnitarioProposto
      : input.proposedPrice;
    let precoUnitarioProposto =
      rawProposed !== undefined
        ? rawProposed === null ? null : Number(rawProposed)
        : existingItem.precoUnitarioProposto == null
          ? null
          : Number(existingItem.precoUnitarioProposto);

    if (rawProposed === undefined && custoDireto !== null && custoDireto > 0) {
      precoUnitarioProposto = Number(
        (
          custoDireto
          * (1 + (encargosPercentual ?? 0) / 100)
          * (1 + (margemLucroPercentual ?? 0) / 100)
        ).toFixed(2),
      );
    }

    const precoTotalProposto = precoUnitarioProposto === null
      ? null
      : Number((precoUnitarioProposto * quantidade).toFixed(2));
    const inexequivel = custoDireto !== null
      && custoDireto > 0
      && precoUnitarioProposto !== null
      && precoUnitarioProposto <= custoDireto;
    const descricao = input.descricao ?? input.description ?? existingItem.descricao;
    const unidade = input.unidade ?? input.unit ?? existingItem.unidade;

    const updatedItem = await prisma.proposalItem.update({
      where: { id: existingItem.id },
      data: {
        posicao: input.posicao != null ? Number(input.posicao) : existingItem.posicao,
        numero: typeof input.numero === 'string' ? input.numero : existingItem.numero,
        descricao,
        quantidade,
        unidade: unidade || 'UN',
        custoDireto,
        custoUnitario: custoDireto,
        encargosPercentual,
        bdiPercentual: encargosPercentual,
        margemLucroPercentual,
        precoUnitarioProposto,
        precoTotalProposto,
        inexequivel,
        marca: input.marca !== undefined ? input.marca : existingItem.marca,
        modelo: input.modelo !== undefined ? input.modelo : existingItem.modelo,
        prazoGarantiaMeses:
          input.prazoGarantiaMeses !== undefined
            ? input.prazoGarantiaMeses != null
              ? Number(input.prazoGarantiaMeses)
              : null
            : existingItem.prazoGarantiaMeses,
      },
    });

    await this.recalculateProposalTotal(proposal.id);
    return updatedItem;
  }

  async removeItem(userId: string, proposalId: string, itemId: string) {
    const proposal = await this.getById(userId, proposalId);
    const existingItem = proposal.items.find((item) => item.id === itemId);

    if (!existingItem) {
      throw new ProposalServiceError('proposal_item_not_found', 404, 'Item da proposta não encontrado.');
    }

    await prisma.proposalItem.delete({
      where: { id: existingItem.id },
    });

    await this.recalculateProposalTotal(proposal.id);
    return { deleted: true, id: itemId };
  }

  private async recalculateProposalTotal(proposalId: string) {
    const items = await prisma.proposalItem.findMany({
      where: { proposalId },
    });

    const total = items.every((item) => item.precoTotalProposto !== null)
      ? items.reduce((acc, item) => acc + Number(item.precoTotalProposto), 0)
      : null;

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { valorTotalProposto: total === null ? null : Number(total.toFixed(2)) },
    });
  }

  calcularPrecificacao(rawInput: {
    custoDireto?: number;
    tributosPercentual?: number;
    valorReferenciaEdital?: number;
    precoOfertado?: number;
  }) {
    const custoDireto = Math.max(0, Number(rawInput?.custoDireto ?? 0) || 0);
    const tributosPercentual = Math.max(0, Number(rawInput?.tributosPercentual ?? 0) || 0);
    const valorReferenciaEdital = Math.max(0, Number(rawInput?.valorReferenciaEdital ?? 0) || 0);

    const custoBase = Number((custoDireto * (1 + tributosPercentual / 100)).toFixed(2));
    const precoMinimo = Number((custoBase * 1.10).toFixed(2));
    const precoCompetitivo = Number((custoBase * 1.25).toFixed(2));
    const precoTeto = Number(valorReferenciaEdital.toFixed(2));

    const precoOfertado =
      rawInput?.precoOfertado !== undefined &&
      rawInput?.precoOfertado !== null &&
      !Number.isNaN(Number(rawInput.precoOfertado))
        ? Number(rawInput.precoOfertado)
        : valorReferenciaEdital > 0
          ? valorReferenciaEdital
          : precoMinimo;

    const statusExequibilidade =
      precoOfertado >= custoBase
        ? 'Exequível (Sinal Verde)'
        : 'Risco de Inexequibilidade (Sinal Vermelho)';

    return {
      custoBase,
      precoMinimo,
      precoCompetitivo,
      precoTeto,
      statusExequibilidade,
    };
  }
}

export const proposalService = new ProposalService();
