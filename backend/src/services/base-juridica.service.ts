import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { prisma } from '../database/prisma';

export interface ResultadoBuscaJuridica {
  id: string;
  titulo: string;
  autoridade: string;
  referencia: string | null;
  fonte: string;
  artigo_referencia: string | null;
  tema: string | null;
  conteudo: string;
  resumo: string | null;
  url_oficial: string | null;
  tags: string[];
  similaridade: number;
  distancia_cosseno: number;
}

export interface BuscarContextoOptions {
  limite?: number;
  autoridade?: string;
  tema?: string;
}

/**
 * Gera um vetor de 768 coordenadas matemáticas correspondente ao texto fornecido.
 * Utiliza o mesmo modelo e endpoint que gravou os dados na tabela base_juridica (gemini-embedding-001 / text-embedding-004).
 */
export async function gerarEmbeddingTexto(texto: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const truncatedText = (texto || '').slice(0, 8000).trim();

  if (apiKey && apiKey !== 'unconfigured') {
    const modelsToTry = ['models/gemini-embedding-001', 'models/text-embedding-004'];

    for (const modelPath of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:embedContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelPath,
            content: { parts: [{ text: truncatedText }] },
            outputDimensionality: 768,
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as any;
          const values = data?.embedding?.values;
          if (Array.isArray(values) && values.length === 768) {
            return values.map(Number);
          }
        }
      } catch (err: any) {
        // Tenta o próximo modelo
      }
    }
  }

  // Fallback matemático determinístico (Feature Hashing 768d normalizado L2)
  const vec = new Float64Array(768);
  const tokens = truncatedText.toLowerCase().match(/[a-zA-ZÀ-ÿ0-9]{3,}/g) || ['licitacao', 'lei', '14133'];

  tokens.forEach((token, pos) => {
    const hash = crypto.createHash('sha256').update(token).digest();
    const idx1 = hash.readUInt16BE(0) % 768;
    const idx2 = hash.readUInt16BE(2) % 768;
    const idx3 = hash.readUInt16BE(4) % 768;
    const s1 = hash[6] % 2 === 0 ? 1.0 : -1.0;
    const s2 = hash[7] % 2 === 0 ? 1.0 : -1.0;
    const s3 = hash[8] % 2 === 0 ? 1.0 : -1.0;
    const weight = pos < 25 ? 1.5 : 1.0;

    vec[idx1] += s1 * weight;
    vec[idx2] += s2 * (weight * 0.6);
    vec[idx3] += s3 * (weight * 0.3);
  });

  let sumSq = 0;
  for (let i = 0; i < 768; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1.0;

  const result: number[] = new Array(768);
  for (let i = 0; i < 768; i++) {
    result[i] = Number((vec[i] / norm).toFixed(6));
  }
  return result;
}

/**
 * Busca na base jurídica do PostgreSQL (Neon) os precedentes, acórdãos ou leis mais
 * similares à dúvida do usuário utilizando o operador de distância cosseno (<=>) do pgvector.
 *
 * @param pergunta Dúvida ou consulta digitada pelo cliente no sistema
 * @param options Opções adicionais de limite (padrão: 3) e filtros opcionais
 * @returns Array com as linhas mais similares rankeadas por relevância jurídica
 */
export async function buscarContextoJuridico(
  pergunta: string,
  options?: BuscarContextoOptions,
): Promise<ResultadoBuscaJuridica[]> {
  const limite = Math.min(Math.max(options?.limite || 3, 1), 10);
  const embedding = await gerarEmbeddingTexto(pergunta);
  const vectorLiteral = `[${embedding.join(',')}]`;

  // Utiliza $queryRawUnsafe com parâmetros sanitizados e tipados
  const querySql = `
    SELECT
      id,
      titulo,
      autoridade,
      referencia,
      fonte,
      artigo_referencia,
      tema,
      conteudo,
      resumo,
      url_oficial,
      tags,
      ROUND((1 - (embedding <=> CAST($1 AS vector(768))))::numeric, 4)::float8 AS similaridade,
      ROUND((embedding <=> CAST($1 AS vector(768)))::numeric, 4)::float8 AS distancia_cosseno
    FROM base_juridica
    WHERE ativo = true
      AND embedding IS NOT NULL
      ${options?.autoridade ? `AND autoridade = '${options.autoridade.replace(/'/g, "''")}'` : ''}
    ORDER BY embedding <=> CAST($1 AS vector(768)) ASC
    LIMIT $2;
  `;

  const rows = await prisma.$queryRawUnsafe<any[]>(querySql, vectorLiteral, limite);

  return (rows || []).map((row) => ({
    id: String(row.id),
    titulo: String(row.titulo || ''),
    autoridade: String(row.autoridade || 'TCU'),
    referencia: row.referencia ? String(row.referencia) : null,
    fonte: String(row.fonte || ''),
    artigo_referencia: row.artigo_referencia ? String(row.artigo_referencia) : null,
    tema: row.tema ? String(row.tema) : null,
    conteudo: String(row.conteudo || ''),
    resumo: row.resumo ? String(row.resumo) : null,
    url_oficial: row.url_oficial ? String(row.url_oficial) : null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    similaridade: Number(row.similaridade || 0),
    distancia_cosseno: Number(row.distancia_cosseno || 0),
  }));
}

export class BaseJuridicaService {
  async buscarContexto(pergunta: string, limite = 3): Promise<ResultadoBuscaJuridica[]> {
    return buscarContextoJuridico(pergunta, { limite });
  }

  async formatarContextoParaPrompt(pergunta: string, limite = 3): Promise<string> {
    const resultados = await buscarContextoJuridico(pergunta, { limite });
    if (!resultados.length) return '';

    return resultados
      .map(
        (r, i) =>
          `[FONTE ${i + 1}: ${r.autoridade} — ${r.titulo} (Ref: ${r.referencia || r.artigo_referencia || 'N/A'})]\n${r.conteudo}`,
      )
      .join('\n\n---\n\n');
  }
}

export const baseJuridicaService = new BaseJuridicaService();

