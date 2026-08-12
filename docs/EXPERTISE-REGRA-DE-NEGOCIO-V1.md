# EXPERTISE Licitatória — Regra de Negócio V1

## 1. Visão do Produto

O EXPERTISE Licitatória é uma plataforma de inteligência para empresas que participam de licitações públicas.

O produto deve ajudar o licitante a responder quatro perguntas:

1. Vale a pena participar?
2. Quanto devo ofertar?
3. Quais riscos existem nesta oportunidade?
4. Como devo agir durante a disputa?

O diferencial estratégico do produto é a combinação de:

- dados oficiais;
- precificação inteligente;
- análise de oportunidade;
- monitoramento;
- investigação de padrões de risco;
- inteligência jurídica fundamentada;
- estratégia de participação;
- automação controlada da disputa.

O EXPERTISE nunca deve apresentar dado fictício como dado real.

Quando uma fonte oficial estiver indisponível, o sistema deve informar a indisponibilidade.

Quando uma análise não possuir evidência suficiente, o sistema deve informar baixa confiança ou indisponibilidade da análise.

---

# 2. Princípios do Produto

## 2.1 Dados reais

Toda informação externa utilizada pelo sistema deve possuir:

- fonte;
- identificador externo quando disponível;
- URL de origem quando disponível;
- data/hora de coleta;
- data de publicação quando disponível;
- hash/conteúdo identificável quando aplicável;
- status de atualização.

## 2.2 Rastreabilidade

Toda análise relevante deve conseguir responder:

- qual dado foi utilizado;
- qual fonte forneceu o dado;
- quando o dado foi coletado;
- qual regra foi aplicada;
- qual versão do algoritmo foi usada;
- qual foi o resultado.

## 2.3 Transparência

O sistema nunca deve converter:

- falha de integração em "sem dados";
- ausência de consulta em "sem risco";
- falta de evidência em "baixo risco";
- indisponibilidade de fonte em resultado positivo.

## 2.4 Segurança

Dados privados do usuário devem ser isolados por tenant, usuário, empresa e regras de autorização.

## 2.5 IA fundamentada

A IA deve utilizar evidências recuperadas das fontes disponíveis.

Quando não houver evidência suficiente, deve declarar a limitação.

---

# 3. Planos Comerciais

## 3.1 BÁSICO — R$ 69,99/mês

Objetivo: permitir que o licitante encontre oportunidades e organize sua preparação.

### Recursos

- autenticação;
- cadastro de empresa;
- perfil da empresa;
- Radar de Editais;
- consulta de oportunidades;
- filtros básicos;
- visualização de edital;
- favoritos;
- documentos do licitante;
- controle de validade de documentos;
- alertas básicos;
- histórico das próprias análises;
- comparação básica de preços;
- cálculo simples de margem.

### Restrições

Não possui:

- investigação de cartéis;
- investigação avançada de fraude;
- inteligência investigativa;
- automação avançada de disputa;
- robô automático de lances.

---

# 4. PRO — R$ 149,99/mês

Objetivo: transformar dados em decisão competitiva.

Inclui tudo do BÁSICO mais:

## 4.1 Precificação Inteligente PRO

- histórico de preços;
- preços observados em fontes públicas;
- comparação por similaridade;
- normalização de unidade;
- normalização de quantidade;
- análise regional;
- mediana;
- média;
- percentis;
- identificação de outliers;
- faixa de preço observada;
- preço de referência calculado;
- preço alvo;
- preço mínimo;
- margem;
- confiança da análise;
- quantidade de observações;
- quantidade de fontes utilizadas.

## 4.2 Análise de Oportunidade

Avaliar:

- aderência ao negócio;
- requisitos;
- capacidade documental;
- prazo;
- risco operacional;
- estimativa de competitividade;
- margem potencial;
- disponibilidade de informação.

O sistema não deve produzir uma nota arbitrária.

Toda pontuação precisa estar relacionada a critérios documentados.

## 4.3 Estratégia de Proposta

Permitir:

- preço de custo;
- margem mínima;
- preço mínimo;
- preço alvo;
- preço estratégico;
- simulação de cenários.

## 4.4 Monitoramento

- mudanças na oportunidade;
- alterações de prazo;
- eventos relevantes;
- notificações;
- histórico de alterações.

---

# 5. MASTER — R$ 249,99/mês

Objetivo: fornecer inteligência investigativa e estratégica avançada.

Inclui tudo do PRO mais:

# 5.1 Investigação de Editais

O sistema pode analisar:

- histórico de participantes;
- padrões de preços;
- padrões de participação;
- concentração;
- repetição de participantes;
- comportamento temporal;
- comportamento regional;
- eventos associados;
- histórico disponível dos fornecedores;
- sinais estatísticos;
- sinais cadastrais;
- sanções e impedimentos disponíveis em fontes oficiais.

