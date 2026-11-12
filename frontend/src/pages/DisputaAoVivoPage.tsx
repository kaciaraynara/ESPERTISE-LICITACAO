import { MesaOperacionalDisputa } from '@/components/MesaOperacionalDisputa';

/**
 * Mesa Operacional de Disputa Profissional ao Vivo
 * Padrão Compras.gov.br / LicitaNet / BNC
 * 3 Zonas Estruturadas:
 * - Zona 1: Barra Superior de Comando do Certame (1 Linha)
 * - Zona 2: Grade Operacional de Itens em Disputa e Lances Automatizados (8 Colunas)
 * - Zona 3: Painel Lateral de Proteção de Margem & Feed Ao Vivo (4 Colunas)
 */
export default function DisputaAoVivoPage() {
  return <MesaOperacionalDisputa mode="disputa" />;
}
