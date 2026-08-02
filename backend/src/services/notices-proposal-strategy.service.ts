import { NoticesErrorRadarService } from './notices-error-radar.service';
import { NoticesOpportunityScoreService } from './notices-opportunity-score.service';
import { type NoticesUserContext } from './notices-search.service';

type ProposalStrategyMode = 'conservadora' | 'moderada' | 'agressiva';

interface ProposalStrategyResult {
  noticeId: string;
  generatedAt: string;
  estrategia: ProposalStrategyMode;
  score: {
    valor: number;
    nivel: string;
  };
  orientacoes: string[];
  checklist: string[];
  riscos: string[];
  proximosPassos: string[];
  observacao: string;
}

export class NoticesProposalStrategyService {
  constructor(
    private readonly opportunityScore = new NoticesOpportunityScoreService(),
    private readonly errorRadar = new NoticesErrorRadarService(),
  ) {}

  async buildStrategy(
    noticeId: string,
    input: unknown = {},
    context: NoticesUserContext = {},
  ): Promise<ProposalStrategyResult | null> {
    const score = await this.opportunityScore.scoreNotice(noticeId, input, context);

    if (!score) {
      return null;
    }

    const radar = await this.errorRadar
      .analyzeNotice(noticeId, context)
      .catch(() => null);

    const issues = Array.isArray(radar?.issues) ? radar.issues : [];
    const highIssues = issues.filter((issue: any) => issue.severity === 'high');
    const mediumIssues = issues.filter((issue: any) => issue.severity === 'medium');

    const estrategia = definirEstrategia(score.score, highIssues.length, mediumIssues.length);

    const riscos = [
      ...score.riscos,
      ...highIssues.map((issue: any) => `Ponto crítico no edital: ${issue.title}`),
      ...mediumIssues.map((issue: any) => `Ponto de atenção no edital: ${issue.title}`),
    ];

    return {
      noticeId,
      generatedAt: new Date().toISOString(),
      estrategia,
      score: {
        valor: score.score,
        nivel: score.nivel,
      },
      orientacoes: montarOrientacoes(estrategia, score.score, riscos),
      checklist: montarChecklist(issues),
      riscos: Array.from(new Set(riscos)),
      proximosPassos: montarProximosPassos(estrategia, issues),
      observacao:
        'Esta estratégia é uma orientação operacional inicial baseada no perfil da empresa, dados do edital, score de oportunidade e radar de erros. Não substitui a revisão técnica, jurídica, contábil ou comercial antes do envio da proposta.',
    };
  }
}

function definirEstrategia(score: number, highIssues: number, mediumIssues: number): ProposalStrategyMode {
  if (score >= 80 && highIssues === 0 && mediumIssues <= 1) {
    return 'agressiva';
  }

  if (score >= 55 && highIssues <= 1) {
    return 'moderada';
  }

  return 'conservadora';
}

function montarOrientacoes(
  estrategia: ProposalStrategyMode,
  score: number,
  riscos: string[],
) {
  const orientacoes: string[] = [];

  if (estrategia === 'agressiva') {
    orientacoes.push('Priorizar participação, pois o edital apresenta boa aderência ao perfil da empresa.');
    orientacoes.push('Preparar proposta competitiva, observando margem mínima segura e capacidade de execução.');
    orientacoes.push('Organizar documentação imediatamente para evitar perda de prazo operacional.');
  }

  if (estrategia === 'moderada') {
    orientacoes.push('Participar com cautela, validando riscos antes de fechar preço e documentação.');
    orientacoes.push('Montar proposta apenas após conferência de exigências técnicas, fiscais e comerciais.');
    orientacoes.push('Separar dúvidas para eventual pedido de esclarecimento antes do prazo limite.');
  }

  if (estrategia === 'conservadora') {
    orientacoes.push('Evitar proposta agressiva antes de revisar todos os riscos do edital.');
    orientacoes.push('Validar margem, capacidade operacional e documentos obrigatórios antes de decidir participar.');
    orientacoes.push('Considerar pedido de esclarecimento ou impugnação se houver cláusulas restritivas relevantes.');
  }

  if (score < 50) {
    orientacoes.push('O score indica baixa aderência inicial. Participar apenas com justificativa comercial clara.');
  }

  if (riscos.length > 0) {
    orientacoes.push('Não enviar proposta sem tratar os riscos apontados na análise.');
  }

  return Array.from(new Set(orientacoes));
}

function montarChecklist(issues: any[]) {
  const checklist = [
    'Conferir objeto, modalidade, órgão, datas e critério de julgamento.',
    'Validar documentos de habilitação jurídica, fiscal, trabalhista e previdenciária.',
    'Conferir qualificação técnica exigida e separar atestados compatíveis.',
    'Montar planilha de custos com impostos, frete, margem e capacidade de entrega.',
    'Validar prazo de entrega, vigência, garantia, sanções e condições de pagamento.',
    'Revisar proposta final antes do envio na plataforma oficial.',
  ];

  if (issues.some((issue) => issue.code === 'possible_brand_restriction')) {
    checklist.push('Revisar especificações com possível marca/modelo e verificar se há justificativa técnica.');
  }

  if (issues.some((issue) => issue.code === 'possible_territorial_restriction')) {
    checklist.push('Revisar exigência territorial e avaliar se cabe esclarecimento ou impugnação.');
  }

  if (issues.some((issue) => issue.code === 'possible_excessive_technical_requirement')) {
    checklist.push('Comparar exigências técnicas com a capacidade real da empresa e com o objeto contratado.');
  }

  if (issues.some((issue) => issue.code === 'short_deadline')) {
    checklist.push('Priorizar análise de prazos, pois o radar identificou prazo possivelmente curto.');
  }

  return Array.from(new Set(checklist));
}

function montarProximosPassos(estrategia: ProposalStrategyMode, issues: any[]) {
  const passos = [
    'Revisar o edital completo e anexos.',
    'Confirmar aderência da empresa ao objeto.',
    'Separar documentos obrigatórios.',
    'Calcular preço mínimo seguro e margem desejada.',
  ];

  if (issues.length > 0) {
    passos.push('Analisar pontos do Radar de Erros antes de enviar proposta.');
  }

  if (issues.some((issue) => issue.severity === 'high')) {
    passos.push('Avaliar pedido de esclarecimento ou impugnação para pontos de severidade alta.');
  }

  if (estrategia === 'agressiva') {
    passos.push('Preparar proposta competitiva e estratégia de lance.');
  } else if (estrategia === 'moderada') {
    passos.push('Preparar proposta com margem protegida e revisar riscos antes do envio.');
  } else {
    passos.push('Decidir participação somente após validação jurídica, operacional e financeira.');
  }

  return Array.from(new Set(passos));
}
