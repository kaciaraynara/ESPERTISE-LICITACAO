jest.mock('../database/prisma', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma';
import { academiaController } from './academia.controller';

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('AcademiaController', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  const queryRawMock = (prisma as any).$queryRawUnsafe as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-with-more-than-32-chars!';
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  test('cadastrarParceiro armazena hash bcrypt e assina token com getJwtSecret()', async () => {
    queryRawMock
      .mockResolvedValueOnce([]) // email não existe
      .mockResolvedValueOnce([
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Prof. Teste',
          email: 'prof@teste.com',
          specialty: 'Pregão',
          bio: '',
          status: 'ACTIVE',
        },
      ]);

    const res = makeRes();
    await academiaController.cadastrarParceiro(
      {
        body: {
          name: 'Prof. Teste',
          email: 'prof@teste.com',
          password: 'SenhaForte@2026',
          specialty: 'Pregão',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    const savedHash = String(queryRawMock.mock.calls[1][3]);
    expect(savedHash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('SenhaForte@2026', savedHash)).toBe(true);

    const decoded: any = jwt.verify(res.body.token, process.env.JWT_SECRET!);
    expect(decoded).toMatchObject({
      partnerId: '11111111-1111-4111-8111-111111111111',
      role: 'ACADEMY_PARTNER',
    });
  });

  test('loginParceiro aceita hash bcrypt e também hash legado SHA-256', async () => {
    const legacyHash = crypto.createHash('sha256').update('SenhaLegada123').digest('hex');
    queryRawMock.mockResolvedValueOnce([
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Profa. Legado',
        email: 'legado@teste.com',
        passwordHash: legacyHash,
        specialty: 'Contratos',
        bio: '',
        status: 'ACTIVE',
      },
    ]);

    const res = makeRes();
    await academiaController.loginParceiro(
      { body: { email: 'legado@teste.com', password: 'SenhaLegada123' } } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
  });

  test('alternarConclusaoAula e criarAulaParceiro rejeitam IDs não-UUID com HTTP 400 sem bater no PostgreSQL', async () => {
    const resLesson = makeRes();
    await academiaController.alternarConclusaoAula(
      { user: { id: 'user-1' }, params: { lessonId: 'id-invalido' } } as any,
      resLesson,
    );
    expect(resLesson.statusCode).toBe(400);

    const partnerToken = jwt.sign(
      { partnerId: '11111111-1111-4111-8111-111111111111', name: 'Prof' },
      process.env.JWT_SECRET!,
    );
    const resCourse = makeRes();
    await academiaController.criarAulaParceiro(
      {
        headers: { authorization: `Bearer ${partnerToken}` },
        params: { courseId: 'curso-invalido' },
        body: { title: 'Aula 1' },
      } as any,
      resCourse,
    );
    expect(resCourse.statusCode).toBe(400);
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});
