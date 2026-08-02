import { DataPlatformRunLock } from './worker-runtime';
import { DataPlatformWorkerService } from './worker.service';

describe('DataPlatformWorkerService', () => {
  test('nao agenda workers em ambiente de teste mesmo com env habilitada', () => {
    const scheduler = {
      validate: jest.fn(() => true),
      schedule: jest.fn(() => ({ stop: jest.fn() })),
    };
    const service = new DataPlatformWorkerService(
      {} as any,
      {} as any,
      new DataPlatformRunLock(),
      scheduler,
      {
        NODE_ENV: 'test',
        DATA_PLATFORM_WORKERS_ENABLED: 'true',
      },
    );

    const scheduled = service.start();

    expect(scheduled).toEqual([]);
    expect(scheduler.schedule).not.toHaveBeenCalled();
  });

  test('evita ingestao PNCP concorrente pelo lock logico', async () => {
    let release!: () => void;
    const ingestion = {
      ingestPncp: jest.fn(async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { jobId: 'job-1', source: 'pncp' };
      }),
      ingestComprasGov: jest.fn(),
    };
    const service = new DataPlatformWorkerService(
      ingestion as any,
      {} as any,
      new DataPlatformRunLock(),
      { validate: jest.fn(() => true), schedule: jest.fn(() => ({ stop: jest.fn() })) },
      {
        NODE_ENV: 'production',
        DATA_PLATFORM_WORKER_RETRY_BASE_MS: '0',
      },
    );

    const first = service.runPncpIngestion();
    await Promise.resolve();
    const second = await service.runPncpIngestion();

    expect(second).toEqual({ status: 'skipped', reason: 'locked' });
    expect(ingestion.ingestPncp).toHaveBeenCalledTimes(1);

    release();
    await expect(first).resolves.toMatchObject({
      status: 'completed',
      result: { jobId: 'job-1', source: 'pncp' },
    });
  });
});
