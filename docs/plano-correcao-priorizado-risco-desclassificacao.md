# Plano de correção priorizado — risco de desclassificação

Data: 2026-11-21  
Critério de priorização: **risco de desclassificação / erro documental**, não ordem de tela.  
Ponto de restauração: `%TEMP%\opencode\expertise-backup-20261121-142757`.

> Não prometemos “zero erro” literal. O objetivo é eliminar falsos sinais de sucesso,
> bloquear emissão quando há risco, registrar trilha de auditoria e exigir revisão humana.

## P0 — Corrigido nesta rodada (bloqueio de desclassificação)

| # | Risco | Correção | Arquivos |
|---|---|---|---|
| P0.1 | Preço abaixo do custo era sinalizado como “Exequível”; preço ausente era substituído pelo valor do edital | Cálculo agora distingue preço não informado (amarelo), ≤ custo (vermelho), abaixo do piso de 10% (amarelo) e verde somente acima do mínimo | `backend/src/services/proposal.service.ts`, `backend/src/services/proposal-pricing.test.ts` |
| P0.2 | Documento oficial podia ser gerado com item inexequível sem explicação de diligência | Mensagem de bloqueio passa a orientar ajuste de preço ou documentação de estrutura de custos para diligência (Art. 59, §§ 2º e 4º, Lei 14.133/21; Súmula 262/TCU) | `backend/src/services/proposal.service.ts` |
| P0.3 | Declarações obrigatórias podiam ficar falsas por `default(false)`; acessibilidade e ME/EPP não eram checadas | `validateCompliance` agora exige declaração de acessibilidade e alerta sobre ME/EPP | `backend/src/services/proposal.service.ts` |
| P0.4 | Rotas de cálculo/geração de proposta estavam antes do auth e sem limite de plano | Rotas movidas para depois do auth, com role `fornecedor` e `requirePlanLimit('proposals')` | `backend/src/routes/index.ts` |
| P0.5 | `GET /propostas/:id/documento` gerava documento oficial via GET (efeito colateral) | Rota removida; cliente usa `POST`. Método `obterDocumento` removido do `api.ts` | `backend/src/routes/index.ts`, `frontend/src/services/api.ts` |
| P0.6 | Botão “com estes preços” gerava proposta sem enviar a planilha calculada | Frontend envia `formacaoPreco`; backend distribui `precoSugerido` pelos itens reais, respeitando custo direto e bloqueando status INVIÁVEL | `frontend/src/pages/Precificacao/PrecificacaoPage.tsx`, `frontend/src/services/api.ts`, `backend/src/controllers/lex.controller.ts` |
| P0.7 | Erro de cálculo aparecia como R$ 0,00 e o botão continuava habilitado | Banner de erro com retry, botão bloqueado, valores exibidos como “—” até cálculo válido, validação de entradas | `frontend/src/pages/Precificacao/PrecificacaoPage.tsx` |
| P0.8 | Catálogo com erro de API parecia catálogo vazio | Estado de erro explícito, mensagem e retry | `frontend/src/pages/Catalogo/CatalogoPage.tsx` |
| P0.9 | Custo interno de fornecedor era exposto no mercado e `0` virava `null` | `custoBase` não é exposto em `/catalogo/mercado`; parsing de valores usa `parseMoney` e aceita zero | `backend/src/controllers/catalogo.controller.ts` |
| P0.10 | Viabilidade aceitava alíquotas/margens fora de faixa e podia dividir por número artificial | Intervalos 0–100, soma impostos+margem < 100, validação de estimativa, alinhamento de `margemSaudavel` a 12% | `backend/src/services/viabilidade.service.ts`, `backend/src/controllers/precificacao.controller.ts` |
| P0.11 | Rede de fornecedores gravava no `localStorage` antes da API e silenciava falhas | API passa a ser fonte da verdade; `toast` de erro/sucesso; CNPJ inválido não recebe sentinela | `frontend/src/pages/RedeFornecedoresPage.tsx` |
| P0.12 | Edição de item da proposta aceitava qualquer payload | Schema `updateProposalItemSchema` valida número, faixas e aliases do frontend antes de persistir | `backend/src/shared/validations/proposal.validation.ts`, `backend/src/controllers/propostas.controller.ts` |

## P1 — Corrigido nesta rodada (expectativa enganosa / dados fictícios)

| # | Risco | Correção | Arquivos |
|---|---|---|---|
| P1.1 | “BAIXA” no score parecia “baixa procura/concorrência”, mas media apenas aderência CNAE/UF/prazo/valor | Textos renomeados para aderência; aviso explícito de que o score não mede lances/participantes | `frontend/src/pages/ScoreOportunidades/ScoreOportunidadesPage.tsx` |
| P1.2 | Modal LEX exibia números e alertas fixos (~18%, 12 dias, R$ 4.2M, “1 alerta crítico”, veredito) como se fossem reais | Removidos; estados agora informam ausência de dados verificáveis; resumo passa a vir da API `lexApi.resumo` | `frontend/src/components/juridico/LexViabilidadeModal.tsx` |
| P1.3 | Chat do edital tinha botão que não fazia nada | Substituído por estado honesto de funcionalidade indisponível | `frontend/src/components/juridico/LexViabilidadeModal.tsx` |

## P2 — Pendente (requer decisão/dados reais antes de implementar)

