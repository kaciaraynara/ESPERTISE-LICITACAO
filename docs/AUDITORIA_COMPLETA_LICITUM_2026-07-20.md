# Auditoria completa do EXPERTISE SaaS

**Data:** 20/07/2026  
**Escopo:** produto, regras de negócio, arquitetura, backend, frontend, banco de dados, acessos, segurança, qualidade e operação.  
**Estado auditado:** árvore de trabalho local atual, incluindo alterações não commitadas do frontend. Nenhuma alteração existente foi descartada.

## 1. Parecer executivo

O EXPERTISE é uma plataforma SaaS brasileira para apoiar fornecedores em todo o ciclo de compras públicas: descoberta de editais, análise de oportunidade e risco, documentos, formação de preço, proposta, disputa, inteligência concorrencial, suporte jurídico, contábil e marketplace B2B.

O projeto já ultrapassou o estágio de protótipo simples. Há uma API extensa, persistência PostgreSQL/Prisma, ingestão PNCP e Compras.gov, RBAC persistente, auditoria, regras jurídicas versionadas, grounding de IA, propostas, assinaturas, integrações, cron jobs e três jornadas de usuário. O código compila e 212 testes atuais passam (199 backend e 13 frontend).

O produto, entretanto, ainda deve ser classificado como **MVP avançado / beta técnico**, não como SaaS enterprise pronto para operação nacional crítica. Os maiores riscos são: cadeia de dependências vulnerável; instalação limpa que não gera automaticamente o Prisma Client; cobertura quase inexistente das jornadas do frontend; ausência de teste E2E e de banco real no pipeline; módulos apresentados como produto, mas ainda simulados ou parcialmente conectados; bundle monolítico; infraestrutura/observabilidade/recuperação não codificadas; e maturidade insuficiente em LGPD, continuidade operacional e automação de disputa.

### Nota por dimensão

| Dimensão | Nota | Diagnóstico |
|---|---:|---|
| Visão de produto | 8/10 | Proposta de valor forte e ecossistema coerente, mas escopo amplo demais para o estágio atual. |
| Backend e domínio | 7/10 | Boa amplitude e evolução recente; falta endurecimento operacional e teste integrado. |
| Banco e dados | 7/10 | Modelo rico, 45 entidades e plataforma de ingestão; falta provar migrations/constraints em banco limpo e restaurável. |
| Frontend e UX | 6/10 | Interface ampla e consistente; excesso de bundle, simulações, duplicações e pouca validação automatizada. |
| Segurança e LGPD | 5/10 | Bons controles básicos, porém vulnerabilidades críticas/altas e lacunas de governança. |
| Qualidade e testes | 6/10 | Backend razoavelmente testado; frontend e E2E muito abaixo do risco do produto. |
| DevOps/produção | 3/10 | Não há CI visível, Docker/IaC, SLO, tracing, backup/restore documentado ou promoção de ambientes. |
| Prontidão comercial | 5/10 | Adequado para pilotos controlados; inadequado para promessa enterprise ou automação oficial irrestrita. |

## 2. Inventário técnico confirmado

- Frontend: React 18, TypeScript, Vite 5, Tailwind, React Router, React Query, Zustand, React Hook Form, Zod, Framer Motion, Recharts e Socket.IO client.
- Backend: Node.js, TypeScript, Express 4, Prisma 7, PostgreSQL, Socket.IO/WebSocket, cron, Zod, JWT, bcrypt, Stripe, OpenAI/Gemini/Ollama, Supabase Storage, PNCP, Compras.gov e Portal da Transparência.
- Código: 153 arquivos TypeScript no backend, 61 TSX no frontend, 35 páginas, 26 controllers e 58 services não-testes.
- Banco: 45 models, 11 enums e 12 diretórios de migrations Prisma.
- API: 123 declarações `router.get/post/patch/delete/use`, concentradas sob `/api/v1`.
- Testes: 42 arquivos backend e somente 2 frontend.
- Git atual: 25 arquivos rastreados modificados no frontend, cerca de 1.048 inserções e 796 remoções, além de arquivos novos não rastreados.

## 3. O produto e suas regras de negócio

### Perfis e acesso

