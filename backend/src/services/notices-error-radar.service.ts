import { NoticesSearchService, type NoticesUserContext } from './notices-search.service';
import { chatWithProvider } from './ai.service';
import { prisma } from '../database/prisma';

type Severity = 'low' | 'medium' | 'high';

interface ErrorRadarIssue {
  code: string;
  severity: Severity;
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
  legalBasis?: string[];
}

interface ErrorRadarResult {
  noticeId: string;
  generatedAt: string;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    riskLevel: Severity;
    confidence: 'low' | 'medium' | 'high';
  };
  issues: ErrorRadarIssue[];
  safetyNotice: string;
}

export class NoticesErrorRadarService {
  constructor(private readonly notices = new NoticesSearchService()) {}

  async analyzeNotice(noticeId: string, context: NoticesUserContext): Promise<ErrorRadarResult | null> {
    const notice = await this.notices.getNoticeById(noticeId, {}, context);

    if (!notice) {
      return null;
    }

    const chunksResult = await this.notices
      .listChunks(noticeId, { limit: 100, offset: 0 }, context)
      .catch(() => null);

    const chunks = extractChunks(chunksResult);
    const fullText = chunks.map((chunk) => chunk.text).join('\n\n');

    const issues: ErrorRadarIssue[] = [];

    // 1. ANÁLISE BÁSICA / REGEX (Rápida e Determinística)
    const objectText = pickText(notice, ['object', 'objeto', 'title', 'titulo', 'description', 'descricao']);
    const modality = pickText(notice, ['modality', 'modalidade']);
    const estimatedValue = pickNumber(notice, ['estimatedValue', 'valorEstimado', 'valor_estimado', 'value', 'valor']);
    const publishedAt = pickDate(notice, ['publishedAt', 'published_at', 'dataPublicacao', 'data_publicacao']);
    const openingAt = pickDate(notice, ['openingAt', 'opening_at', 'dataAbertura', 'data_abertura', 'dataEncerramento', 'data_encerramento']);

    if (!objectText || objectText.length < 20 || isGenericObject(objectText)) {
      issues.push({
        code: 'generic_or_missing_object',
        severity: 'high',
        title: 'Objeto ausente, curto ou genérico',
        description:
          'O edital apresenta objeto ausente, muito curto ou genérico. Isso pode dificultar a compreensão do escopo real da contratação.',
        evidence: objectText ? [objectText.slice(0, 260)] : ['Objeto nao localizado nos dados estruturados do edital.'],
        recommendation:
          'Recomenda-se revisar o edital e os anexos para confirmar se o objeto está suficientemente claro, mensurável e compatível com a disputa.',
        legalBasis: ['Lei nº 14.133/2021: planejamento, clareza do objeto e seleção da proposta apta a atender ao interesse público.'],
      });
    }

    if (!modality) {
      issues.push({
        code: 'missing_modality',
        severity: 'medium',
        title: 'Modalidade não identificada',
        description:
          'A modalidade da contratação não foi identificada nos dados estruturados. Isso pode prejudicar a análise de prazos, rito e estratégia de participação.',
        evidence: ['Modalidade nao localizada nos dados estruturados do edital.'],
        recommendation:
          'Conferir o edital original, aviso de contratação e anexos para confirmar a modalidade aplicável.',
        legalBasis: ['Lei nº 14.133/2021: modalidades licitatórias e rito procedimental.'],
      });
    }

    if (!estimatedValue || estimatedValue <= 0) {
      issues.push({
        code: 'missing_estimated_value',
        severity: 'high',
        title: 'Valor estimado ausente ou inválido',
        description:
          'O valor estimado não foi identificado ou está inválido. Isso reduz a segurança para análise de viabilidade, margem e possível inexequibilidade.',
        evidence: ['Valor estimado nao localizado ou invalido nos dados estruturados.'],
        recommendation:
          'Verificar termo de referência, planilha orçamentária, pesquisa de preços e anexos financeiros.',
        legalBasis: ['Lei nº 14.133/2021: estimativa de valor, planejamento e orçamento da contratação.'],
      });
    }

    // 2. ANÁLISE AVANÇADA COM GEMINI IA (Se houver chunks)
    if (fullText && fullText.length > 50) {
      try {
        const aiResponse = await this.analyzeWithAI(fullText);
        if (aiResponse && aiResponse.issues) {
          for (const aiIssue of aiResponse.issues) {
            issues.push(aiIssue);
          }
        }
      } catch (err) {
        console.error('[ErrorRadar] Falha ao analisar com IA Gemini:', err);
        // Fallback silently if AI fails, relying only on regex
      }
    } else {
      issues.push({
        code: 'missing_document_chunks',
        severity: 'medium',
        title: 'Texto do edital/anexos não indexado',
        description:
          'Não foram encontrados chunks textuais do edital. Isso limita a análise automática de exigências, cláusulas restritivas e pontos de impugnação.',
        evidence: ['Nenhum chunk textual localizado para este edital.'],
        recommendation:
          'Importar ou reprocessar o edital e seus anexos para permitir análise completa.',
      });
    }

    const summary = buildSummary(issues, chunks.length);

    return {
      noticeId,
      generatedAt: new Date().toISOString(),
      summary,
      issues,
      safetyNotice:
        'Este radar aponta pontos de atenção e possíveis inconsistências baseando-se em IA e heurísticas. Ele não afirma fraude, ilegalidade, cartel ou direcionamento como conclusão definitiva. A análise deve ser revisada por profissional responsável antes de qualquer medida.',
    };
  }

