import api from './api';

export interface BiddingOpportunity {
  id: string;
  title: string;
  description: string;
  estimatedValue: number;
  status: string;
  publishDate: string;
}

export const v3Service = {
  // Radar & PCA
  getRadarOpportunities: async () => {
    const response = await api.get('/pca/radar');
    return response.data;
  },
  
  // CRM Kanban
  getPipelineCards: async () => {
    const response = await api.get('/pipeline');
    return response.data;
  },
  
  updatePipelineCardStage: async (cardId: string, newStage: string) => {
    const response = await api.patch(`/pipeline/${cardId}/stage`, { stage: newStage });
    return response.data;
  },

  // Smart Pricing
  analyzePricingStrategy: async (uasgId: string) => {
    const response = await api.get(`/pricing-strategy?uasgId=${uasgId}`);
    return response.data;
  },

  // Lex IA
  generateAppeal: async (noticeId: string, reason: string) => {
    const response = await api.post('/lex/recurso', { noticeId, reason });
    return response.data;
  },

  // Cofre (Certidões)
  getCertificates: async () => {
    const response = await api.get('/certificates');
    return response.data;
  },
};
