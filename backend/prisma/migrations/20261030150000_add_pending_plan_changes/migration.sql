ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "pending_plan_id" TEXT,
  ADD COLUMN IF NOT EXISTS "pending_plan_at" TIMESTAMPTZ(6);