Há três papéis principais: `fornecedor`, `advogado` e `contador`. O frontend protege grupos de rotas por papel e redireciona cada perfil para sua área. O backend aplica autenticação global após as rotas públicas e combina role middleware, permissões administrativas persistidas e feature flags por plano.

Pontos corretos:

- access e refresh tokens separados;
- cookies HttpOnly previstos para ambos;
- refresh token persistido e revogável;
- senha com bcrypt;
- verificação de papel também no servidor;
- permissões administrativas específicas para auditoria, dados, RBAC e regras legais;
- recursos premium protegidos com `requirePlanFeature`.

Riscos:

- o frontend persiste `isAuthenticated` e usuário no `localStorage`; isso não dá acesso ao backend, mas pode mostrar brevemente uma área privada até o bootstrap falhar;
- não há estado explícito `authLoading`, gerando possível flash/redirecionamento e experiência instável;
- não foi encontrada 2FA/MFA real, gestão completa de sessões/dispositivos ou recuperação de conta com trilha robusta;
- a autorização real deve permanecer exclusivamente no backend; esconder menu não é controle de segurança.

### Licitações e plataforma de dados

O sistema consulta e/ou ingere PNCP e Compras.gov, normaliza fontes, mantém cursor, jobs, eventos, itens, documentos, chunks e tarefas de indexação. Há busca, detalhe, resumo, precheck jurídico, radar de erros, score de oportunidade, estratégia de proposta e estratégia de preço.

É uma boa evolução arquitetural: separa ingestão, normalização, repositório, pipeline, worker, lock distribuído e indexação. Ainda é necessário validar em produção volume, idempotência, reprocessamento, reconciliação, atraso da fonte, limites oficiais, observabilidade e custos. O `LicitacaoCache` legado coexistindo com o domínio novo sugere transição arquitetural; deve haver plano explícito de retirada para evitar duas fontes de verdade.

### IA e jurídico

O LEX oferece chat, auditoria, resumo, proposta e impugnação. A base nova registra runs, fontes, chunks, regras, citações/evidências, confiança, limitações e revisão humana. Regras jurídicas possuem workflow de criação, revisão, aprovação, ativação, versão, histórico e diff.

Isso é superior a prompts sem rastreabilidade. Contudo, saída jurídica não pode ser apresentada como parecer definitivo. Faltam critérios públicos de confiança, suíte de avaliação contra casos reais, taxa de falso positivo/negativo, política de atualização normativa, responsável editorial, bloqueio quando fontes estão vencidas e UX clara de revisão humana.

### Propostas e precificação

Há núcleo persistente de propostas, itens, status, responsável, validade, pagamento, entrega, custo, preço, margem e ligação opcional ao edital. O fluxo de estados é adequado para um primeiro workflow operacional. A calculadora de viabilidade considera custos e estratégia, mas ainda não equivale a previsão de preço vencedor. Toda sugestão deve mostrar premissas, origem dos dados, data de referência e sensibilidade.

### Robô e arena de disputa

Há configuração, lance, logs, toggle, stop-loss e canal em tempo real. O próprio código/documentação indica comportamento simulado. Este módulo não deve ser comercializado como integração oficial automática enquanto não existirem homologação por portal, termos jurídicos, autenticação forte, confirmação transacional, idempotency key, relógio confiável, trilha imutável, kill switch, testes de carga e procedimento de incidente.

### Documentos e contabilidade

Há upload em memória com limite, Supabase Storage, validade documental, expedição/renovação e job de CND. Fornecedor e contador compartilham permissões em partes deste domínio. Faltam antivírus, magic-byte/file signature, quarentena, OCR confiável, versionamento, aprovação, retenção/descarte LGPD e isolamento formal por organização.

### Marketplace e jurídico humano

Existem itens, fornecedores, catálogo/cotação, perfis OAB, casos, mensagens, avaliações e assinatura jurídica. O domínio suporta MVP. Para operação comercial faltam verificação oficial de OAB/CNPJ, moderação, disputa, SLA, responsabilidade, pagamento/repasse, antifraude, reputação resistente a manipulação e termos de marketplace.

### Stripe e planos

Há catálogo de planos, checkout, portal, assinatura, webhook e idempotência de eventos. Um comportamento observado em teste merece revisão: quando a chave Stripe está ausente, uma ação de checkout pode responder como sucesso de demonstração. Isso é aceitável apenas em desenvolvimento explicitamente sinalizado; em produção deve falhar de forma segura e observável.