  private async analyzeWithAI(text: string): Promise<{ issues: ErrorRadarIssue[] } | null> {
    // Truncate text if it's too large to prevent overloading, though Gemini handles large contexts well
    const truncatedText = text.slice(0, 150000); 

    // Buscar regras jurídicas ativas do banco de dados (nossa base de conhecimento RAG)
    const rules = await prisma.legalRule.findMany({
      where: { active: true },
      select: { code: true, name: true, description: true, legalBasis: true }
    });

    let rulesPrompt = '';
    if (rules.length > 0) {
      rulesPrompt = `\nUTILIZE ESTRITAMENTE AS SEGUINTES REGRAS JURÍDICAS COMO BASE DE AUDITORIA:\n`;
      rules.forEach(rule => {
        rulesPrompt += `- [${rule.code}] ${rule.name}: ${rule.description} (Base legal: ${JSON.stringify(rule.legalBasis)})\n`;
      });
      rulesPrompt += `\nAo encontrar uma violação que se encaixe nas regras acima, utilize o 'code' exato da regra correspondente no JSON de resposta.\n`;
    }

    const prompt = `Você é um advogado especialista em licitações e contratos públicos (Lei 14.133/2021).
Sua tarefa é analisar o edital abaixo e encontrar POSSÍVEIS VÍCIOS, NULIDADES ou EXIGÊNCIAS ABUSIVAS/RESTRITIVAS que poderiam ser alvo de impugnação.
${rulesPrompt}
Procure por restrições à competitividade, exigências ilegais de habilitação, e inadequações de objeto ou prazos.

ATENÇÃO: Responda SOMENTE com um JSON estrito no seguinte formato, sem formatação markdown em volta:
{
  "issues": [
    {
      "code": "codigo_da_regra_ou_ai_found_issue",
      "severity": "high" | "medium" | "low",
      "title": "Breve título do erro",
      "description": "Explicação do possível vício",
      "evidence": ["Trechos exatos do edital que comprovam o vício"],
      "recommendation": "O que o licitante deve fazer (ex: impugnar)",
      "legalBasis": ["Base legal (ex: Lei 14.133)"]
    }
  ]
}
Caso não encontre vícios, retorne {"issues": []}.

TEXTO DO EDITAL PARA ANÁLISE:
${truncatedText}
`;

    const result = await chatWithProvider([
      { role: 'user', content: prompt }
    ]);

    try {
      let content = result.content.trim();
      // Remover markdown code blocks se houver
      if (content.startsWith('\`\`\`')) {
        content = content.replace(/^\`\`\`(json)?/, '').replace(/\`\`\`$/, '').trim();
      }
      const parsed = JSON.parse(content);
      return parsed;
    } catch (e) {
      console.error('[ErrorRadar] Falha ao fazer parse do JSON da IA:', e);
      return null;
    }
  }
}

function extractChunks(result: any): Array<{ text: string }> {
  const candidates = result?.data ?? result?.chunks ?? result?.items ?? result?.results ?? [];
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((item) => ({
      text: String(item?.text ?? item?.content ?? item?.chunk ?? item?.texto ?? '').trim(),
    }))
    .filter((item) => item.text.length > 0);
}

function pickText(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickDate(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function daysBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isGenericObject(objectText: string) {
  const normalized = objectText.trim().toLowerCase();
  return [
    'contratacao', 'contratação', 'aquisicao', 'aquisição', 'servico', 'serviço', 'servicos', 'serviços', 'fornecimento', 'registro de precos', 'registro de preços',
  ].includes(normalized);
}

function buildSummary(issues: ErrorRadarIssue[], chunkCount: number): ErrorRadarResult['summary'] {
  const high = issues.filter((issue) => issue.severity === 'high').length;
  const medium = issues.filter((issue) => issue.severity === 'medium').length;
  const low = issues.filter((issue) => issue.severity === 'low').length;

  const riskLevel: Severity = high > 0 ? 'high' : medium > 0 ? 'medium' : 'low';
  const confidence = chunkCount >= 10 ? 'high' : chunkCount >= 3 ? 'medium' : 'low';

  return {
    total: issues.length,
    high,
    medium,
    low,
    riskLevel,
    confidence,
  };
}
