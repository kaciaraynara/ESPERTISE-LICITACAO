# Planejamento de testes de integração de APIs e endpoints

## Objetivo
Garantir que todas as APIs consumidas pela interface estejam funcionando corretamente, com autenticação, permissões, payloads, tratamento de erro e integração ponta a ponta entre frontend e backend.

## Escopo
- Backend: rotas principais em [EXPERTISE/backend/src/routes](../backend/src/routes)
- Frontend: telas e componentes que consomem essas APIs em [EXPERTISE/frontend/src](../frontend/src)
- Ambiente de validação: local de desenvolvimento com backend e frontend rodando

## Estratégia geral
1. Validar saúde do backend e presença de rotas críticas.
2. Testar fluxo de autenticação e sessão.
3. Validar cada módulo de negócio com cenários de sucesso, falha e permissão.
4. Confirmar se a interface consome corretamente os dados retornados.
5. Registrar falhas e bloquear merge ou deploy até correção.

## Prioridades
1. Autenticação e perfil do usuário
2. Busca e leitura de licitações/notices
3. Empresas, usuários e permissões
4. Documentos, uploads e download
5. IA, Lex, impugnações e robôs
6. Pagamentos, assinaturas e notificações
7. Administração e integrações externas

## Plano de execução

### Fase 1 — Base e ambiente
- Confirmar se backend e frontend iniciam sem erros.
- Verificar variáveis de ambiente e conexão com banco/serviços externos.
- Validar endpoints de health e estado do sistema.
- Criar usuário de teste com papel e plano adequados.

### Fase 2 — Autenticação e sessão
Testar:
- registro
- login
- refresh
- logout
- recuperação de senha
- endpoint /me
- atualização de perfil

Critérios:
- token é gerado e reutilizado corretamente
- erros retornam status e mensagem esperados
- frontend mantém sessão sem quebrar após refresh

### Fase 3 — Módulos de negócio principais

#### 3.1 Notices e licitações
Endpoints prioritários:
- /notices/search
- /notices/:id
- /notices/:id/basic-summary
- /notices/:id/summary
- /notices/:id/legal-precheck
- /notices/:id/error-radar
- /notices/:id/opportunity-score
- /notices/:id/proposal-strategy
- /notices/:id/pricing-strategy
- /licitacoes
- /licitacoes/:id
- /licitacoes/monitor

Cenários:
- busca com dados válidos
- busca sem resultado
- plano sem acesso à feature
- payload incompleto
- erro de backend

#### 3.2 Empresas e usuários
Endpoints prioritários:
- /empresas
- /empresas/:id
- /users ou rotas de gestão associadas

Cenários:
- criar empresa com dados válidos
- criar empresa acima do limite do plano
- editar empresa
- listar empresas do usuário correto
- validação de permissões por papel

#### 3.3 Documentos e arquivos
Endpoints prioritários:
- /documentos
- /documentos/upload
- /documentos/:id/download
- /documentos/:id

Cenários:
- upload válido
- upload inválido
- download de arquivo existente
- remoção de documento
- erro de storage

### Fase 4 — IA, Lex e recursos premium
Endpoints prioritários:
- /ai/consultar
- /lex/chat
- /lex/auditar
- /lex/resumo
- /lex/proposta
- /lex/impugnacao
- /lex/recurso
- /impugnacoes/prazo
- /impugnacoes/peca
- /concorrentes/malha-fina
- /concorrentes/:cnpj/dossie
- /robo routes

Cenários:
- fluxo completo de geração de resposta
- tratamento de timeout e erro externo
- bloqueio por plano não habilitado
- resposta consistente para a UI

### Fase 5 — Pagamentos, assinaturas e planos
Endpoints prioritários:
- /pagamentos/planos
- /pagamentos/checkout
- /pagamentos/checkout-auth
- /pagamentos/assinatura
- /pagamentos/webhook

Cenários:
- listar planos
- iniciar checkout
- retorno com sucesso
- webhook com status válido
- webhook inválido
- atualização de assinatura no perfil

### Fase 6 — Notificações, pipeline e CRM
Endpoints prioritários:
- /notificacoes
- /notificacoes/marcar-todas-lidas
- /pipeline
- /pipeline/:id
- /crm/oportunidades
- /crm/metricas

Cenários:
- leitura de notificações
- marcação como lida
- movimentação de oportunidade no pipeline
- atualização de etapa
- métricas corretas no dashboard

### Fase 7 — Administração e integrações externas
Endpoints prioritários:
- /admin/*
- /integracoes/sincronizar/pncp
- /transparencia/*
- /public/cnpj/:cnpj

Cenários:
- acesso autorizado para admin
- acesso negado para usuário comum
- ingestão de dados externos
- retorno de erro de fornecedor externo

## Tipos de testes
- Testes de contrato: validar status, estrutura e tipos de resposta
- Testes de fluxo: simular usuário real navegando a interface
- Testes de permissão: validar 401, 403 e 404 esperados
- Testes de erro: timeout, dados inválidos, falha externa, payload malformado
- Testes de integração UI: garantir que a tela renderiza corretamente os dados recebidos

## Ferramentas sugeridas
- Postman ou Insomnia para testes de API
- Playwright para testes ponta a ponta da interface
- Jest para testes unitários e de middleware
- Console e network do navegador para validar payloads e erros

## Critérios de aceite
A integração está correta quando:
- todas as rotas principais respondem com status esperado
- a interface exibe dados sem quebrar em cenários de sucesso e erro
- permissões e limites de plano funcionam conforme o esperado
- os payloads consumidos pela UI batem com o formato esperado
- falhas são reportadas com mensagem clara e sem comportamento inconsistente

## Cronograma sugerido
- Dia 1: health, auth e sessão
- Dia 2: notices, licitações e empresas
- Dia 3: documentos, IA, Lex e impugnações
- Dia 4: pagamentos, pipeline, notificações e CRM
- Dia 5: integrações externas, admin e regressão final

## Entregável esperado
Um checklist executado para cada módulo, com:
- endpoint testado
- cenário validado
- resultado
- evento de falha, se houver
- responsável e data
