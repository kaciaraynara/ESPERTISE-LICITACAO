import {
  createProposalDraftSchema,
  listProposalDraftsQuerySchema,
  proposalIdParamSchema,
} from './proposal.validation';

const companyId = '11111111-1111-4111-8111-111111111111';
const proposalId = '22222222-2222-4222-8222-222222222222';

describe('proposal.validation', () => {
  test('valida e normaliza a criacao de um rascunho', () => {
    const resultado = createProposalDraftSchema.parse({
      companyId,
      titulo: '  Proposta de fornecimento  ',
      moeda: 'brl',
      condicoesPagamento: '',
      garantia: null,
    });

    expect(resultado.companyId).toBe(companyId);
    expect(resultado.titulo).toBe('Proposta de fornecimento');
    expect(resultado.moeda).toBe('BRL');
    expect(resultado.condicoesPagamento).toBeNull();
    expect(resultado.garantia).toBeNull();
  });

  test('aplica BRL como moeda padrao', () => {
    const resultado = createProposalDraftSchema.parse({
      companyId,
      titulo: 'Proposta comercial',
    });

    expect(resultado.moeda).toBe('BRL');
  });

  test('rejeita empresa com identificador invalido', () => {
    expect(() =>
      createProposalDraftSchema.parse({
        companyId: 'empresa-invalida',
        titulo: 'Proposta comercial',
      }),
    ).toThrow('Empresa invalida');
  });

  test('rejeita status enviado pelo cliente', () => {
    expect(() =>
      createProposalDraftSchema.parse({
        companyId,
        titulo: 'Proposta comercial',
        status: 'APROVADA',
      }),
    ).toThrow();
  });

  test('converte paginacao recebida como texto', () => {
    const resultado = listProposalDraftsQuerySchema.parse({
      pagina: '2',
      limite: '10',
    });

    expect(resultado.pagina).toBe(2);
    expect(resultado.limite).toBe(10);
  });

  test('valida o identificador da proposta', () => {
    expect(proposalIdParamSchema.parse({ id: proposalId })).toEqual({
      id: proposalId,
    });
  });
});