## 4. Banco de dados

### Estado atual

O schema cobre usuários, empresas, refresh tokens, documentos, notificações, assinaturas, webhooks, auditoria, RBAC, plataforma de dados, fontes/documentos/chunks, execuções de IA, regras legais, análises/evidências, cache, jurídico, marketplace e propostas.

Pontos fortes:

- UUIDs e timestamps com timezone em grande parte do domínio;
- índices compostos para busca e filas;
- relações e `onDelete` geralmente explícitos;
- versionamento e evidência no domínio jurídico/IA;
- tarefas de índice e locks para concorrência;
- migrations incrementais presentes.

Problemas e melhorias:

1. `tenantId` aparece em domínios novos como string opcional, enquanto o núcleo usa usuário/empresa. Falta entidade canônica `Tenant/Workspace`, membership, convite, unidade e política consistente de escopo.
2. Há sinais de dois modelos de licitação: cache legado e plataforma normalizada. Definir autoridade, migração e descontinuação.
3. Não foi executado teste destrutivo de migrations contra PostgreSQL vazio nem restore de backup; build e unit tests não provam integridade de DDL.
4. O fallback JSON é útil localmente e bloqueado por configuração em produção, mas mascara ausência de banco em testes. A suíte precisa de PostgreSQL efêmero/Testcontainers.
5. Revisar constraints de domínio: notas, percentuais, datas, status e valores não devem depender apenas da aplicação.
6. Definir RPO/RTO, PITR, criptografia, rotação de credenciais, segregação de ambientes e teste periódico de restauração.
7. Formalizar retenção, anonimização, base legal e atendimento a titular LGPD por categoria de dado.

## 5. Backend e API

### Organização

A estrutura controllers/services/middlewares é compreensível e os domínios novos estão melhor separados. Porém, `routes/index.ts` tornou-se um roteador monolítico e `app-data.service.ts` acumula responsabilidades de persistência e fallback. Dividir por bounded context e usar repositories explícitos reduzirá acoplamento.

### Segurança implementada

- Helmet e remoção de `x-powered-by`;
- CORS por allowlist com credentials;
- rate limit global, específico para IA e transparência;
- JWT tipado por access/refresh;
- bcrypt;
- cookies HttpOnly/SameSite/Secure conforme ambiente;
- sanitização de metadata sensível;
- RBAC e feature guard;
- tratamento central de erros;
- webhook Stripe com raw body preservado;
- validações Zod em fluxos relevantes.

### Achados de backend

1. **Crítico — supply chain:** `npm ci` reporta 26 vulnerabilidades no backend: 1 crítica, 7 altas, 17 moderadas e 1 baixa.
2. **Alto — bootstrap:** instalação limpa não compilou até executar manualmente `npx prisma generate`. Adicionar `postinstall`/`prebuild` confiável e validar no CI.
3. **Alto — integração real não testada:** testes usam mocks/fallback e não exercitam PostgreSQL, Stripe, Storage, PNCP, Compras.gov ou IA reais em ambiente controlado.
4. **Alto — upload:** memória de processo para arquivo de até 10 MB facilita pressão de memória concorrente; usar streaming/quarentena e limites por usuário/tenant.
5. **Médio — health:** `/health` revela origens CORS. Separar liveness/readiness e não expor configuração; readiness deve checar banco e dependências essenciais.
6. **Médio — observabilidade:** logs estruturados existem em partes, mas faltam trace ID uniforme, métricas RED, tracing, alertas, SLO e captura de exceções.
7. **Médio — API contract:** não há OpenAPI gerado/validado nem versionamento de schemas compartilhados; frontend e backend podem divergir silenciosamente.
8. **Médio — rate limiting:** armazenamento em memória não funciona corretamente em múltiplas instâncias; usar Redis/serviço distribuído e chaves por rota/usuário.
9. **Médio — tarefas internas:** cron e servidor HTTP vivem no mesmo processo; escalar réplicas pode duplicar jobs. Locks ajudam na plataforma nova, mas todos os cron precisam da mesma garantia.
10. **Baixo — encoding:** documentação e comentários exibem mojibake, sinal de inconsistência UTF-8/Windows que prejudica manutenção.