| # | Item | Por que não foi implementado agora |
|---|---|---|
| P2.1 | “Licitação com baixa procura” como filtro real | Não existe dado confiável de quantidade de lances/participantes no fluxo atual. Implementar com dado estimado geraria nova falsa precisão. É necessário definir fonte oficial e revisitá-la em contrato com o PNCP. |
| P2.2 | Planilha de custos completa com pró-labore, dinheiro da empresa, funcionários, viagem/estadias, fabricação e manutenção de software | Hoje a planilha cobre produto/serviço, impostos, operacional e margem. Os demais rubricas precisam de modelo contábil/fiscal definido com o cliente para não virar número inventado. |
| P2.3 | Corrigir as 6 suítes em falha da linha de base | Falhas prévias em `licitacoes.service`, `notices-summary.service`, `pncp.service`, `source-registry`, `ai.service` e `lex-integration`. Não são regressões desta rodada e exigem trabalho específico. |
| P2.4 | Interpretar os 4 anexos de imagem enviados pelo cliente | Este ambiente não consegue ler/imagem nem concluiu OCR nativo. É necessário que o cliente transcreva os pontos ou forneça PDF/texto. |
| P2.5 | Publicar/enviar/excluir/deploy | Push para o GitHub e deploy automático da Vercel executados em 2026-11-21. O Render ainda está com build antigo e exige Deploy Hook ou reconexão do serviço. Nenhuma exclusão foi executada. |

## Ambiente de produção (Vercel + Render + Neon + Cloudflare)

Auditoria e publicação em 2026-11-21:

- Domínio oficial: **`https://www.expertiselicitatoria.com.br`** (apex redireciona para `www`, HTTPS válido).
- `https://espertise-licitacao.onrender.com/api/v1/health` → **200**.
- `https://espertise-licitacao.onrender.com/api/v1/health/readiness` → **200** (`status: ready`), confirmando conexão Render → Neon.
- Proxy da Vercel em `/api/v1/*` → **200**.
- CORS validado para `expertiselicitatoria.com.br`, `www` e `*.vercel.app` → **204** com origem correta.
- Repositório GitHub: **`kaciaraynara/ESPERTISE-LICITACAO`**, branch `main`.
- Commit publicado: **`7392766`** — `fix: exequibilidade, compliance, propostas e URLs de producao`.
- **Vercel: deploy automático confirmado.** O bundle mudou para `index-q4Yn7XpL.js` e o fallback de produção agora é `.../api/v1`.
- **Render: build antigo.** O `/health` publicado ainda responde `{"status":"ok","uptime":...}` (sem `service: "expertise-api"`), embora o commit enviado contenha esse campo. O serviço reiniciou, mas não aplicou o `main` deste repositório.
- Scripts criados: `scripts/publicar-github.ps1`, `scripts/atualizar-render.ps1` e `scripts/verificar-producao.ps1`.

### Ação necessária no Render

O deploy automático do Render só funciona se o serviço estiver conectado a este repositório e com Auto-Deploy ligado. Duas opções:

1. **Reconectar o serviço** em Render → serviço `espertise-licitacao` → Settings → Build & Deploy → Repository `kaciaraynara/ESPERTISE-LICITACAO`, branch `main`, Auto-Deploy **On**.
2. **Informar o Deploy Hook** (Render → serviço → Settings → Deploy Hook) e executar:
   `powershell -ExecutionPolicy Bypass -File scripts/atualizar-render.ps1 -DeployHookUrl "<URL_DO_HOOK>"`
   O script dispara o deploy e espera o `/health` passar a retornar `service: "expertise-api"`.

### Pontos de atenção antes de novas migrations

1. Confirmar no Render: `DATABASE_URL` (pooler Neon), `DIRECT_URL` (conexão direta para migrations), `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`.
2. Confirmar na Vercel: `VITE_API_URL=https://espertise-licitacao.onrender.com/api/v1` (o build atual já contém esse valor).
3. Confirmar na Cloudflare: DNS/proxy do domínio e credenciais R2 (`S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`).
4. Fazer snapshot/backup do Neon antes de qualquer migration.
5. `render.yaml` hoje só define `NODE_ENV`; avaliar `healthCheckPath: /api/v1/health/readiness` e `preDeployCommand: npm run migrate` — **não alterado sem confirmação**.
6. Rodar `scripts/verificar-producao.ps1` após cada deploy; ele falha se o backend estiver desatualizado, se o bundle voltar ao fallback sem `/v1` ou se o domínio/CORS quebrar.

## Validação executada

- `backend`: `npm run build` ✅.
- `frontend`: `npm run build` (TS + Vite + SSR + prerender) ✅.
- `admin-frontend`: `npm run build` (TS + Vite) ✅.
- `backend`: suíte completa → **6 suítes / 12 testes falhando**, idêntico à linha de base; **5 testes novos passando** (`proposal-pricing.test.ts`).
- `e2e-endpoints`: passou isolado e na repetição da suíte completa; a falha pontual na primeira rodada foi instabilidade, não regressão confirmada.
- Push para `kaciaraynara/ESPERTISE-LICITACAO` concluído; Vercel fez deploy automático e o bundle novo foi validado em produção.
- Render ainda não aplicou o commit; verificação de produção acusa essa divergência.
- Nenhuma exclusão, migration ou alteração de banco foi executada.
