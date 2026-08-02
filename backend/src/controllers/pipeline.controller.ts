import { Request, Response } from 'express';
import { prisma } from '../database/prisma';

export class PipelineController {
  // Lista todas as oportunidades no funil do usuario logado
  public listStages = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const pipelines = await prisma.biddingPipeline.findMany({
        where: { userId },
        include: {
          notice: true,
        },
        orderBy: { position: 'asc' },
      });

      res.status(200).json({
        success: true,
        data: pipelines,
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao listar pipeline:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Adiciona uma nova oportunidade ao funil (ex: OPORTUNIDADE)
  public addToPipeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { noticeId, stage = 'OPORTUNIDADE', notes } = req.body;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!noticeId) {
        res.status(400).json({ error: 'Notice ID is required' });
        return;
      }

      // get highest position in stage
      const lastItem = await prisma.biddingPipeline.findFirst({
        where: { userId, stage },
        orderBy: { position: 'desc' },
      });

      const position = lastItem ? lastItem.position + 1 : 0;

      const pipeline = await prisma.biddingPipeline.create({
        data: {
          userId,
          noticeId,
          stage,
          position,
          notes,
        },
      });

      res.status(201).json({
        success: true,
        data: pipeline,
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao adicionar ao pipeline:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Move uma oportunidade de uma coluna para outra, ou reordena
  public moveOpportunity = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const { stage, position } = req.body;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check ownership
      const existing = await prisma.biddingPipeline.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ error: 'Opportunity not found' });
        return;
      }

      const updated = await prisma.biddingPipeline.update({
        where: { id },
        data: {
          stage: stage !== undefined ? stage : existing.stage,
          position: position !== undefined ? position : existing.position,
        },
      });

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao mover oportunidade:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Remove do pipeline
  public removeFromPipeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const existing = await prisma.biddingPipeline.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ error: 'Opportunity not found' });
        return;
      }

      await prisma.biddingPipeline.delete({ where: { id } });

      res.status(200).json({
        success: true,
        message: 'Oportunidade removida do funil'
      });
    } catch (error: any) {
      console.error('[PipelineController] Erro ao remover do pipeline:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
