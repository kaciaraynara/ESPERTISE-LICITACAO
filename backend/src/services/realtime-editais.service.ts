import { EventEmitter } from 'events';
import type { Request, Response } from 'express';

export interface EditaisUpdateEvent {
  fonte: string;
  quantidade: number;
  timestamp: string;
}

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function emitEditaisAtualizados(event: Omit<EditaisUpdateEvent, 'timestamp'>) {
  if (event.quantidade <= 0) return;
  const payload: EditaisUpdateEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  bus.emit('editais_atualizados', payload);
}

export function attachEditaisSseStream(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('connected', { status: 'listening', timestamp: new Date().toISOString() });

  const onUpdate = (payload: EditaisUpdateEvent) => {
    sendEvent('editais_atualizados', payload);
  };

  bus.on('editais_atualizados', onUpdate);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('editais_atualizados', onUpdate);
    res.end();
  });
}
