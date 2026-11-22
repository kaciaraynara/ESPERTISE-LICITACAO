# Auditoria QA — Persona Licitante
**Data:** 21/11/2026  
**Ambiente:** produção oficial `https://www.expertiselicitatoria.com.br`  
**Conta de teste:** `qa.expertise.teste@example.com` (trial Master de 10 dias, CNPJ de teste `00.000.000/0001-00`)  
**Método:** navegação real no Chromium, inspeção de rede/console, conferência das respostas da API e leitura do código-fonte.  
**Escopo:** todas as 16 ferramentas principais, fluxo de cadastro/login, Radar, Gestão de Disputas, Habilitação, Cofre, Certidões, Precificação, Propostas, Catálogo, Fornecedores, Recursos, Impugnação, Nulidades, Robô de Lances, Disputa ao Vivo, SRP, Pós-Vitória, Contratos, Prazos, Relatórios, Planos, Configurações, Empresa, Integrações, Academia, Fiscal, Concorrência e Inteligência Competitiva.

---

## 1. Veredito executivo

**Nota geral atual: 6,0/10.**

A plataforma tem uma base visual forte, navegação ampla e algumas integrações reais (PNCP, CRM em Prisma, certidões, catálogo, propostas). Ela **ainda não entrega a automação completa prometida** e, antes desta rodada, exibia **falsos positivos de conformidade** que poderiam induzir o licitante a erro grave.

**Pagaria R$ 499 + R$ 99,99 hoje?**  
**Não, ainda não.** O produto está no estágio de “boa plataforma operacional em construção”, não de “operação licitatória automatizada ponta a ponta”. O que já funciona bem vale uma assinatura de entrada (Radar + CRM + cofre + certidões + propostas), mas o pacote anunciado — precificação completa, análise de concorrência real, robô de lances e automação sem intervenção — ainda não está comprovado em produção.

**Depois das correções desta rodada**, a nota sobe para **7,0/10** e o produto passa a ser defensável para um licitante que aceite revisar cada etapa. Para justificar R$ 598,99/mês com tranquilidade, faltam os itens da seção 7.

---

## 2. O que foi testado de fato

| Área | Teste realizado | Resultado |
|---|---|---|
| Cadastro | Fluxo de 3 etapas, CNPJ, confirmação, LGPD | Funciona; checkbox de termos vinha pré-marcado (corrigido) |
| Login | Credenciais inválidas e sessão | Erro claro; sessão persiste |
| Dashboard | KPIs, trilha de 3 passos, oportunidades | Números vêm da base local; sem dados fictícios |
| Radar | Carga inicial, atualização PNCP, busca, filtros, salvar | Carrega 200 editais reais após sincronizar; busca funciona |
| Gestão de Disputas | Item salvo, card, avançar etapa, remover | Persistia, mas card genérico e avanço de etapa inválido (corrigido) |
| Leitor de Editais (Luli) | Abertura, seletor de edital, chat | Interface carrega; seletor demorava a liberar (corrigido) |
| Viabilidade | Score de aderência | Honesto: avisa que não mede concorrência; 100% fora do perfil sem CNAE |
| Precificação | Planilha, DRE, vínculo com edital | Planilha incompleta (corrigida nesta rodada) |
| Propostas | Gerador em 5 etapas | Carrega; geração real não concluída nesta auditoria |
| Catálogo | Estado vazio e cadastro | Estado vazio correto; cadastro não concluído |
| Fornecedores | Estado vazio e formulário | Estado vazio correto |
| Habilitação | Checklist dos 4 pilares | **“Aderência 100%” e “Conforme” sem documentos (corrigido)** |
| Cofre | Métricas, semáforo, upload | Honesto: 0 arquivos, 0 certidões regulares |
| Certidões | Monitoramento e status | Honesto: 0 de 6 regulares |
| Recursos / Defesas | Formulários e prazos | Carregam; sem documento real para processar |
| Impugnação / Nulidades | Formulários e cruzamento | Carregam; funcionalidade profunda não exercitada |
| Robô de Lances | Sala, planilha, portais | Carrega; seletor demorava (corrigido) |
| Disputa ao Vivo | Sessão do edital salvo | Carrega; 1 recurso 404 no console |
| SRP | Buscador e indicadores | 100 registros reais do PNCP |
| Pós-Vitória / Contratos / Prazos | Estados vazios | Corretos e coerentes |
| Relatórios | KPIs e exportação | Números coerentes com o CRM (1 oportunidade) |
| Planos | Trial Master, preços | Trial de 10 dias exibido corretamente |
| Configurações / Empresa | Dados, CNAE, certificado | Erros 400 com CNPJ de teste; degradação aceitável |
| Integrações / Academia / Fiscal | Carregamento | Carregam; Fiscal ainda sem documento real |

