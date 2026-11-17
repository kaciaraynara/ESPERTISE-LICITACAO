import { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../shared/middlewares/auth.middleware';
import { normalizarCnpj } from '../services/cnpj.service';
import { ConcorrentesService } from '../services/concorrentes.service';
import { ReceitaFederalServiceError, ReceitaService } from '../services/receita.service';
import { analisarConluioSocietario } from '../utils/analiseFraude.util';

const concorrentes = new ConcorrentesService();
const receita = new ReceitaService();

const MAX_CNPJS_MALHA_FINA = 20;

const malhaFinaSchema = z.object({
  cnpjs: z.array(z.string()).optional(),
  concorrentes: z.array(z.string()).optional(),
  licitacaoId: z.string().trim().min(1).optional(),
})
  .refine((data) => (data.cnpjs ?? data.concorrentes ?? []).length >= 2, {
    message: 'Informe ao menos dois CNPJs concorrentes para investigar a malha societária.',
    path: ['cnpjs'],
  })
  .refine((data) => (data.cnpjs ?? data.concorrentes ?? []).length <= MAX_CNPJS_MALHA_FINA, {
    message: `A investigação aceita no máximo ${MAX_CNPJS_MALHA_FINA} CNPJs por requisição.`,
    path: ['cnpjs'],
  });

export class ConcorrentesController {
  async malhaFina(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    const parsed = malhaFinaSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos para investigação de concorrentes.',
        errors: parsed.error.errors,
      });
    }

    const cnpjs = Array.from(new Set((parsed.data.cnpjs ?? parsed.data.concorrentes ?? []).map(normalizarCnpj)));

    if (cnpjs.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'A investigação exige ao menos dois CNPJs distintos.',
      });
    }

    if (cnpjs.length > MAX_CNPJS_MALHA_FINA) {
      return res.status(400).json({
        success: false,
        message: `A investigação aceita no máximo ${MAX_CNPJS_MALHA_FINA} CNPJs distintos.`,
      });
    }

    try {
      const resultadoConsultas = await receita.consultarQsaEmLoteDetalhado(cnpjs);
      const analise = analisarConluioSocietario(resultadoConsultas.empresas);

      const statusAnalise = resultadoConsultas.conclusiva
        ? 'CONCLUSIVA'
        : 'INCONCLUSIVA';

      const riscoExibido =
        !resultadoConsultas.conclusiva && analise.risco === 'BAIXO'
          ? 'MEDIO'
          : analise.risco;

      const recomendacoes = [...analise.recomendacoes];

      if (!resultadoConsultas.conclusiva) {
        recomendacoes.unshift(
          'A investigação é inconclusiva porque uma ou mais consultas à fonte pública não foram concluídas.',
          'Não interprete a ausência de vínculo nas empresas consultadas como prova de inexistência de vínculo entre todas as concorrentes.',
        );
      }

      return res.json({
        success: true,
        data: {
          titulo: 'Malha Fina da Licitação',
          licitacaoId: parsed.data.licitacaoId ?? null,
          fonte: 'brasilapi-cnpj',
          statusAnalise,
          conclusiva: resultadoConsultas.conclusiva,
          risco: riscoExibido,
          possuiSociosEmComum: analise.possuiSociosEmComum,
          resumo: {
            ...analise.resumo,
            totalSolicitado: resultadoConsultas.totalSolicitado,
            totalConsultasComSucesso: resultadoConsultas.totalSucesso,
            totalConsultasComFalha: resultadoConsultas.totalFalhas,
          },
          empresas: analise.empresas,
          vinculosSocietarios: analise.vinculosSocietarios,
          recomendacoes,
          consultas: resultadoConsultas.empresas.map((empresa) => ({
            cnpj: empresa.cnpj,
            razaoSocial: empresa.razaoSocial,
            fonte: empresa.fonte,
            totalSocios: empresa.qsa.length,
            consultadoEm: empresa.consultadoEm,
            status: 'SUCESSO',
          })),
          consultasComFalha: resultadoConsultas.falhas.map((falha) => ({
            cnpj: falha.cnpj,
            status: 'FALHA',
            code: falha.code,
            message: falha.message,
            statusCode: falha.statusCode,
            providerStatusCode: falha.providerStatusCode ?? null,
          })),
          geradoEm: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof ReceitaFederalServiceError) {
        console.warn(JSON.stringify({
          event: 'MALHA_FINA_RECEITA_FAILED',
          code: error.code,
          statusCode: error.statusCode,
          providerStatusCode: error.providerStatusCode,
          error: error.message,
          timestamp: new Date().toISOString(),
        }));

        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code,
          providerStatusCode: error.providerStatusCode,
        });
      }

      console.error(JSON.stringify({
        event: 'MALHA_FINA_FAILED',
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      }));

      return res.status(500).json({
        success: false,
        message: 'Erro ao executar investigação societária dos concorrentes.',
      });
    }
  }

  async dossie(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
    }

    try {
      const data = await concorrentes.gerarDossie(req.params.cnpj, userId);
      const pncpFalhou = data.fontes.some((fonte) => fonte.fonte === 'pncp' && fonte.status === 'failed');
      const todasFontesFalharam = data.fontes.every((fonte) => fonte.status === 'failed');

      if (pncpFalhou || todasFontesFalharam) {
        return res.status(502).json({
          success: false,
          message: 'Não foi possível consultar o PNCP no momento. A base pública pode estar indisponível ou ter excedido o tempo limite.',
          data,
        });
      }

      return res.json({ success: true, data });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CNPJ') {
        return res.status(400).json({
          success: false,
          message: 'CNPJ inválido. Informe um CNPJ com 14 dígitos.',
        });
      }

      console.error(JSON.stringify({
        event: 'CONCORRENTE_DOSSIE_FAILED',
        cnpj: req.params.cnpj,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
      }));

      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar dossiê de concorrente.',
      });
    }
  }

  async integridade(req: any, res: any) {
    const cguToken = process.env.TRANSPARENCIA_API_TOKEN || process.env.PORTAL_TRANSPARENCIA_TOKEN;
    try {
      const rawCnpjs: string[] = Array.isArray(req.body?.cnpjs) ? req.body.cnpjs : [];
      const cnpjs = Array.from(
        new Set(
          rawCnpjs
            .map((c) => String(c || '').replace(/\D/g, ''))
            .filter((c) => c.length === 14)
        )
      ).slice(0, 6);

      if (cnpjs.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos um CNPJ valido com 14 digitos.' });
      }

      const empresas: any[] = [];
      for (const cnpj of cnpjs) {
        let brasilData: any = null;
        try {
          const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
            signal: AbortSignal.timeout(9000),
          });
          if (r.ok) brasilData = await r.json();
        } catch {
          // segue sem travar
        }

        let tcuStatus = 'Nao consultado automaticamente';
        let tcuAlerta = false;
        try {
          const rTcu = await fetch(`https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/${cnpj}`, {
            signal: AbortSignal.timeout(6000),
          });
          if (rTcu.ok) {
            const tcuJson: any = await rTcu.json();
            const certidoes = Array.isArray(tcuJson?.certidoes) ? tcuJson.certidoes : [];
            const irregulares = certidoes.filter((x: any) =>
              String(x?.situacao || '').toUpperCase().includes('CONSTA') &&
              !String(x?.situacao || '').toUpperCase().includes('NADA CONSTA')
            );
            tcuAlerta = irregulares.length > 0;
            tcuStatus = tcuAlerta
              ? `Consta ocorrencia em ${irregulares.length} base(s) APF/TCU`
              : 'Nada consta na consulta consolidada TCU/APF';
          }
        } catch {
          tcuStatus = 'Indisponivel no momento (consultar portal TCU)';
        }

        let cguStatus = 'Token Portal da Transparencia nao configurado';
        let cguAlerta = false;
        if (cguToken) {
          try {
            const rCgu = await fetch(
              `https://api.portaldatransparencia.gov.br/api-de-dados/ceis?codigoSancionado=${cnpj}&pagina=1`,
              {
                headers: { 'chave-api-dados': cguToken },
                signal: AbortSignal.timeout(6000),
              }
            );
            if (rCgu.ok) {
              const cguList: any = await rCgu.json();
              const qtd = Array.isArray(cguList) ? cguList.length : 0;
              cguAlerta = qtd > 0;
              cguStatus = qtd > 0 ? `${qtd} registro(s) no CEIS/CGU` : 'Sem sancoes vigentes no CEIS/CGU';
            }
          } catch {
            cguStatus = 'Falha temporaria na consulta CEIS/CGU';
          }
        }

        const socios = Array.isArray(brasilData?.qsa)
          ? brasilData.qsa.map((s: any) => ({
              nome: String(s.nome_socio || 'Socio').trim(),
              qualificacao: String(s.qualificacao_socio || 'Socio').trim(),
            }))
          : [];

        const enderecoNormalizado = [
          brasilData?.logradouro,
          brasilData?.numero,
          brasilData?.cep,
          brasilData?.municipio,
          brasilData?.uf,
        ]
          .filter(Boolean)
          .join(' ')
          .toUpperCase()
          .trim();

        empresas.push({
          cnpj,
          razaoSocial: brasilData?.razao_social || `Empresa ${cnpj}`,
          nomeFantasia: brasilData?.nome_fantasia || '',
          situacaoCadastral: brasilData?.descricao_situacao_cadastral || 'Nao informada',
          dataAbertura: brasilData?.data_inicio_atividade || null,
          cnaePrincipal: brasilData?.cnae_fiscal ? `${brasilData.cnae_fiscal} - ${brasilData.cnae_fiscal_descricao || ''}` : 'Nao informado',
          endereco: [
            brasilData?.descricao_tipo_de_logradouro,
            brasilData?.logradouro,
            brasilData?.numero,
            brasilData?.bairro,
            brasilData?.municipio,
            brasilData?.uf,
            brasilData?.cep,
          ]
            .filter(Boolean)
            .join(', '),
          enderecoChave: enderecoNormalizado,
          cep: brasilData?.cep || '',
          socios,
          tcuStatus,
          tcuAlerta,
          cguStatus,
          cguAlerta,
        });
      }

      // Cruzamento de vinculos entre empresas
      const conexoes: Array<{ origem: string; destino: string; tipo: string; detalhe: string }> = [];
      const indicios: Array<{ titulo: string; severidade: 'BAIXO' | 'MODERADO' | 'ELEVADO'; detalhe: string }> = [];

      for (let i = 0; i < empresas.length; i++) {
        const empA = empresas[i];

        if (empA.situacaoCadastral && !empA.situacaoCadastral.toUpperCase().includes('ATIVA')) {
          indicios.push({
            titulo: 'Situacao cadastral nao ativa',
            severidade: 'ELEVADO',
            detalhe: `${empA.razaoSocial} (${empA.cnpj}) consta como ${empA.situacaoCadastral}.`,
          });
        }
        if (empA.tcuAlerta || empA.cguAlerta) {
          indicios.push({
            titulo: 'Registro em cadastro de sancoes/inidoneos',
            severidade: 'ELEVADO',
            detalhe: `${empA.razaoSocial}: ${empA.tcuAlerta ? empA.tcuStatus : empA.cguStatus}.`,
          });
        }
        if (empA.dataAbertura) {
          const dias = (Date.now() - new Date(empA.dataAbertura).getTime()) / (1000 * 60 * 60 * 24);
          if (dias >= 0 && dias < 180) {
            indicios.push({
              titulo: 'Empresa constituida recentemente',
              severidade: 'MODERADO',
              detalhe: `${empA.razaoSocial} foi aberta em ${empA.dataAbertura} (menos de 180 dias).`,
            });
          }
        }

        for (let j = i + 1; j < empresas.length; j++) {
          const empB = empresas[j];

          // Socios em comum
          const sociosA = new Set(empA.socios.map((s: any) => s.nome.toUpperCase()));
          const emComum = empB.socios
            .map((s: any) => s.nome)
            .filter((nome: string) => sociosA.has(nome.toUpperCase()));

          if (emComum.length > 0) {
            conexoes.push({
              origem: empA.cnpj,
              destino: empB.cnpj,
              tipo: 'Vinculo Societario',
              detalhe: `Socio(s) em comum: ${emComum.join(', ')}`,
            });
            indicios.push({
              titulo: 'Vinculo societario identificado entre concorrentes',
              severidade: 'ELEVADO',
              detalhe: `${empA.razaoSocial} e ${empB.razaoSocial} compartilham no QSA: ${emComum.join(', ')}.`,
            });
          }

          // Endereco em comum
          if (empA.enderecoChave && empB.enderecoChave && empA.enderecoChave === empB.enderecoChave) {
            conexoes.push({
              origem: empA.cnpj,
              destino: empB.cnpj,
              tipo: 'Mesmo Endereco',
              detalhe: empA.endereco,
            });
            indicios.push({
              titulo: 'Mesmo endereco cadastral entre empresas',
              severidade: 'ELEVADO',
              detalhe: `${empA.razaoSocial} e ${empB.razaoSocial} possuem o mesmo endereco: ${empA.endereco}.`,
            });
          } else if (empA.cep && empB.cep && empA.cep === empB.cep) {
            conexoes.push({
              origem: empA.cnpj,
              destino: empB.cnpj,
              tipo: 'Mesmo CEP',
              detalhe: `CEP em comum: ${empA.cep}`,
            });
            indicios.push({
              titulo: 'Proximidade geografica (mesmo CEP)',
              severidade: 'BAIXO',
              detalhe: `${empA.razaoSocial} e ${empB.razaoSocial} estao sediadas no mesmo CEP (${empA.cep}).`,
            });
          }
        }
      }

      const pesos = indicios.reduce(
        (acc, item) => acc + (item.severidade === 'ELEVADO' ? 28 : item.severidade === 'MODERADO' ? 15 : 6),
        0
      );
      const indiceRisco = Math.min(95, Math.max(8, pesos || 12));
      const nivelRisco = indiceRisco >= 60 ? 'Elevado' : indiceRisco >= 30 ? 'Moderado' : 'Baixo';

      const linhasDefesa = [
        'Comprovacao de independencia operacional e elaboracao autonoma das propostas (Lei 14.133/2021).',
        'Justificativa tecnica e economica dos precos ofertados mediante planilhas de custos e notas fiscais.',
        'Demonstracao de regularidade fiscal, trabalhista e cadastral junto a Receita Federal, TCU e CGU.',
        'Analise tecnica de eventual homonimia ou compartilhamento predial comercial sem gestao comum.',
      ];

      return res.json({
        success: true,
        data: {
          indiceRisco,
          nivelRisco,
          avisoLegal:
            'Os apontamentos abaixo representam indicios objetivos obtidos em bases publicas e exigem verificacao humana e contraditorio, nao constituindo acusacao formal.',
          empresas,
          conexoes,
          indicios,
          linhasDefesa,
          fontesConsultadas: [
            { orgao: 'Receita Federal / BrasilAPI', escopo: 'CNPJ, QSA, CNAE, endereco e situacao cadastral', status: 'Consultado' },
            { orgao: 'TCU (APF Consolidada)', escopo: 'Certidoes publicas e inidoneos', status: empresas.some((e) => e.tcuStatus.includes('Nada consta') || e.tcuAlerta) ? 'Consultado' : 'Verificar portal' },
            { orgao: 'CGU (CEIS/CNEP)', escopo: 'Sancoes e penalidades administrativas', status: cguToken ? 'Consultado' : 'Token pendente' },
            { orgao: 'PNCP', escopo: 'Editais, atas e contratos publicos', status: 'Integrado' },
            { orgao: 'CADE / CARF', escopo: 'Referencias juridicas e linhas de defesa', status: 'Base normativa' },
          ],
          geradoEm: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Erro ao executar cruzamento de integridade.' });
    }
  }

}
