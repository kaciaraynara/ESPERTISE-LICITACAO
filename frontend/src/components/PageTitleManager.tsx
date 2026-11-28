import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SUFFIX = 'Expertise Licitatória';

/**
 * Títulos de aba por rota. Sem isso, o SPA mantém o título do index.html
 * ("Radar PNCP e documentos") em todas as telas, o que confunde o usuário
 * com várias abas abertas e prejudica histórico/favoritos.
 */
const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, 'Radar PNCP e documentos'],
  [/^\/login\/?$/, 'Entrar'],
  [/^\/(register|cadastro)\/?$/, 'Criar conta'],
  [/^\/(forgot-password|reset-password|redefinir-senha|auth\/redefinir-senha|esqueci-senha)\/?$/, 'Recuperar senha'],
  [/^\/termos\/?$/, 'Termos de Uso'],
  [/^\/privacidade\/?$/, 'Política de Privacidade'],

  [/^\/(fornecedor\/)?dashboard\/?$/, 'Dashboard'],
  [/^\/(fornecedor\/)?radar\/?$|^\/oportunidades\/?$/, 'Buscar Oportunidades'],
  [/^\/(fornecedor\/)?licitac(ao|oes)\/[^/]+\/?$/, 'Detalhe da Licitação'],
  [/^\/(fornecedor\/)?(disputas|crm)\/?$|^\/crm-legacy\/?$/, 'Gestão de Disputas'],
  [/^\/(fornecedor\/)?precificacao\/?$/, 'Precificação Estratégica'],
  [/^\/(fornecedor\/)?(pregao-eletronico|tipos-contratacao)\/?$/, 'Pregão Eletrônico'],
  [/^\/(fornecedor\/)?concorrencia\/?$/, 'Concorrência'],
  [/^\/(fornecedor\/)?credenciamento\/?$/, 'Credenciamento'],
  [/^\/(fornecedor\/)?dispensa-eletronica\/?$/, 'Dispensa Eletrônica'],
  [/^\/(fornecedor\/)?recursos\/?$/, 'Recursos Administrativos'],
  [/^\/(fornecedor\/)?defesas-recursos\/?$/, 'Defesas e Recursos'],
  [/^\/(fornecedor\/)?habilitacao\/?$/, 'Habilitação'],
  [/^\/(fornecedor\/)?(cofre|documentos)\/?$/, 'Meus Documentos'],
  [/^\/(fornecedor\/)?certidoes\/?$/, 'Certidões'],
  [/^\/(fornecedor\/)?srp(-carona)?\/?$/, 'Sistema de Registro de Preços'],
  [/^\/(fornecedor\/)?academia\/?$/, 'Academia do Licitante'],
  [/^\/(fornecedor\/)?propostas(\/.*)?$/, 'Gerador de Propostas'],
  [/^\/(fornecedor\/)?lex\/?$/, 'Análise de Editais'],
  [/^\/(fornecedor\/)?leitor-editais\/?$/, 'Leitor Inteligente de Editais'],
  [/^\/(fornecedor\/)?impugnacao\/?$/, 'Impugnação Inteligente'],
  [/^\/(fornecedor\/)?radar-nulidades\/?$/, 'Radar de Nulidades'],
  [/^\/(fornecedor\/)?score-(viabilidade|oportunidades)\/?$/, 'Análise de Viabilidade'],
  [/^\/(fornecedor\/)?analise-viabilidade(\/.*)?$/, 'Análise de Viabilidade'],
  [/^\/(fornecedor\/)?(robo-lances|estrategia-disputa)\/?$/, 'Robô de Lances'],
  [/^\/(fornecedor\/)?disputa-ao-vivo\/?$/, 'Disputa ao Vivo'],
  [/^\/(fornecedor\/)?catalogo\/?$/, 'Catálogo de Produtos'],
  [/^\/(fornecedor\/)?prazos(-alertas)?\/?$/, 'Prazos e Alertas'],
  [/^\/(fornecedor\/)?(contratos|gestao-contratual)\/?$/, 'Gestão Contratual'],
  [/^\/(fornecedor\/)?gestao-pos-vitoria\/?$/, 'Garantias e Gestão Pós-Vitória'],
  [/^\/(fornecedor\/)?(expertise-fiscal)\/?$/, 'Expertise Fiscal'],
  [/^\/(fornecedor\/)?editais-monitorados\/?$/, 'Editais Monitorados'],
  [/^\/(fornecedor\/)?historico-concorrentes\/?$/, 'Histórico de Concorrentes'],
  [/^\/(fornecedor\/)?investigacao\/?$/, 'Inteligência Competitiva'],
  [/^\/(fornecedor\/)?expertise-intelligence\/?$/, 'Auditoria de Concorrentes'],
  [/^\/(fornecedor\/)?relatorios(-estrategicos)?\/?$/, 'Relatórios Estratégicos'],
  [/^\/(fornecedor\/)?planos\/?$/, 'Planos'],
  [/^\/(fornecedor\/)?configuracoes\/?$/, 'Configurações'],
  [/^\/(fornecedor\/)?empresa\/?$/, 'Minha Empresa'],
  [/^\/(fornecedor\/)?integracoes\/?$/, 'Integrações'],
  [/^\/fornecedores\/?$|^\/fornecedor\/fornecedores\/?$/, 'Rede de Fornecedores'],
  [/^\/(fornecedor\/)?sicaf-credenciamento\/?$/, 'SICAF e Certificação'],
  [/^\/fornecedor\/radar-telemetria\/?$|^\/admin\/radar\/?$/, 'Radar de Telemetria'],
  [/^\/(master-admin-vault|internal-ops-vault)\/?$/, 'Painel Administrativo'],
];

export function PageTitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(pathname));
    document.title = match ? `${match[1]} | ${SUFFIX}` : SUFFIX;
  }, [pathname]);

  return null;
}