---

## 3. Achados críticos (P0) — risco de desclassificação ou perda de confiança

### 3.1 Habilitação exibia conformidade fictícia
**Evidência:** a tela mostrava “Aderência 100%” e “Conforme” para contrato social, procuração, CND Federal, FGTS, CNDT, certidões estaduais/municipais e certidão de falência, mesmo com **0 documentos no Cofre** e **0 de 6 certidões regulares**.  
**Risco:** o licitante acredita estar habilitado e é desclassificado.  
**Correção aplicada:** o checklist agora consulta `GET /documentos` e `GET /certidoes`; cada item recebe status **Regular**, **Enviado**, **Cadastrado**, **Atenção** ou **Pendente**. O percentual passou a ser “X de Y itens com evidência”, com aviso explícito de que a plataforma não valida o conteúdo jurídico.

### 3.2 CRM com dados fictícios em código morto
**Evidência:** `backend/src/controllers/crm.controller.ts` continha `opp-01`, valores de R$ 2,45 mi e taxa de conversão de 32,4% inventados. Não estava montado, mas violava a regra de negócio.  
**Correção aplicada:** conteúdo substituído por registro de depreciação; a fonte oficial é `pipeline.controller.ts` com Prisma.

### 3.3 Avançar etapa do CRM enviava etapa inválida
**Evidência:** o frontend enviava `SESSAO_PUBLICA`, `FASE_RECURSAL` e `ADJUDICACAO`, que não existem no enum aceito pelo backend (`OPORTUNIDADE`, `MAPEAMENTO`, `ANALISE`, `PROPOSTA`, `DISPUTA`, `RECURSO`, `ADJUDICADO`, `GANHO`, `PERDIDO`, `DESCLASSIFICADO`, `ARQUIVADO`). O erro era engolido sem aviso.  
**Correção aplicada:** mapa explícito de coluna visual → etapa real do backend, com toast de erro e estado de carregamento. O card também passou a exibir objeto, órgão, valor e UF reais.

### 3.4 Consentimento LGPD pré-marcado
**Evidência:** no passo 3 do cadastro, o checkbox de Termos/LGPD já vinha marcado.  
**Risco:** consentimento não afirmativo, fragilidade jurídica.  
**Correção aplicada:** checkbox inicia desmarcado e o botão “Finalizar e entrar” só libera após o aceite.

---

## 4. Achados altos (P1)

### 4.1 Planilha de custos incompleta
A tela de Precificação só tinha custo direto, percentual indireto, impostos e margem. **Não havia** pró-labore, reserva da empresa, funcionários, viagem/estadias, fabricação e manutenção do software — exatamente os itens pedidos.  
**Correção aplicada:** novos campos fixos por proposta, somados ao custo antes de impostos e margem; DRE detalhado; backend valida cada valor e devolve o breakdown. A frase “garante X% de lucro” foi trocada por “margem alvo estimada, não garantida”.

### 4.2 Seletor de editais bloqueava a tela
Luli, Impugnação e Robô de Lances exibiam “Carregando editais salvos...” enquanto cinco fontes eram consultadas em sequência.  
**Correção aplicada:** o seletor libera assim que os editais salvos chegam e anexa as demais fontes em segundo plano.

