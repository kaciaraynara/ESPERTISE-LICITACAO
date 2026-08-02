import { Request, Response } from 'express';
import {
  consultarContaGovBr,
  consultarConfiabilidade,
  consultarPerfilCompleto,
  calcularNivelConfiabilidade,
} from '../services/govbr.service';

export class GovBrController {

  /**
   * GET /govbr/conta/:cpf
   * Consulta dados da conta Gov.br de um CPF
   */
  async consultarConta(req: Request, res: Response) {
    const { cpf } = req.params;
    const cpfOperador = (req.headers['x-cpf-operador'] as string) || req.query.cpfOperador as string;

    if (!cpfOperador) {
      return res.status(400).json({
        success: false,
        message: 'CPF do operador é obrigatório (header x-cpf-operador)',
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ success: false, message: 'CPF inválido' });
    }

    try {
      const conta = await consultarContaGovBr(cpfLimpo, cpfOperador.replace(/\D/g, ''));

      return res.json({
        success: true,
        data: {
          cpf: conta.id,
          nome: conta.name,
          email: conta.email,
          emailVerificado: conta.emailVerified === 'true',
          telefone: conta.phoneNumber,
          telefoneVerificado: conta.phoneNumberVerified === 'true',
          status: conta.status,
          criado_em: conta.creationLocalDateTime,
        },
      });
    } catch (err) {
      const status = (err as any)?.response?.status || 500;
      const msg = status === 401
        ? 'Não autorizado a consultar este CPF no Gov.br'
        : status === 404
        ? 'CPF não encontrado no Gov.br'
        : 'Erro ao consultar Gov.br';

      console.error('[GovBr] Erro conta:', (err as Error).message);
      return res.status(status >= 400 && status < 500 ? status : 502).json({
        success: false,
        message: msg,
      });
    }
  }

  /**
   * GET /govbr/confiabilidade/:cpf
   * Consulta o nível de confiabilidade (Bronze/Prata/Ouro) de um CPF
   */
  async consultarConfiabilidade(req: Request, res: Response) {
    const { cpf } = req.params;
    const cpfOperador = (req.headers['x-cpf-operador'] as string) || req.query.cpfOperador as string;

    if (!cpfOperador) {
      return res.status(400).json({
        success: false,
        message: 'CPF do operador é obrigatório (header x-cpf-operador)',
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ success: false, message: 'CPF inválido' });
    }

    try {
      const confiabilidades = await consultarConfiabilidade(cpfLimpo, cpfOperador.replace(/\D/g, ''));
      const nivel = calcularNivelConfiabilidade(confiabilidades);

      return res.json({
        success: true,
        data: {
          cpf: cpfLimpo,
          nivel: nivel.nivel,
          descricao: nivel.descricao,
          pontos: nivel.pontos,
          confiabilidades: confiabilidades.map((c) => ({
            categoria: c.confiabilidade?.categoria,
            titulo: c.confiabilidade?.titulo,
            descricao: c.confiabilidade?.descricao,
            data_criacao: c.dataCriacao,
            data_atualizacao: c.dataAtualizacao,
          })),
        },
      });
    } catch (err) {
      const status = (err as any)?.response?.status || 500;
      const msg = status === 401 ? 'Não autorizado' : status === 404 ? 'CPF sem confiabilidade cadastrada' : 'Erro ao consultar confiabilidade';

      return res.status(status >= 400 && status < 500 ? status : 502).json({
        success: false,
        message: msg,
      });
    }
  }

  /**
   * GET /govbr/perfil/:cpf
   * Consulta completa: conta + confiabilidade em paralelo (endpoint principal)
   */
  async consultarPerfilCompleto(req: Request, res: Response) {
    const { cpf } = req.params;
    const cpfOperador = (req.headers['x-cpf-operador'] as string) || req.query.cpfOperador as string;

    if (!cpfOperador) {
      return res.status(400).json({
        success: false,
        message: 'CPF do operador é obrigatório (header x-cpf-operador)',
      });
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ success: false, message: 'CPF inválido' });
    }

    const perfil = await consultarPerfilCompleto(cpfLimpo, cpfOperador.replace(/\D/g, ''));

    // Mesmo com erro parcial, retorna o que conseguiu
    return res.json({
      success: true,
      data: {
        cpf: cpfLimpo,
        conta: {
          nome: perfil.conta.name,
          email: perfil.conta.email,
          emailVerificado: perfil.conta.emailVerified === 'true',
          telefone: perfil.conta.phoneNumber,
          status: perfil.conta.status,
        },
        confiabilidade: {
          nivel: perfil.nivel.nivel,
          descricao: perfil.nivel.descricao,
          pontos: perfil.nivel.pontos,
          itens: perfil.confiabilidades.map((c) => ({
            categoria: c.confiabilidade?.categoria,
            titulo: c.confiabilidade?.titulo,
            descricao: c.confiabilidade?.descricao,
          })),
        },
        habilitado_licitar: perfil.nivel.pontos >= 2, // Prata ou Ouro para habilitar
      },
    });
  }

}