---

# 5.2 Investigação de Fornecedor

A partir de CNPJ ou identificação disponível:

- identificação;
- histórico de participação;
- histórico de resultados disponíveis;
- órgãos onde participou;
- regiões de atuação observadas;
- categorias observadas;
- histórico de preços disponível;
- sanções;
- impedimentos;
- relações observáveis;
- sinais de risco.

O sistema deve distinguir claramente:

- fato observado;
- inferência;
- hipótese;
- sinal de risco;
- evidência.

O sistema nunca deve afirmar que uma empresa cometeu fraude ou cartel apenas com base em um score automatizado.

---

# 5.3 Radar de Possíveis Cartéis

O motor pode procurar padrões como:

- rodízio recorrente de vencedores;
- participação recorrente das mesmas empresas;
- propostas anormalmente semelhantes;
- padrões repetitivos de preços;
- comportamento recorrente de desistência;
- participação conjunta recorrente;
- concentração anormal;
- padrões temporais;
- padrões geográficos;
- redes de relacionamento observáveis;
- outras anomalias estatísticas documentadas.

Resultado:

- nível de sinal;
- fatores;
- evidências;
- fontes;
- período analisado;
- metodologia;
- confiança.

Terminologia obrigatória:

- "indício";
- "sinal";
- "padrão de risco";
- "possível anomalia".

Evitar afirmações categóricas de ilícito.

---

# 5.4 Radar de Possíveis Fraudes

O motor pode identificar:

- inconsistências cadastrais;
- alterações suspeitas em dados disponíveis;
- padrões incompatíveis;
- comportamentos estatisticamente atípicos;
- sinais de documentação inconsistente;
- histórico de sanções;
- conflitos de dados públicos;
- padrões de participação incompatíveis com o histórico observado.

Toda conclusão deve possuir evidência ou indicar claramente ausência dela.

---

# 5.5 Relatório Investigativo MASTER

Cada sinal deve possuir:

- identificador;
- tipo;
- severidade;
- confiança;
- descrição;
- evidências;
- fonte;
- URL;
- data da coleta;
- regra aplicada;
- versão da regra;
- entidades relacionadas;
- observações;
- status da investigação.

---

# 6. PRECIFICAÇÃO INTELIGENTE

A precificação é um dos principais diferenciais do EXPERTISE.

## 6.1 PriceObservation

Cada observação de preço deve registrar, quando disponível:

- fonte;
- identificador externo;
- contratação;
- item;
- fornecedor;
- descrição original;
- descrição normalizada;
- código CATMAT/CATSER;
- unidade;
- quantidade;
- preço unitário;
- preço total;
- UF;
- município;
- data de publicação;
- data observada;
- URL;
- payload original;
- hash.

## 6.2 PriceAnalysis

Uma análise pode produzir:

- quantidade de observações;
- quantidade de fontes;
- mínimo;
- máximo;
- média;
- mediana;
- P25;
- P75;
- desvio;
- outliers;
- preço de referência;
- faixa competitiva;
- preço alvo;
- preço mínimo;
- confiança;
- versão do algoritmo.

## 6.3 Regras

Nenhum preço deve ser considerado referência apenas porque apareceu uma única vez.

O sistema deve informar:

- tamanho da amostra;
- fontes;
- recência;
- qualidade;
- confiança.

---

# 7. ROBÔ DE LANCES

O robô é uma ferramenta de automação controlada pelo licitante.

## 7.1 Configuração mínima

- licitação;
- portal;
- sessão;
- preço inicial;
- preço limite;
- decremento mínimo;
- estratégia;
- tempo de reação;
- modo de operação;
- status.

## 7.2 Regras de segurança

O robô nunca pode enviar lance abaixo do preço limite definido pelo usuário.

O robô deve bloquear execução quando:

- portal não suportado;
- sessão inválida;
- autenticação inválida;
- oportunidade encerrada;
- dados insuficientes;
- preço mínimo não calculado;
- limite excedido;
- erro de comunicação;
- estado inconsistente.

## 7.3 Estratégias

### Conservadora

Prioriza proteção de margem.

### Competitiva

Busca maior competitividade dentro do limite permitido.

### Agressiva

Busca maior probabilidade de vitória dentro do limite configurado.

### Adaptativa

Usa comportamento observado da disputa, sem ultrapassar as regras configuradas.

O robô nunca altera autonomamente o limite financeiro definido pelo usuário.

---

# 8. FONTES OFICIAIS

O EXPERTISE deve trabalhar com fontes classificadas.

## Núcleo de compras públicas

- PNCP
- Compras.gov.br

## Transparência e sanções

- Portal da Transparência / CGU
- CEIS
- CNEP
- outras bases oficiais disponíveis

## Controle e jurisprudência

- TCU
- outras fontes oficiais de controle quando suportadas

## Referência jurídica