### 4.3 Viabilidade sem onboarding de CNAE
Com uma empresa nova, a tela mostra 100 editais e “0 alta aderência / 100 fora do perfil”, sem explicar que faltam CNAEs.  
**Recomendação:** banner “Complete seus CNAEs em Minha Empresa” e ação de um clique. Ainda pendente.

### 4.4 Radar começa em 0
A primeira carga usa a palavra-chave do ramo da empresa; se não houver edital local com esse termo, mostra 0 sem explicar.  
**Recomendação:** mensagem “Nenhum edital local para ‘X’. Atualizar editais busca no PNCP” e botão de limpar filtro. Ainda pendente.

---

## 5. Achados médios (P2)

- Título da aba do navegador é genérico em quase todas as páginas (“Radar PNCP e documentos”).
- Dashboard exibe “Rascunho salvo • Agora” mesmo sem conteúdo no gerador de propostas.
- Configurações e Minha Empresa retornam 400 com CNPJ de teste; a tela degrada, mas o erro não é explicado ao usuário.
- Disputa ao Vivo registra um 404 de recurso estático no console.
- SRP exibe “Processo / PNCP: 12” em alguns registros, o que parece truncamento do identificador.
- “Relatórios” mostra “0 vitórias em 1 processos” — correto, mas o plural precisa de ajuste.

---

## 6. Sensação de uso (persona)

**Primeiras impressões:** visual profissional, paleta consistente, sensação de produto sério. O cadastro em 3 etapas é rápido e o dashboard orienta bem.

**Atritos:** a navegação principal é só de ícones com tooltip; leva tempo para descobrir onde fica cada ferramenta. Vários módulos abrem em estado vazio sem explicar o próximo passo. A sensação é de “muitas portas, alguns cômodos ainda sem mobília”.

**Confiança:** antes das correções, a Habilitação “100% conforme” sem documentos destruía a confiança. Depois da correção, a plataforma passa a dizer a verdade: mostra o que falta e onde resolver.

**Automação:** o Radar e o CRM são os pontos mais fortes. A promessa de “tudo automatizado” ainda não se sustenta: há etapas manuais em precificação, proposta, habilitação e disputa.

---

## 7. O que falta para justificar R$ 499 + R$ 99,99

1. **Precificação com dados reais do edital**: importar itens, quantidades e custos do catálogo; ratear custos fixos por item; alertar inexequibilidade item a item.
2. **Proposta ponta a ponta**: gerar documento, validar declarações, anexar certidões e exportar em PDF com trilha de auditoria.
3. **Concorrência real**: usar dados de contratos e participantes do PNCP; deixar claro o que é histórico e o que é estimativa.
4. **Robô de lances com limites e failsafe**: teto, piso, redução mínima, parada automática e log de cada lance; integração oficial ou semiautomática declarada.
5. **Habilitação com evidência documental**: feito nesta rodada; falta validar conteúdo e validade contra o edital.
6. **Onboarding guiado por CNAE**: para o score e o Radar fazerem sentido no primeiro acesso.
7. **Trilha de auditoria visível**: quem mudou o quê, quando e com qual documento.
8. **Testes automatizados dos fluxos críticos**: 6 suítes ainda falham na base.

---

## 8. Correções aplicadas nesta rodada

- Habilitação baseada em evidências reais (documentos + certidões), com status honestos e aviso legal.
- Remoção dos dados fictícios do CRM legado.
- Mapa correto de etapas do Kanban, com erro visível e card com dados reais.
- Consentimento LGPD afirmativo no cadastro.
- Planilha de custos completa (pró-labore, empresa, funcionários, viagem/estadias, fabricação, manutenção, administrativas).
- Backend valida e devolve o breakdown dos custos.
- DRE detalhado e linguagem sem promessa de lucro garantido.
- Seletor de editais liberado antes das fontes secundárias.
- Tipos do contrato de formação de preço atualizados.

---

## 9. Limites desta auditoria

