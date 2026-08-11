import { DATA_SOURCE_REGISTRY } from '../source-registry';
import type { DataConnector, DataFetchInput, RawDataRecord } from '../types';

export interface TcuAcordao {
  id: string;
  numero: string;
  ano: string;
  colegiado: string;
  relator: string;
  sumario: string;
  textoIntegral: string;
  dataSessao: string;
}

// Em um ambiente real, esta função faria o fetch numa API externa (ex: Portal TCU, Web Scraping ou LexML API)
export async function fetchTcuAcordaosMock(limit = 10): Promise<{ data: TcuAcordao[] }> {
  return {
    data: [
      {
        id: 'acordao-tcu-1234-2023',
        numero: '1234',
        ano: '2023',
        colegiado: 'Plenário',
        relator: 'Ministro A',
        dataSessao: new Date().toISOString(),
        sumario: 'Representação. Exigência de marca específica sem justificativa técnica. Restrição à competitividade.',
        textoIntegral: 'É ilegal a exigência de marca específica em editais de licitação, salvo quando houver justificativa técnica devidamente comprovada, sob pena de restrição indevida à competitividade e ofensa ao princípio da isonomia (Art. 41, I, Lei 14.133/2021).',
      },
      {
        id: 'acordao-tcu-5678-2023',
        numero: '5678',
        ano: '2023',
        colegiado: 'Plenário',
        relator: 'Ministro B',
        dataSessao: new Date().toISOString(),
        sumario: 'Auditoria. Fixação de prazo irrazoável para entrega de documentação complexa.',
        textoIntegral: 'A fixação de prazo excessivamente exíguo para a apresentação de amostras ou documentação de habilitação complexa fere a razoabilidade e restringe a ampla concorrência, devendo a Administração estipular prazos condizentes com a realidade de mercado.',
      }
    ].slice(0, limit),
  };
}

export class TcuDataConnector implements DataConnector {
  descriptor = DATA_SOURCE_REGISTRY.tcu; // WE NEED TO ADD tcu TO REGISTRY!

  async fetch(input: DataFetchInput): Promise<RawDataRecord[]> {
    const limit = input.limit ?? 10;
    const result = await fetchTcuAcordaosMock(limit);
    const fetchedAt = new Date().toISOString();

    return result.data.map((item) => ({
      tenantId: input.tenantId ?? null,
      source: 'tcu',
      entityType: 'jurisprudence',
      externalId: item.id,
      fetchedAt,
      traceId: input.traceId ?? null,
      payload: { ...item },
    }));
  }
}
