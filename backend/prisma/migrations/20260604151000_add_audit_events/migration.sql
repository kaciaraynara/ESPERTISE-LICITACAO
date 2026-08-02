-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "scope" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "request_id" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "email_hash" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_scope_action_created_at_idx" ON "audit_events"("scope", "action", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_outcome_created_at_idx" ON "audit_events"("outcome", "created_at");
