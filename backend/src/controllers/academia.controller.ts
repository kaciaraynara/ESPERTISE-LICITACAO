import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/prisma';
import { AuthRequest } from '../shared/middlewares/auth.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'expertise-licitatoria-secret-dev';

function hashPassword(pwd: string): string {
  return crypto.createHash('sha256').update(String(pwd)).digest('hex');
}

async function ensureSeedCourses() {
  const countRows: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM academy_courses`);
  if ((countRows?.[0]?.total ?? 0) > 0) return;

  const seed = [
    {
      title: 'Lei 14.133/21 — Aplicação Prática no Pregão',
      category: 'Cursos Online',
      level: 'Essencial',
      partnerName: 'Prof. Ricardo Mendonça',
      featured: true,
      description: 'Domine as fases do pregão eletrônico, habilitação jurídica/técnica, lances e julgamento sem cair em desclassificações.',
      lessons: [
        { title: 'Visão geral da Nova Lei de Licitações e modalidades', lessonType: 'VIDEO', duration: 18, activity: 'Mapeie 3 editais do seu CNAE no Radar e identifique o critério de julgamento.' },
        { title: 'Leitura estratégica do Edital e Termo de Referência', lessonType: 'VIDEO', duration: 24, activity: 'Extraia os requisitos de habilitação e prazos de entrega de um edital aberto.' },
        { title: 'Habilitação jurídica, fiscal e qualificação técnica', lessonType: 'PDF', duration: 20, activity: 'Confira se todas as certidões no Cofre estão válidas para o certame.' },
      ],
    },
    {
      title: 'Gestão e Fiscalização de Contratos Públicos',
      category: 'Cursos de Extensão',
      level: 'Avançado',
      partnerName: 'Profa. Camila Tavares',
      featured: false,
      description: 'Execução contratual, aditivos, medições, recebimento provisório/definitivo e prevenção de glosas e sanções.',
      lessons: [
        { title: 'Assinatura, garantia contratual e ordem de fornecimento', lessonType: 'VIDEO', duration: 22, activity: 'Cadastre uma garantia contratual simulada em Gestão Pós-Vitória.' },
        { title: 'Aditivos de prazo e acréscimos de até 25% (Art. 124)', lessonType: 'VIDEO', duration: 19, activity: 'Calcule o limite legal de aditivo sobre um contrato de R$ 100.000.' },
      ],
    },
    {
      title: 'Reequilíbrio, Reajuste e Repactuação de Preços',
      category: 'Aulas ao Vivo',
      level: 'Estratégico',
      partnerName: 'Prof. Henrique Bastos',
      featured: false,
      description: 'Como preservar sua margem de lucro em contratos de longo prazo e atas de registro de preços.',
      lessons: [
        { title: 'Diferença prática entre Reajuste (IPCA), Repactuação e Reequilíbrio', lessonType: 'LIVE', duration: 35, activity: 'Simule um pedido de reequilíbrio com notas fiscais comprobatórias.' },
        { title: 'Como protocolar ofício de reequilíbrio sem indeferimento', lessonType: 'PDF', duration: 15, activity: 'Revise os documentos comprobatórios exigidos pelo TCU.' },
      ],
    },
    {
      title: 'Impugnações, Recursos e Malha Fina de Concorrentes',
      category: 'Biblioteca Digital',
      level: 'Especialista',
      partnerName: 'Dra. Juliana Farias',
      featured: false,
      description: 'Identifique cláusulas restritivas, afaste empresas de fachada e proteja seu direito em fase recursal.',
      lessons: [
        { title: 'Cláusulas nulas mais comuns e prazo decadencial (Art. 164)', lessonType: 'VIDEO', duration: 25, activity: 'Analise um edital buscando exigência abusiva de atestado > 50%.' },
        { title: 'Contrarrazões recursais vencedoras na Lei 14.133/21', lessonType: 'VIDEO', duration: 28, activity: 'Estruture 3 tópicos objetivos para rebater recurso de concorrente.' },
      ],
    },
  ];

  for (const c of seed) {
    const inserted: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO academy_courses (title, category, level, partner_name, featured, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      c.title, c.category, c.level, c.partnerName, c.featured, c.description
    );
    const courseId = inserted[0].id;
    for (let i = 0; i < c.lessons.length; i++) {
      const l = c.lessons[i];
      await prisma.$queryRawUnsafe(
        `INSERT INTO academy_lessons (course_id, title, lesson_type, duration_minutes, activity_prompt, sort_order) VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
        courseId, l.title, l.lessonType, l.duration, l.activity, i + 1
      );
    }
  }
}

