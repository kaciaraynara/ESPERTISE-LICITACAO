import axios, { type AxiosResponse } from 'axios';
import { buscarContratacoesPNCP } from './pncp.service';

describe('pncp.service', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('usa a data local de Brasília e não envia uma data futura ao PNCP', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T02:00:00.000Z'));

    const response = {
      data: { data: [], totalRegistros: 0 },
      status: 200,
      statusText: 'OK',
      headers: {} as AxiosResponse['headers'],
      config: {
        headers: {} as AxiosResponse['config']['headers'],
      } as AxiosResponse['config'],
    } satisfies AxiosResponse;
    const getMock = jest.spyOn(axios, 'get').mockResolvedValue(response);

    await buscarContratacoesPNCP({ codigoModalidadeContratacao: 6 });

    expect(getMock.mock.calls[0][1]?.params).toMatchObject({
      dataInicial: '20261017',
      dataFinal: '20261101',
      codigoModalidadeContratacao: 6,
    });
  });
});