- legislação oficial;
- AGU;
- jurisprudência e documentos oficiais;
- demais fontes institucionais autorizadas.

## Catálogos

- CATMAT
- CATSER

Nenhuma fonte deve ser considerada oficial apenas por possuir o nome de um órgão.

A fonte deve possuir identificação e origem verificáveis.

---

# 9. DATA PLATFORM

Arquitetura:

SOURCE
→ CONNECTOR
→ RAW
→ NORMALIZED
→ DEDUPLICATED
→ MASTER DATA
→ ANALYTICS
→ API
→ FRONTEND

Cada ingestão deve registrar:

- source;
- connector;
- status;
- início;
- término;
- registros vistos;
- registros aceitos;
- duplicados;
- falhas;
- erro;
- cursor;
- última sincronização bem sucedida.

---

# 10. MODELOS PRINCIPAIS

O sistema deve manter, no mínimo, os domínios:

## Identidade

- Tenant
- User
- Company
- Role
- Permission
- UserRole
- RolePermission

## Licitações

- ProcurementNotice
- ProcurementItem
- ProcurementLot
- ProcurementEvent
- ProcurementAttachment
- ProcurementRequirement

## Fornecedores

- Supplier
- FornecedorMarketplace
- SupplierSanction
- SupplierRelation
- InvestigationSignal

## Preços

- PriceObservation
- PriceAnalysis
- PriceOutlier
- PriceReference

## Jurídico

- LegalSource
- LegalDocument
- LegalVersion
- LegalChunk
- LegalRule
- Jurisprudence
- LegalPattern
- LegalCitation

## IA

- AiRun
- AiRetrievalSession
- AiCitation
- DraftEvidence

## Operação

- DataIngestionJob
- DataPipelineEvent
- DataSourceCursor
- SearchIndexTask
- Notification
- Deadline

## Propostas

- Proposal
- ProposalItem

## Automação

- RoboSession
- BiddingPipeline
- BiddingHistory

---

# 11. QUALIDADE DOS DADOS

Cada dado externo deve possuir estado:

- ACTIVE
- STALE
- INVALID
- UNAVAILABLE
- PENDING_REVIEW

Não transformar:

UNAVAILABLE → SEM_RISCO

Não transformar:

NO_DATA → ZERO

Não transformar:

FALHA_DE_INTEGRACAO → SEM_SANCAO

---

# 12. DASHBOARD

Todos os indicadores do dashboard devem possuir origem.

Exemplo:

EDITAIS ATIVOS
→ query real

VALOR TOTAL
→ cálculo real

ÓRGÃOS COMPRADORES
→ cálculo real

TENDÊNCIA
→ comparação com período histórico real

O frontend não pode possuir números de negócio hardcoded.

---

# 13. FEATURE FLAGS

Módulos incompletos devem permanecer controlados.

Estados:

- AVAILABLE
- IN_IMPLANTATION
- INTEGRATION_PENDING
- HIDDEN
- DISABLED

Um módulo IN_IMPLANTATION não deve aparentar estar operacional.

---

# 14. HOMOLOGAÇÃO

Uma funcionalidade só será considerada pronta quando:

Frontend
→ API
→ controller
→ service
→ regra
→ banco/fonte externa
→ resposta
→ frontend

estiverem validados.

---

# 15. REGRA DE OURO

Nenhum dado fictício.

Nenhum número fictício.

Nenhum sucesso falso.

Nenhuma acusação automática de fraude.

Nenhuma conclusão jurídica sem evidência.

Nenhuma integração considerada funcionando apenas porque existe uma variável no .env.

Nenhuma funcionalidade considerada pronta apenas porque a página abre.

---

# 16. ORDEM DE IMPLEMENTAÇÃO

1. Estabilizar banco e migrations sem destruir dados.
2. Configurar RBAC e módulos.
3. Consolidar Data Platform.
4. Tornar PNCP operacional.
5. Tornar Compras.gov operacional.
6. Implementar observações de preço.
7. Implementar Precificação Inteligente.
8. Implementar análise de oportunidade.
9. Implementar monitoramento.
10. Implementar investigação MASTER.
11. Implementar fontes jurídicas e grounding.
12. Implementar estratégia de proposta.
13. Validar robô de lances.
14. Corrigir dashboard.
15. Criar testes de homologação.
16. Validar produção.

---

# 17. CRITÉRIO FINAL DE PRODUTO

O EXPERTISE somente será considerado pronto para homologação quando o usuário conseguir:

LOGIN
→ EMPRESA
→ RADAR
→ EDITAL REAL
→ ITENS
→ PRECIFICAÇÃO
→ ANÁLISE
→ PROPOSTA
→ MONITORAMENTO
→ INVESTIGAÇÃO (MASTER)
→ EXECUÇÃO CONTROLADA

com dados reais, rastreáveis e tratamento transparente de falhas.