export class AcademiaController {
  listarCatalogo = async (req: AuthRequest, res: Response) => {
    try {
      await ensureSeedCourses();
      const userId = String(req.user?.id || 'anon');
      const courses: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, partner_id AS "partnerId", partner_name AS "partnerName", title, category, level, description, thumbnail_url AS "thumbnailUrl", featured, created_at AS "createdAt" FROM academy_courses WHERE published = true ORDER BY featured DESC, created_at DESC`
      );
      const lessons: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, course_id AS "courseId", title, description, lesson_type AS "lessonType", video_url AS "videoUrl", material_url AS "materialUrl", activity_prompt AS "activityPrompt", duration_minutes AS "durationMinutes", sort_order AS "sortOrder" FROM academy_lessons ORDER BY sort_order ASC, created_at ASC`
      );
      const progress: any[] = await prisma.$queryRawUnsafe(
        `SELECT lesson_id AS "lessonId", completed FROM academy_progress WHERE user_id = $1`,
        userId
      );
      const doneSet = new Set(progress.filter((p) => p.completed).map((p) => String(p.lessonId)));

      const data = courses.map((c) => {
        const courseLessons = lessons
          .filter((l) => String(l.courseId) === String(c.id))
          .map((l) => ({ ...l, completed: doneSet.has(String(l.id)) }));
        const total = courseLessons.length;
        const concluidas = courseLessons.filter((l) => l.completed).length;
        const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
        return { ...c, lessons: courseLessons, progresso, totalAulas: total, aulasConcluidas: concluidas };
      });

      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Erro ao carregar Academia' });
    }
  };

  alternarConclusaoAula = async (req: AuthRequest, res: Response) => {
    try {
      const userId = String(req.user?.id || '');
      const { lessonId } = req.params;
      if (!userId) return res.status(401).json({ success: false, message: 'Não autenticado' });

      const lessonRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, course_id AS "courseId" FROM academy_lessons WHERE id = $1::uuid`,
        lessonId
      );
      if (!lessonRows.length) return res.status(404).json({ success: false, message: 'Aula não encontrada' });

      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, completed FROM academy_progress WHERE user_id = $1 AND lesson_id = $2::uuid`,
        userId, lessonId
      );

      let completed = true;
      if (existing.length > 0) {
        completed = !existing[0].completed;
        await prisma.$queryRawUnsafe(
          `UPDATE academy_progress SET completed = $1, completed_at = NOW() WHERE id = $2::uuid`,
          completed, existing[0].id
        );
      } else {
        await prisma.$queryRawUnsafe(
          `INSERT INTO academy_progress (user_id, course_id, lesson_id, completed) VALUES ($1, $2::uuid, $3::uuid, true)`,
          userId, lessonRows[0].courseId, lessonId
        );
      }

      return res.json({ success: true, completed });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Erro ao salvar progresso' });
    }
  };

  cadastrarParceiro = async (req: Request, res: Response) => {
    try {
      const { name, email, password, specialty, bio } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Nome, e-mail e senha são obrigatórios.' });
      }
      const cleanEmail = String(email).trim().toLowerCase();
      const exists: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM academy_partners WHERE email = $1`, cleanEmail);
      if (exists.length > 0) {
        return res.status(409).json({ success: false, message: 'Já existe um parceiro cadastrado com este e-mail.' });
      }
      const rows: any[] = await prisma.$queryRawUnsafe(
        `INSERT INTO academy_partners (name, email, password_hash, specialty, bio) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, specialty, bio, status`,
        String(name).trim(), cleanEmail, hashPassword(password), specialty || 'Especialista em Licitações', bio || ''
      );
      const partner = rows[0];
      const token = jwt.sign({ partnerId: partner.id, email: partner.email, name: partner.name, role: 'ACADEMY_PARTNER' }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({ success: true, token, partner });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Erro ao cadastrar parceiro' });
    }
  };

  loginParceiro = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, name, email, password_hash AS "passwordHash", specialty, bio, status FROM academy_partners WHERE email = $1`,
        cleanEmail
      );
      if (!rows.length || rows[0].passwordHash !== hashPassword(String(password || ''))) {
        return res.status(401).json({ success: false, message: 'E-mail ou senha de parceiro inválidos.' });
      }
      const partner = rows[0];
      const token = jwt.sign({ partnerId: partner.id, email: partner.email, name: partner.name, role: 'ACADEMY_PARTNER' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ success: true, token, partner: { id: partner.id, name: partner.name, email: partner.email, specialty: partner.specialty, bio: partner.bio } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Erro no login do parceiro' });
    }
  };

  private resolvePartner(req: Request): { partnerId: string; name: string } | null {
    const authHeader = req.headers.authorization || '';
    const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!rawToken) return null;
    try {
      const decoded: any = jwt.verify(rawToken, JWT_SECRET);
      if (decoded?.partnerId) return { partnerId: decoded.partnerId, name: decoded.name || 'Professor Parceiro' };
      return null;
    } catch {
      return null;
    }
  }

  meusCursosParceiro = async (req: Request, res: Response) => {
    try {
      const partner = this.resolvePartner(req);
      if (!partner) return res.status(401).json({ success: false, message: 'Token de parceiro inválido.' });
      const courses: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, title, category, level, description, thumbnail_url AS "thumbnailUrl", created_at AS "createdAt" FROM academy_courses WHERE partner_id = $1::uuid ORDER BY created_at DESC`,
        partner.partnerId
      );
      const lessons: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, course_id AS "courseId", title, description, lesson_type AS "lessonType", video_url AS "videoUrl", material_url AS "materialUrl", activity_prompt AS "activityPrompt", duration_minutes AS "durationMinutes", sort_order AS "sortOrder" FROM academy_lessons WHERE course_id IN (SELECT id FROM academy_courses WHERE partner_id = $1::uuid) ORDER BY sort_order ASC`,
        partner.partnerId
      );
      const data = courses.map((c) => ({
        ...c,
        lessons: lessons.filter((l) => String(l.courseId) === String(c.id)),
      }));
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Erro ao listar cursos do parceiro' });
    }
  };

  criarCursoParceiro = async (req: Request, res: Response) => {
    try {
      const partner = this.resolvePartner(req);
      if (!partner) return res.status(401).json({ success: false, message: 'Token de parceiro inválido.' });
      const { title, category, level, description, thumbnailUrl } = req.body || {};
      if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Título e descrição do curso são obrigatórios.' });
      }
      const rows: any[] = await prisma.$queryRawUnsafe(
        `INSERT INTO academy_courses (partner_id, partner_name, title, category, level, description, thumbnail_url) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7) RETURNING id, title, category, level, description, thumbnail_url AS "thumbnailUrl"`,
        partner.partnerId, partner.name, String(title).trim(), category || 'Cursos Online', level || 'Essencial', String(description).trim(), thumbnailUrl || null
      );
      return res.status(201).json({ success: true, data: { ...rows[0], lessons: [] } });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Erro ao criar curso' });
    }
  };

  criarAulaParceiro = async (req: Request, res: Response) => {
    try {
      const partner = this.resolvePartner(req);
      if (!partner) return res.status(401).json({ success: false, message: 'Token de parceiro inválido.' });
      const { courseId } = req.params;
      const { title, description, lessonType, videoUrl, materialUrl, activityPrompt, durationMinutes } = req.body || {};
      if (!title) return res.status(400).json({ success: false, message: 'Título da aula é obrigatório.' });

      const own: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM academy_courses WHERE id = $1::uuid AND partner_id = $2::uuid`,
        courseId, partner.partnerId
      );
      if (!own.length) return res.status(403).json({ success: false, message: 'Curso não pertence a este parceiro.' });

      const rows: any[] = await prisma.$queryRawUnsafe(
        `INSERT INTO academy_lessons (course_id, title, description, lesson_type, video_url, material_url, activity_prompt, duration_minutes) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8) RETURNING id, course_id AS "courseId", title, description, lesson_type AS "lessonType", video_url AS "videoUrl", material_url AS "materialUrl", activity_prompt AS "activityPrompt", duration_minutes AS "durationMinutes"`,
        courseId, String(title).trim(), description || '', lessonType || 'VIDEO', videoUrl || null, materialUrl || null, activityPrompt || null, Number(durationMinutes || 15)
      );
      return res.status(201).json({ success: true, data: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Erro ao publicar aula' });
    }
  };
}

export const academiaController = new AcademiaController();