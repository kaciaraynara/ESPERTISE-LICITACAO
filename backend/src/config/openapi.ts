import swaggerJsdoc from 'swagger-jsdoc';

const jsonResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ApiResponse' },
    },
  },
});

export const openApiSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'EXPERTISE SaaS API',
      version: '1.0.0',
      description: 'Contrato HTTP oficial da plataforma EXPERTISE.',
    },
    servers: [{ url: '/', description: 'Servidor atual' }],
    tags: [
      { name: 'Saúde' },
      { name: 'Auth' },
      { name: 'Licitações' },
      { name: 'Empresas' },
      { name: 'Documentos' },
      { name: 'Pagamentos' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: { type: 'boolean' },
            data: { nullable: true },
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'senha'],
          properties: {
            email: { type: 'string', format: 'email' },
            senha: { type: 'string', format: 'password', minLength: 8 },
          },
        },
        RegisterInput: {
          type: 'object',
          required: ['nome', 'cnpj', 'razao_social', 'email', 'senha', 'aceite_lgpd'],
          properties: {
            nome: { type: 'string', minLength: 2 },
            cnpj: { type: 'string', minLength: 14, maxLength: 18 },
            razao_social: { type: 'string', minLength: 3 },
            email: { type: 'string', format: 'email' },
            telefone: { type: 'string' },
            senha: { type: 'string', format: 'password', minLength: 8 },
            aceite_lgpd: { type: 'boolean', enum: [true] },
            role: { type: 'string', enum: ['fornecedor'] },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Saúde'],
          summary: 'Liveness do processo HTTP',
          responses: { 200: { description: 'Processo ativo' } },
        },
      },
      '/health/readiness': {
        get: {
          tags: ['Saúde'],
          summary: 'Valida a conexão real com PostgreSQL',
          responses: {
            200: { description: 'Banco disponível' },
            503: { description: 'Banco indisponível' },
          },
        },
      },
      '/api/v1/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Cria fornecedor, workspace e empresa em transação única',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterInput' },
              },
            },
          },
          responses: {
            201: jsonResponse('Conta criada'),
            400: jsonResponse('Entrada inválida'),
            409: jsonResponse('E-mail já cadastrado'),
            503: jsonResponse('Serviço oficial ou banco indisponível'),
          },
        },
      },
      '/api/v1/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Autentica usuário',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginInput' },
              },
            },
          },
          responses: {
            200: jsonResponse('Autenticado'),
            401: jsonResponse('Credenciais inválidas'),
            503: jsonResponse('Serviço indisponível'),
          },
        },
      },
      '/api/v1/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Rotaciona a sessão usando cookie HttpOnly',
          responses: {
            200: jsonResponse('Sessão renovada'),
            401: jsonResponse('Sessão inválida ou expirada'),
            409: jsonResponse('Renovação concorrente'),
            503: jsonResponse('Banco indisponível'),
          },
        },
      },
      '/api/v1/auth/me': {
        get: {
          tags: ['Auth'],
          security: [{ bearerAuth: [] }],
          summary: 'Retorna usuário autenticado',
          responses: {
            200: jsonResponse('Usuário atual'),
            401: jsonResponse('Não autenticado'),
          },
        },
      },
      '/api/v1/licitacoes': {
        get: {
          tags: ['Licitações'],
          security: [{ bearerAuth: [] }],
          summary: 'Pesquisa editais diretamente na fonte oficial PNCP',
          parameters: [
            { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1 } },
            { name: 'tamanhoPagina', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50 } },
            { name: 'uf', in: 'query', schema: { type: 'string', minLength: 2, maxLength: 2 } },
            { name: 'dataInicial', in: 'query', schema: { type: 'string' } },
            { name: 'dataFinal', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: jsonResponse('Resultado oficial paginado'),
            400: jsonResponse('Filtro inválido'),
            429: jsonResponse('Fonte oficial limitou requisições'),
            503: jsonResponse('PNCP indisponível'),
            504: jsonResponse('PNCP excedeu o tempo limite'),
          },
        },
      },
      '/api/v1/empresas': {
        get: {
          tags: ['Empresas'],
          security: [{ bearerAuth: [] }],
          summary: 'Lista empresas do workspace autenticado',
          responses: { 200: jsonResponse('Empresas') },
        },
        post: {
          tags: ['Empresas'],
          security: [{ bearerAuth: [] }],
          summary: 'Cadastra empresa no workspace autenticado',
          responses: {
            201: jsonResponse('Empresa criada'),
            400: jsonResponse('Entrada inválida'),
          },
        },
      },
      '/api/v1/documentos': {
        get: {
          tags: ['Documentos'],
          security: [{ bearerAuth: [] }],
          summary: 'Lista documentos do usuário autenticado',
          parameters: [
            {
              name: 'empresa_id',
              in: 'query',
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: jsonResponse('Documentos'),
            401: jsonResponse('Não autenticado'),
            404: jsonResponse('Empresa não encontrada'),
            503: jsonResponse('Storage indisponível'),
          },
        },
      },
      '/api/v1/documentos/storage-status': {
        get: {
          tags: ['Documentos'],
          security: [{ bearerAuth: [] }],
          summary: 'Informa se o storage privado de documentos está configurado',
          responses: {
            200: jsonResponse('Disponibilidade do storage'),
            401: jsonResponse('Não autenticado'),
          },
        },
      },
      '/api/v1/documentos/upload': {
        post: {
          tags: ['Documentos'],
          security: [{ bearerAuth: [] }],
          summary: 'Envia um documento real ao storage privado',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['arquivo', 'tipo', 'nome', 'empresa_id'],
                  properties: {
                    arquivo: { type: 'string', format: 'binary' },
                    tipo: { type: 'string' },
                    nome: { type: 'string' },
                    empresa_id: { type: 'string', format: 'uuid' },
                    validade: { type: 'string', format: 'date' },
                  },
                },
              },
            },
          },
          responses: {
            201: jsonResponse('Documento armazenado'),
            400: jsonResponse('Entrada inválida'),
            401: jsonResponse('Não autenticado'),
            404: jsonResponse('Empresa não encontrada'),
            413: jsonResponse('Arquivo acima do limite permitido'),
            503: jsonResponse('Storage indisponível'),
          },
        },
      },
      '/api/v1/documentos/{id}': {
        delete: {
          tags: ['Documentos'],
          security: [{ bearerAuth: [] }],
          summary: 'Remove o documento e o respectivo objeto do storage privado',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            200: jsonResponse('Documento removido'),
            401: jsonResponse('Não autenticado'),
            404: jsonResponse('Documento não encontrado'),
            503: jsonResponse('Storage indisponível'),
          },
        },
      },
      '/api/v1/pagamentos/planos': {
        get: {
          tags: ['Pagamentos'],
          summary: 'Lista planos comerciais e o estado da configuração no Mercado Pago',
          responses: {
            200: jsonResponse('Planos comerciais'),
          },
        },
      },
      '/api/v1/pagamentos/checkout-auth': {
        post: {
          tags: ['Pagamentos'],
          security: [{ bearerAuth: [] }],
          summary: 'Cria checkout real no Mercado Pago para o usuário autenticado',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['plano'],
                  additionalProperties: false,
                  properties: {
                    plano: {
                      type: 'string',
                      enum: ['basic', 'pro', 'master'],
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: jsonResponse('Checkout criado'),
            400: jsonResponse('Plano inválido'),
            401: jsonResponse('Não autenticado'),
            502: jsonResponse('Mercado Pago não confirmou a criação do checkout'),
            503: jsonResponse('Mercado Pago indisponível ou não configurado'),
          },
        },
      },
      '/api/v1/pagamentos/assinatura': {
        get: {
          tags: ['Pagamentos'],
          security: [{ bearerAuth: [] }],
          summary: 'Retorna a assinatura real da conta autenticada',
          responses: {
            200: jsonResponse('Assinatura atual'),
            401: jsonResponse('Não autenticado'),
            503: jsonResponse('Banco indisponível'),
          },
        },
      },
      '/api/v1/pagamentos/webhook': {
        post: {
          tags: ['Pagamentos'],
          summary: 'Recebe e valida notificações assinadas do Mercado Pago',
          parameters: [
            {
              name: 'x-signature',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'x-request-id',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'data.id',
              in: 'query',
              required: false,
              description: 'Identificador do recurso; também pode ser enviado em data.id no corpo.',
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['type', 'data'],
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    data: {
                      type: 'object',
                      required: ['id'],
                      properties: {
                        id: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Notificação validada e processada de forma idempotente',
              content: {
                'text/plain': {
                  schema: { type: 'string', example: 'OK' },
                },
              },
            },
            400: jsonResponse('Notificação incompleta'),
            401: jsonResponse('Assinatura do webhook inválida'),
            502: jsonResponse('Falha ao confirmar a assinatura no Mercado Pago'),
            503: jsonResponse('Webhook ou Mercado Pago não configurado'),
          },
        },
      },
    },
  },
  apis: [],
});