- Não foi concluída uma geração real de proposta oficial nem um envio de lance.
- Não foram testados uploads reais de PDF/imagem, OCR ou assinatura.
- Os 4 anexos de imagem enviados anteriormente não puderam ser lidos neste ambiente.
- A conta usada é de teste, com CNPJ inválido; integrações que dependem de CNPJ real (Receita, certidões, SICAF) não puderam ser validadas ponta a ponta.
- O julgamento de preço é uma opinião de produto baseada no que foi testado, não uma pesquisa de mercado.

---

## 10. Recomendação final

Manter a plataforma em produção e comunicar com honestidade o que está pronto e o que é assistido. Para o preço anunciado, o discurso deve ser “operação assistida com evidências”, não “automação total”. A próxima rodada deve priorizar: precificação item a item, geração de proposta com PDF, concorrência com fonte declarada e testes dos fluxos críticos.

---

## 11. Rodada de estabilização do Radar e escalabilidade (21/11/2026)

### O que foi corrigido

- **Radar ao vivo com 1 requisição por consulta**: a busca de propostas abertas passou a usar apenas a primeira página do PNCP (`fast`), em vez de sondar a primeira e as duas últimas páginas. O tempo caiu de ~3 s para ~1,2 s por consulta e o consumo da API pública foi reduzido em ~66%.
- **Cache de 45 s + single-flight**: consultas idênticas compartilham a mesma promessa em andamento. Em teste local, 20 chamadas simultâneas com o mesmo filtro concluíram em ~4,2 s e retornaram exatamente a mesma lista, sem 20 requisições ao PNCP.
- **Semáforo global de 4 chamadas simultâneas ao PNCP**: protege a fonte pública quando muitos filtros distintos chegam ao mesmo tempo. Configurável por `PNCP_MAX_CONCORRENTE`.
- **Fallback do Compras.gov.br só quando necessário**: o Compras.gov.br deixou de ser chamado em paralelo em toda abertura do Radar. Ele só entra quando o PNCP falha ou não retorna nenhuma proposta aberta, e o aviso na tela diferencia “PNCP indisponível” de “PNCP não retornou propostas para estes filtros”.
- **Filtros de UF, órgão, termo e “Menor Porte”** passaram a ser aplicados no backend, com normalização de acentos. O rótulo “Baixa Procura (Iniciantes)” foi substituído por “Menor Porte (até R$ 80 mil)”, que descreve um critério verificável em vez de uma inferência sem dados de concorrência.
- **Contador honesto**: `meta.totalRegistros` agora é exatamente a quantidade de editais abertos exibidos, não o total bruto do PNCP (que inclui contratações encerradas).
- **Health de Integrações**: as sondagens de PNCP e Compras.gov.br usavam `tamanhoPagina=1` e datas fixas no passado, gerando 400/404 falsos. Passaram a usar os mesmos parâmetros e janelas válidas das integrações reais.
- **CRM**: a etapa `HABILITACAO` foi incluída no enum do backend, permitindo avançar a oportunidade de “Sessão pública” para “Habilitação” sem erro 400.

### Limite conhecido e declarado

- O PNCP **não oferece busca por palavra-chave** na API de contratações. O Radar ao vivo examina as 50 propostas abertas mais recentes e aplica o termo localmente. Quando o termo não aparece nessa janela, a tela informa que nenhuma contratação aberta foi encontrada para os filtros e o frontend tenta a base local. Para busca textual ampla, é necessário manter a base local sincronizada; isso deve ser comunicado ao usuário, não vendido como “busca em todo o PNCP”.

### Veredito após a estabilização

- **Nota permanece 7,0/10.** O Radar ficou mais rápido, honesto e seguro para picos, mas a busca textual ampla, a precificação item a item, a proposta em PDF e a concorrência com fonte declarada continuam pendentes.
- **Pagaria R$ 499 + R$ 99,99 hoje?** Ainda não. O produto é defensável como operação assistida (Radar + CRM + cofre + certidões + propostas), mas o pacote prometido ainda não sustenta o preço premium sem as entregas da seção 7.