## 6. Frontend, telas e interface

### Mapa funcional

Público: landing principal, fornecedor, advogado e contador; login/cadastro de cada perfil.

Fornecedor: dashboard, licitações/lista/detalhe, sourcing, marketplace, empenhos, ARP, empresa, documentos/cofre, arena/robô, inteligência, jurídico, impugnações, calendário, calculadora, planos, integrações, sentinela fiscal, proposta e transparência.

Advogado: dashboard, workspace e impugnações.

Contador: dashboard, viabilidade e sentinela fiscal.

Comum autenticado: notificações e configurações.

### Pontos positivos

- identidade visual coesa e mais madura que um painel administrativo genérico;
- jornadas separadas por perfil;
- componentes reutilizáveis, feedback por toast e estados de consulta;
- aliases, TypeScript e composição de layouts;
- redirects preservam URLs antigas em parte do produto.

### Problemas de frontend/UX

1. **Crítico — validação insuficiente:** somente 13 testes em 2 arquivos, nenhum teste de componente, rota, formulário, acessibilidade ou E2E.
2. **Alto — bundle:** um único JS de 1.112,07 kB minificado/293,67 kB gzip; as 35 páginas são importadas de forma eager. Aplicar `React.lazy`, chunks por perfil/domínio e orçamento de bundle.
3. **Alto — autenticidade do produto:** várias telas/serviços contêm mock, demo, placeholder ou simulação. Cada tela deve declarar fonte/última atualização e nunca misturar dado real e fictício sem rótulo.
4. **Alto — cofre duplicado:** existem `DocumentosPage` e `VaultPage`, e `/documentos` redireciona para `/licitante/cofre` enquanto `/licitante/documentos` continua ativo. Unificar domínio e navegação.
5. **Médio — auth bootstrap:** ausência de estado de carregamento global e persistência parcial pode causar flash de conteúdo/redirect.
6. **Médio — acessibilidade:** não há suíte axe, auditoria de teclado/leitor de tela, skip link, foco por rota ou política de movimento reduzido comprovada. Animação global por mudança de rota precisa respeitar `prefers-reduced-motion`.
7. **Médio — responsividade:** quantidade de tabelas, kanbans e dashboards exige QA formal em 320/768/1024/1440 px e zoom 200%.
8. **Médio — performance:** gráficos, ícones e motion carregados no shell; medir LCP/INP/CLS e virtualizar listas longas.
9. **Médio — consistência:** há componentes `EnterpriseCard` duplicados em caminhos distintos e calculadoras em dois domínios; consolidar design system.
10. **Médio — SEO/marketing:** Vite SPA limita metadata por landing/perfil e compartilhamento social; avaliar prerender/SSR para páginas públicas, não necessariamente migrar todo o app.

## 7. Testes e validações executadas

| Verificação | Resultado |
|---|---|
| `npm ci` backend | Passou; 650 pacotes; 26 vulnerabilidades. |
| `npm ci` frontend | Passou; 248 pacotes; 15 vulnerabilidades. |
| Build backend após instalação | Falhou porque Prisma Client não foi gerado. |
| `npx prisma generate` | Passou. |
| Build backend após geração | Passou. |
| Testes backend | 42 suítes, 199 testes, todos passaram; cobertura global ~39% statements e ~40% lines. |
| Build frontend | Passou com alerta de chunk >500 kB. |
| Testes frontend | 2 arquivos, 13 testes, todos passaram. |
| Banco PostgreSQL real | Não validado; ambiente não forneceu instância/configuração segura para migration smoke test. |
| Browser/E2E visual | Não validado; não há ambiente completo iniciado com banco e credenciais de integrações. |

Os testes unitários verdes são um bom sinal, mas não validam a operação ponta a ponta. Muitos controllers, rotas, WebSocket, cron jobs e telas permanecem sem cobertura.

## 8. Infraestrutura, operação e governança

Não há workflow CI visível no diretório `.github` do repositório raiz, nem Docker/Compose, Terraform/IaC, configuração de deploy, APM ou runbooks suficientes. Para produção, implementar:

