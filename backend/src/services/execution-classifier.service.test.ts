import { classifyExecutionMode } from './execution-classifier.service';

describe('execution-classifier.service', () => {
  test('não classifica aquisição presencial de nobreaks com instalação na sede (caso Coren-BA) como REMOTO_INTEGRAL', () => {
    const textoCoren = `
[Página 1 de Edital_Coren_BA.pdf]
PREGÃO ELETRÔNICO - CONSELHO REGIONAL DE ENFERMAGEM DA BAHIA (COREN-BA)
Objeto: Aquisição de nobreaks senoidais com instalação e orientação operacional na sede do Coren-BA.

[Página 4 de Edital_Coren_BA.pdf]
5.1 O local de entrega e instalação dos equipamentos será na sede do Coren-BA em Salvador/BA, com orientação operacional presencial à equipe técnica.
`;

    const res = classifyExecutionMode(textoCoren, 'CONCLUIDO', {
      modality: 'Pregão Eletrônico',
      object: 'Aquisição de nobreaks com instalação na sede do Coren-BA',
    });

    expect(res.isRemoteDispute).toBe(true);
    expect(res.executionMode).not.toBe('REMOTO_INTEGRAL');
    expect(['PRESENCIAL_FISICO', 'HIBRIDO']).toContain(res.executionMode);
  });

  test('mantém NAO_IDENTIFICADO quando leitura completa ainda não foi concluída', () => {
    const res = classifyExecutionMode('Licenciamento SaaS em nuvem.', 'PENDENTE', {
      modality: 'Pregão Eletrônico',
    });
    expect(res.executionMode).toBe('NAO_IDENTIFICADO');
  });

  test('classifica como REMOTO_INTEGRAL apenas quando leitura CONCLUIDO confirma entrega/serviço digital sem presença física', () => {
    const textoSaas = `
[Página 3 de TR_Software.pdf]
PREGÃO ELETRÔNICO Nº 12/2026
Objeto: Contratação de software como serviço (SaaS) em ambiente em nuvem com entrega eletrônica de credenciais e suporte remoto.
3.1 A disponibilização do sistema ocorrerá mediante entrega digital das chaves de acesso e prestação de serviços remota, sem necessidade de comparecimento presencial.
`;

    const res = classifyExecutionMode(textoSaas, 'CONCLUIDO', {
      modality: 'Pregão Eletrônico',
      object: 'Licenciamento SaaS em nuvem',
    });

    expect(res.isRemoteDispute).toBe(true);
    expect(res.executionMode).toBe('REMOTO_INTEGRAL');
    expect(res.executionEvidence).toContain('TR_Software.pdf');
    expect(res.executionEvidence).toContain('Pág. 3');
  });
});
