# Plano de entrega total da Expertise até quarta-feira

## Objetivo
Entregar a Expertise como uma plataforma SaaS operacional, com todos os módulos principais funcionando com dados reais ou fluxo real, usando Neon como banco principal, Vercel para o frontend e AWS para o backend, sem desativar funcionalidades essenciais.

## Premissas de execução
- A entrega será feita em modo de corrida, com foco absoluto em prioridade, integração e validação.
- O objetivo não é acabamento visual premium, mas sim estabilidade, funcionamento real e valor percebido pelo cliente.
- A IA deve atuar como assistente de contexto e análise, não como substituto do fluxo operacional.
- O lançamento precisa ser feito com o núcleo completo funcionando, mesmo que algum módulo avançado fique em modo de validação parcial.

## Escopo total de entrega
### 1. Base operacional
- Backend subindo corretamente
- Frontend carregando corretamente
- Neon funcionando como banco principal
- Health checks e readiness funcionando
- Logs e erros visíveis
- Variáveis de ambiente corretas em produção

### 2. Autenticação e conta
- Cadastro de usuário
- Login
- Recuperação de acesso
- Perfil de empresa
- Vinculação usuário ↔ empresa

### 3. Empresa e dados cadastrais
- Cadastro empresarial completo
- CNPJ e dados oficiais
- Segmento / CNAE / perfil de atuação
- Histórico operacional da empresa

### 4. Oportunidades e licitações
- Busca de licitações
- Detalhes do edital
- Score de aderência
- Resumo executivo
- Risco e oportunidade

### 5. Compliance e documentos
- Upload de documentos
- Organização documental
- Checklist obrigatório
- Prazos e vencimentos
- Pendências e alertas

### 6. Estratégia e proposta
- Estratégia de participação
- Proposta inicial
- Análise comparativa
- Evidências e justificativas

### 7. Jurídico e análise
- Revisão legal básica
- Identificação de riscos
- Resumo de regras aplicáveis
- Alertas de nulidade e risco

### 8. IA assistente
- Busca contextualizada de informações
- Resumo de edital
- Sugestão de próximos passos
- Resposta baseada em dados reais do sistema

### 9. SaaS e planos
- Planos separados
- Permissões por plano
- Acesso a módulos conforme assinatura
- Cobrança / assinatura funcional
- Controle de limites por plano

### 10. Operação e confiança
- Notificações
- Auditoria
- Logs
- Monitoramento básico
- Tratamento de erro e fallback

---

## Critical path
A linha crítica para quarta-feira é esta:
1. Corrigir build e estabilizar backend
2. Conectar corretamente o Neon
3. Habilitar autenticação real
4. Fazer fluxo empresa e dashboard
5. Integrar busca de licitações
6. Integrar documentos e compliance
7. Integrar planos e assinatura
8. Validar ponta a ponta no ambiente de produção

---

## Plano por fase

### Fase 1 — Estabilização técnica (hoje)
Objetivo: colocar a plataforma de pé.

#### Tarefas
- Corrigir os erros de build do backend
- Ajustar compatibilidade do TypeScript e do Prisma
- Validar o schema do Prisma contra o Neon
- Garantir migrations e seed corretos
- Validar que a API sobe e responde
- Garantir health checks e readiness
- Validar variáveis de ambiente de produção

#### Entregáveis
- Backend com build verde
- API respondendo no ambiente
- Banco Neon acessível pela aplicação
- Logs funcionando

#### Critério de sucesso
- O backend sobe sem erro
- O endpoint de health responde corretamente
- A aplicação consegue consultar o banco

---

### Fase 2 — Fluxo core do usuário (hoje e amanhã)
Objetivo: deixar a experiência principal funcional.

#### Tarefas
- Cadastro e login
- Criação e vínculo de empresa
- Dashboard com contexto de empresa
- Busca de oportunidades
- Visão detalhada do edital
- Score de aderência
- Resumo executivo

#### Entregáveis
- Usuário entra e vê um painel útil
- O sistema mostra oportunidades compatíveis
- O usuário consegue entender se vale a pena participar

#### Critério de sucesso
- Um usuário real consegue fazer login, entrar, criar empresa e visualizar oportunidades

---

### Fase 3 — Compliance e documentos (amanhã)
Objetivo: transformar a plataforma em ferramenta operacional.

#### Tarefas
- Upload de documentos
- Organização por tipo e status
- Checklist obrigatório
- Vencimentos e prazos
- Alertas de pendência

