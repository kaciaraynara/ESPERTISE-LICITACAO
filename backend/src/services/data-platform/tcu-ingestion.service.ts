import { TcuDataConnector } from './connectors/tcu.adapter';
import { prisma } from '../../database/prisma';
import { dataPlatformLog } from './worker-runtime';
export class TcuIngestionService {
  constructor(
    private readonly connector = new TcuDataConnector(),
  ) {}

  async ingestTcuAcordaos(limit = 10, tenantId?: string) {
    dataPlatformLog('info', 'TCU_INGESTION_STARTED', { limit, tenantId });

    try {
      const records = await this.connector.fetch({ limit, tenantId });

      let saved = 0;
      for (const record of records) {
        const payload = record.payload as Record<string, string>;
        
        // Verifica se a regra já existe
        const existing = await prisma.legalRule.findFirst({
          where: { code: payload.numero, tenantId: tenantId ?? null, version: payload.ano }
        });

        if (!existing) {
          const rule = await prisma.legalRule.create({
            data: {
              tenantId: tenantId ?? null,
              code: payload.numero,
              name: `Acórdão TCU ${payload.numero}/${payload.ano}`,
              description: payload.sumario,
              severity: 'medium', // Default
              category: 'jurisprudence',
              legalBasis: {
                relator: payload.relator,
                colegiado: payload.colegiado,
                dataSessao: payload.dataSessao,
                textoIntegral: payload.textoIntegral
              },
              version: payload.ano,
              active: true,
              workflowStatus: 'approved',
              criteria: {
                sumario: payload.sumario
              },
              alertMessage: `Atenção à jurisprudência do TCU (Acórdão ${payload.numero}/${payload.ano})`,
              recommendation: 'Revisar editais com base no entendimento do TCU.',
            }
          });

          // Chunking
          await prisma.documentChunk.create({
            data: {
              tenantId: tenantId ?? null,
              sourceType: 'legal_rule',
              sourceId: rule.id,
              chunkIndex: 0,
              contentHash: payload.numero,
              content: payload.textoIntegral,
              metadata: {
                numero: payload.numero,
                ano: payload.ano,
                sumario: payload.sumario
              }
            }
          });

          // Enviar para a fila de indexação vetorial
          await prisma.searchIndexTask.create({
            data: {
              tenantId: tenantId ?? null,
              targetType: 'legal_rule',
              targetId: rule.id,
              engine: 'pgvector',
              operation: 'upsert',
              status: 'pending',
              metadata: {}
            }
          });

          saved++;
        }
      }

      dataPlatformLog('info', 'TCU_INGESTION_COMPLETED', { fetched: records.length, saved });
      return { success: true, fetched: records.length, saved };
    } catch (error) {
      dataPlatformLog('error', 'TCU_INGESTION_FAILED', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}
