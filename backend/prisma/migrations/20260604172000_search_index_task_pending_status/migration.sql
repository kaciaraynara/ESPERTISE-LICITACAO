ALTER TABLE "search_index_tasks" ALTER COLUMN "status" SET DEFAULT 'pending';

UPDATE "search_index_tasks"
SET "status" = 'pending'
WHERE "status" = 'queued';