#### Entregáveis
- O usuário consegue armazenar e visualizar documentos
- O sistema mostra o que falta para cumprir requisitos

#### Critério de sucesso
- O licitante consegue enxergar o estado documental da empresa e os próximos passos

---

### Fase 4 — Estratégia e decisão (amanhã)
Objetivo: tornar a plataforma útil para ganhar licitações.

#### Tarefas
- Estratégia de participação
- Proposta inicial
- Análise de risco
- Evidência jurídica básica
- Sugestão de ação

#### Entregáveis
- O usuário recebe uma recomendação prática de decisão

#### Critério de sucesso
- O sistema ajuda a decidir participar, participar com cautela ou não participar

---

### Fase 5 — IA assistente (amanhã e até quarta)
Objetivo: deixar a IA atuando como assistente real.

#### Tarefas
- Buscar contexto no banco
- Resumir editais
- Responder perguntas do usuário
- Sugerir próximos passos
- Conectar com dados da empresa e oportunidades

#### Entregáveis
- A IA responde com base no sistema e não só com dados genéricos

#### Critério de sucesso
- O usuário consegue usar a IA para obter contexto útil sobre uma oportunidade

---

### Fase 6 — SaaS, planos e cobrança (até quarta)
Objetivo: transformar em produto comercial.

#### Tarefas
- Definir planos básico, profissional e enterprise
- Ajustar permissões por plano
- Habilitar acesso a módulos conforme assinatura
- Integrar cobrança e assinatura
- Exibir estado da assinatura no painel

#### Entregáveis
- O sistema se comporta como um SaaS real, com separação de valor por plano

#### Critério de sucesso
- O usuário vê que o plano define o alcance do produto

---

### Fase 7 — Validação final e go-live (até quarta)
Objetivo: garantir consistência e confiança.

#### Tarefas
- Teste completo de fluxo real
- Login → empresa → oportunidade → documento → estratégia
- Teste de planilhas e permissões
- Teste de erro e fallback
- Deploy final em Vercel e AWS
- Verificação final de produção

#### Entregáveis
- Versão pronta para uso real
- Fluxo operacional validado

#### Critério de sucesso
- Um usuário consegue percorrer o produto completo sem falhas críticas

---

## Prioridade absoluta
### P1 — Bloqueadores
- build do backend
- conexão com Neon
- autenticação
- empresa e dashboard
- fluxo principal do usuário

### P2 — Valor real
- edital e análise de oportunidade
- documentos e compliance
- IA assistente
- planos e assinatura

### P3 — Refinamento
- notificações avançadas
- auditoria elegante
- painéis mais completos
- usabilidade fina

---

## Arquitetura de execução
### Trabalho em paralelo
- Backend: correção de build, Prisma, rotas, fluxo core
- Frontend: telas principais, estado de autenticação, integração com API
- Dados: schema, seed, dados iniciais, integração com Neon
- Produto: fluxo de usuário, mensagens, onboarding, planos
- Operação: logs, health, deploy e validação

### Regras de execução
- Nenhuma tarefa pode ficar isolada sem validação funcional
- Toda nova feature precisa ser testada em fluxo real
- Nenhuma feature pode depender de dados fake para ser considerada pronta
- Se uma dependência externa falhar, o sistema deve informar isso de forma clara

---

## Checklist de go-live
- [ ] Backend compila e sobe
- [ ] Neon está acessível
- [ ] Login funciona
- [ ] Cadastro de empresa funciona
- [ ] Dashboard carrega informações reais
- [ ] Busca de licitações funciona
- [ ] Detalhes de edital funcionam
- [ ] Upload de documentos funciona
- [ ] Checklist de compliance funciona
- [ ] IA assistente responde com contexto
- [ ] Planos e assinatura funcionam
- [ ] Notificações funcionam
- [ ] Logs e monitoramento básicos funcionam
- [ ] Deploy final está estável

---

## Estratégia de execução para quarta
### Hoje
- estabilizar backend e banco
- garantir fluxo login e empresa

### Amanhã
- entregar oportunidades, documentos e compliance
- deixar IA assistente operando

### Até quarta
- fechar planos, assinatura e validação geral
- publicar versão completa e estável

---

## Resumo executivo
A entrega total até quarta é possível se a operação for conduzida com disciplina extrema:
- estabilizar primeiro;
- entregar o fluxo principal;
- integrar o valor real do produto;
- validar tudo em ambiente real;
- publicar só quando o core estiver sólido.

Essa é a melhor forma de transformar a Expertise em um SaaS de verdade, com todos os pilares funcionando e prontos para uso real.
