CREATE TABLE IF NOT EXISTS "legal_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "legal_basis" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "criteria" JSONB NOT NULL,
    "alert_message" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "legal_rules_code_version_tenant_id_key" ON "legal_rules"("code", "version", "tenant_id");
CREATE INDEX IF NOT EXISTS "legal_rules_tenant_id_idx" ON "legal_rules"("tenant_id");
CREATE INDEX IF NOT EXISTS "legal_rules_category_severity_idx" ON "legal_rules"("category", "severity");
CREATE INDEX IF NOT EXISTS "legal_rules_active_idx" ON "legal_rules"("active");
CREATE INDEX IF NOT EXISTS "legal_rules_version_idx" ON "legal_rules"("version");

INSERT INTO "legal_rules" (
    "code",
    "name",
    "description",
    "severity",
    "category",
    "legal_basis",
    "version",
    "active",
    "criteria",
    "alert_message",
    "recommendation",
    "metadata"
) VALUES
(
    'short_deadline',
    'Prazo curto para preparacao',
    'Identifica quando a data de abertura ou encerramento esta muito proxima.',
    'medium',
    'deadline',
    '{"references":["Lei 14.133/2021 - planejamento, publicidade e competitividade"],"note":"Referencia geral para revisao operacional, sem conclusao juridica automatica."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"deadline_days","thresholdDays":3}'::jsonb,
    'Ponto de atencao: prazo curto pode reduzir a margem operacional para preparar documentos e proposta.',
    'Recomendacao de revisao: conferir imediatamente prazos, documentos obrigatorios e viabilidade de participacao.',
    '{"system":true}'::jsonb
),
(
    'missing_estimated_value',
    'Ausencia de valor estimado',
    'Identifica editais sem valor estimado nos dados estruturados.',
    'medium',
    'structured_data',
    '{"references":["Lei 14.133/2021 - planejamento e transparencia da contratacao"],"note":"A ausencia em dados estruturados pode depender de validacao no inteiro teor."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"field_missing","field":"estimatedValue"}'::jsonb,
    'Ponto de atencao: valor estimado ausente nos dados estruturados.',
    'Recomendacao de revisao: verificar o edital completo e anexos antes de precificar.',
    '{"system":true}'::jsonb
),
(
    'unclear_object',
    'Ausencia de objeto claro',
    'Identifica objeto ausente, vazio ou excessivamente generico.',
    'medium',
    'structured_data',
    '{"references":["Lei 14.133/2021 - definicao do objeto e julgamento objetivo"],"note":"Regra preliminar baseada em clareza minima do objeto."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"object_clarity","minLength":20}'::jsonb,
    'Possivel risco operacional: objeto ausente ou pouco claro nos dados analisados.',
    'Recomendacao de revisao: validar escopo, especificacoes e anexos antes de decidir participar.',
    '{"system":true}'::jsonb
),
(
    'missing_modality',
    'Ausencia de modalidade',
    'Identifica quando a modalidade nao esta disponivel nos dados estruturados.',
    'low',
    'structured_data',
    '{"references":["Lei 14.133/2021 - modalidades e rito de contratacao"],"note":"Ausencia em dados estruturados nao implica conclusao juridica."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"field_missing","field":"modality"}'::jsonb,
    'Ponto de atencao: modalidade ausente nos dados estruturados.',
    'Recomendacao de revisao: conferir a modalidade no edital completo e no portal de origem.',
    '{"system":true}'::jsonb
),
(
    'territorial_requirement',
    'Exigencia territorial suspeita',
    'Identifica mencoes que podem indicar exigencia de sede, filial ou estrutura local.',
    'high',
    'restriction',
    '{"references":["Lei 14.133/2021 - competitividade, isonomia e requisitos de habilitacao"],"note":"Apenas indício para revisao; contexto e justificativa do edital devem ser avaliados."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"text_pattern","patterns":["sede no municipio","sede local","domicilio no municipio","empresa estabelecida em","comprovar escritorio","filial no municipio","instalada no municipio"]}'::jsonb,
    'Possivel risco: indício de exigencia territorial que pode restringir competidores.',
    'Recomendacao de revisao: avaliar se ha justificativa objetiva e proporcional para a exigencia.',
    '{"system":true}'::jsonb
),
(
    'specific_brand_reference',
    'Mencao a marca especifica',
    'Identifica mencoes a marca, fabricante ou modelo que merecem revisao.',
    'high',
    'specification',
    '{"references":["Lei 14.133/2021 - especificacao do objeto e padronizacao quando justificada"],"note":"Mencao a marca pode ter justificativas; esta regra apenas sinaliza revisao."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"text_pattern","patterns":["marca especifica","marca ","fabricante ","modelo ","dell","hp","lenovo","apple","samsung"]}'::jsonb,
    'Possivel risco: indício de mencao a marca, fabricante ou modelo especifico.',
    'Recomendacao de revisao: verificar se a especificacao aceita equivalentes ou apresenta justificativa tecnica.',
    '{"system":true}'::jsonb
),
(
    'excessive_generic_documents',
    'Exigencia documental generica excessiva',
    'Identifica expressoes amplas sobre documentos adicionais ou indeterminados.',
    'medium',
    'documentation',
    '{"references":["Lei 14.133/2021 - habilitacao e julgamento objetivo"],"note":"Regra preliminar para localizar excesso ou indefinicao documental."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"text_pattern","patterns":["quaisquer documentos","todos os documentos que julgar necessario","documentos complementares a qualquer tempo","demais documentos necessarios","documentacao adicional sem limitacao"]}'::jsonb,
    'Ponto de atencao: exigencia documental aparenta ser ampla ou pouco delimitada.',
    'Recomendacao de revisao: conferir se os documentos exigidos sao objetivos, proporcionais e previamente definidos.',
    '{"system":true}'::jsonb
),
(
    'missing_objective_criteria',
    'Ausencia de criterios objetivos',
    'Identifica quando os chunks nao mencionam criterio de julgamento objetivo conhecido.',
    'medium',
    'judgment',
    '{"references":["Lei 14.133/2021 - julgamento objetivo"],"note":"Pode ser ausencia nos chunks analisados, nao no edital completo."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"missing_text_pattern","patterns":["criterio de julgamento","menor preco","maior desconto","tecnica e preco","melhor tecnica","maior retorno economico"]}'::jsonb,
    'Ponto de atencao: criterio objetivo de julgamento nao foi localizado nos textos analisados.',
    'Recomendacao de revisao: localizar no edital o criterio de julgamento e os parametros de classificacao.',
    '{"system":true}'::jsonb
),
(
    'low_documental_completeness',
    'Baixa completude documental',
    'Identifica baixa completude dos dados e chunks para uma revisao preliminar confiavel.',
    'low',
    'data_quality',
    '{"references":["Boas praticas de auditoria e rastreabilidade documental"],"note":"Regra de qualidade da base analisada, sem conclusao sobre o edital."}'::jsonb,
    'legal_precheck_v1.0.0',
    true,
    '{"type":"completeness_below","threshold":70}'::jsonb,
    'Ponto de atencao: base documental analisada esta incompleta.',
    'Recomendacao de revisao: obter o edital integral e anexos antes de concluir a analise.',
    '{"system":true}'::jsonb
)
ON CONFLICT ("code", "version", "tenant_id") DO NOTHING;
