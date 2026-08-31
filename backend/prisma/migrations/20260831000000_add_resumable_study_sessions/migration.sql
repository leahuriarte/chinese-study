ALTER TABLE "study_sessions"
ADD COLUMN "session_type" TEXT NOT NULL DEFAULT 'mastery',
ADD COLUMN "writing_mode" TEXT NOT NULL DEFAULT 'stroke_order',
ADD COLUMN "study_source" TEXT NOT NULL DEFAULT 'lesson',
ADD COLUMN "filters" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "state" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "study_sessions_user_id_status_updated_at_idx" ON "study_sessions"("user_id", "status", "updated_at");
