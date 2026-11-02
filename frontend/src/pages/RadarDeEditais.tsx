import LicitacoesPage from './LicitacoesPage';

/**
 * RadarDeEditais
 * Fachada para a interface oficial do Radar de Licitações (LicitacoesPage),
 * garantindo que qualquer navegação ou referência renderize o radar real
 * com consultas comprovadas ao PNCP, busca, filtros e tratamento de estados vazios.
 */
export default function RadarDeEditais() {
  return <LicitacoesPage />;
}
