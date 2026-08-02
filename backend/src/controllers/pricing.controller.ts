import { Request, Response } from 'express';
import { buscarHistoricoPregoes, calcularPrecoReferencia } from '../services/comprasgov.service';

export class PricingController {
  // Preve preco sugerido e chances de ganhar baseado no historico
  public getPricingStrategy = async (req: Request, res: Response): Promise<void> => {
    try {
      const { keyword, catmat, uf, estimatedValue } = req.body;
      
      if (!keyword && !catmat) {
        res.status(400).json({ error: 'Keyword or CATMAT is required' });
        return;
      }

      // Fetch historical bids
      const history = await buscarHistoricoPregoes({
        descricao: keyword,
        codigoCatmat: catmat,
        uf: uf,
        pagina: 1
      });

      // Calculate statistical reference
      const stats = calcularPrecoReferencia(history);

      // Simple AI/Math Strategy:
      // If estimatedValue is provided, calculate probability of winning based on discount
      let suggestedBid = stats.precoSugerido;
      let winningProbability = 0;

      if (estimatedValue) {
        const estValueNum = Number(estimatedValue);
        const myDiscountPct = ((estValueNum - suggestedBid) / estValueNum) * 100;
        
        // Se meu desconto sugerido é maior que a media historica, chance alta
        if (myDiscountPct > stats.descontoPctMedio + 5) {
          winningProbability = 95;
        } else if (myDiscountPct >= stats.descontoPctMedio) {
          winningProbability = 75;
        } else {
          winningProbability = 30; // Desconto muito baixo
        }
      }

      res.status(200).json({
        success: true,
        data: {
          historySample: history.length,
          stats,
          suggestedBid,
          winningProbability,
          message: `Recomendamos o lance de R$ ${suggestedBid.toFixed(2)} com base no desconto médio histórico de ${Math.round(stats.descontoPctMedio)}% para este item.`
        }
      });
    } catch (error: any) {
      console.error('[PricingController] Erro na precificacao:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
