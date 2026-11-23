import {
  calcularPrazoDecadencialImpugnacao,
  gerarEsqueletoImpugnacao,
} from './impugnacao.service';

describe('impugnacao.service', () => {
  test('calcula tres dias uteis antes ignorando fim de semana', () => {
    const prazo = calcularPrazoDecadencialImpugnacao('2026-06-01');

    expect(prazo.dataCertame).toBe('2026-06-01');
    expect(prazo.prazoDecadencial).toBe('2026-05-27');
    expect(prazo.diasUteisAntes).toBe(3);
    expect(prazo.fundamentoLegal.artigo).toBe('art. 164, caput');
  });

  test('aceita data em formato brasileiro', () => {
    const prazo = calcularPrazoDecadencialImpugnacao('21/05/2026');

    expect(prazo.dataCertame).toBe('2026-05-21');
    expect(prazo.prazoDecadencial).toBe('2026-05-18');
  });

  test('rejeita data inexistente', () => {
    expect(() => calcularPrazoDecadencialImpugnacao('2026-02-30')).toThrow('INVALID_CERTAME_DATE');
  });

  test('gera esqueleto com placeholders juridicos essenciais', () => {
    const peca = gerarEsqueletoImpugnacao({
      dataCertame: '2026-06-01',
      numeroPregao: '12/2026',
      formato: 'markdown',
    });

    expect(peca.conteudo).toContain('IMPUGNAÇÃO AO EDITAL');
    expect(peca.conteudo).toContain('[NOME_DO_ORGAO]');
    expect(peca.conteudo).toContain('[FUNDAMENTACAO_LEGAL]');
    expect(peca.placeholders).toContain('[FUNDAMENTACAO_LEGAL]');
    expect(peca.conteudo).toContain('art. 164, caput');
    expect(peca.conteudo).not.toContain('[DATA_DO_PROTOCOLO]');
    expect(peca.prazo.prazoDecadencial).toBe('2026-05-27');
  });

  test('bloco de malha fina cita art. 165 (recurso) em vez de art. 166 da Lei 14.133/2021', () => {
    const peca = gerarEsqueletoImpugnacao({
      dataCertame: '2026-06-01',
      dadosFraude: {
        risco: 'ALTO',
        vinculosSocietarios: [
          {
            socio: { nome: 'Socio Em Comum' },
            empresas: [
              { cnpj: '11111111000111', razaoSocial: 'Empresa A' },
              { cnpj: '22222222000122', razaoSocial: 'Empresa B' },
            ],
          },
        ],
      },
    });

    expect(peca.conteudo).toContain('art. 165 da Lei nº 14.133/2021');
    expect(peca.conteudo).not.toContain('art. 166');
  });
});
