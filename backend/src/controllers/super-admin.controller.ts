import { Request, Response } from 'express';
import { SuperAdminService } from '../services/super-admin.service';

export class SuperAdminController {
  constructor(private readonly service = new SuperAdminService()) {}

  async getMetrics(req: Request, res: Response) {
    const metrics = await this.service.getMetrics();
    return res.json({ success: true, data: metrics });
  }

  async listUsers(req: Request, res: Response) {
    const skip = parseInt(String(req.query.skip)) || 0;
    const take = parseInt(String(req.query.take)) || 50;
    
    const result = await this.service.listUsers(skip, take);
    return res.json({ success: true, data: result });
  }

  async sendEmail(req: Request, res: Response) {
    const { userId, subject, message } = req.body;

    if (!userId || !subject || !message) {
      return res.status(400).json({ success: false, error: 'Campos userId, subject e message são obrigatórios' });
    }

    try {
      const result = await this.service.sendEmail(userId, subject, message);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  }
}

export const superAdminController = new SuperAdminController();