- CI obrigatório: install limpa, Prisma generate, format/lint, typecheck, unit, integration, E2E, migration smoke test, SAST, dependency scan e bundle budget;
- ambientes isolados dev/staging/prod com secrets manager e promoção controlada;
- containers reproduzíveis e infraestrutura como código;
- logs centralizados, métricas, tracing, alertas e dashboards;
- RPO/RTO, backup, restore testado, disaster recovery e incident response;
- feature flags e rollout gradual para IA, ingestão e robô;
- política de atualização de dependências e SBOM.

## 9. Backlog priorizado

### P0 — antes de qualquer produção/piloto com dados reais

1. Corrigir/mitigar as 2 vulnerabilidades críticas e 12 altas totais, revisando breaking changes; registrar exceções com prazo.
2. Tornar instalação/build reproduzíveis (`prisma generate` automático) e criar CI obrigatório.
3. Garantir que demo/fallback/checkout simulado nunca respondam como operação real em produção.
4. Executar migrations do zero e upgrade sobre cópia anonimizada; testar backup/restore.
5. Criar testes E2E para cadastro, login/refresh/logout, empresa, busca/detalhe, documento, assinatura e autorização entre perfis.
6. Revisar uploads: streaming, magic bytes, antivírus, quarentena, rate/quota e autorização de download.
7. Congelar automação de lance real até homologação, auditoria jurídica e controles transacionais.

### P1 — próximo ciclo de 30–60 dias

1. Introduzir Tenant/Workspace/Membership canônico e matriz de autorização documentada/testada.
2. Dividir bundle por rota e perfil; definir limite de performance.
3. Unificar cofre/documentos, calculadoras e componentes duplicados.
4. Separar roteadores e repositories por domínio; reduzir `app-data.service` e retirar cache legado.
5. Testes de integração com PostgreSQL efêmero e contratos das APIs externas.
6. OpenAPI, schemas de contrato e documentação de erros/paginação/idempotência.
7. Acessibilidade WCAG 2.2 AA: teclado, foco, contraste, labels, motion e testes axe.
8. Observabilidade completa e readiness real.

### P2 — 60–120 dias

1. Validar product-market fit por módulo e remover/despriorizar telas com baixa adoção.
2. Benchmark de IA jurídica com gold set, revisão humana e governança editorial.
3. Redis/filas/workers separados, conforme volume comprovado.
4. Retenção/consentimento/DSAR LGPD, DPA, registro de operações e privacy by design.
5. Testes de carga, caos de integrações e degradação controlada.
6. Prerender/SSR das landings e telemetria de funil.

## 10. Recomendação de Product Owner e Scrum Master

O maior problema de produto não é falta de funcionalidade, e sim excesso de superfície antes da comprovação operacional. O roadmap deve deixar de ser organizado por novas telas e passar a ser organizado por resultados:

- **North Star:** oportunidades qualificadas que avançam para proposta por empresa ativa.
- **Ativação:** empresa configurada + primeira busca relevante + primeiro edital salvo/analisado.
- **Valor:** tempo economizado, taxa de proposta concluída, aderência do score, documentos válidos e margem preservada.
- **Retenção:** empresas que voltam semanalmente e operam uma oportunidade real.
- **Confiabilidade:** freshness das fontes, sucesso de ingestão, erro da IA, incidentes e disponibilidade.

Sugestão de épicos: (1) fundação de produção e segurança; (2) jornada licitante ponta a ponta; (3) dados oficiais confiáveis; (4) proposta e documentação; (5) jurídico com evidência; (6) monetização. Advogado, contador, marketplace e robô devem avançar por gates de evidência, não em paralelo irrestrito.

Definition of Done mínima: regra de negócio aceita; autorização testada; unit/integration/E2E proporcionais ao risco; acessibilidade; observabilidade; documentação; migration/rollback; sem dados demo silenciosos; segurança revisada; métrica de produto instrumentada.

## 11. Conclusão

O EXPERTISE tem uma base técnica e uma visão de produto valiosas. A evolução recente em dados, RBAC, auditoria, regras jurídicas, IA fundamentada e propostas é concreta. O caminho correto agora não é aumentar a quantidade de módulos: é transformar os fluxos centrais em operações confiáveis, mensuráveis e juridicamente seguras.

**Veredito:** liberar apenas para desenvolvimento e pilotos controlados, com dados e expectativas explicitamente delimitados. A produção comercial ampla deve aguardar a conclusão dos P0 e evidência dos principais P1.
