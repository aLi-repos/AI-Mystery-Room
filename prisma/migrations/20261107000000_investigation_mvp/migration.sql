-- CreateEnum
CREATE TYPE "EvidenceCategory" AS ENUM ('video', 'image', 'pdf', 'text', 'audio', 'other');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('stored', 'analyzed', 'unprocessed');

-- CreateEnum
CREATE TYPE "FindingKind" AS ENUM ('fact', 'observation', 'hypothesis', 'inconsistency', 'timeline', 'missing_evidence', 'link');

-- CreateTable
CREATE TABLE "investigations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "case_description" TEXT NOT NULL,
    "categories" "EvidenceCategory"[],
    "report" TEXT,
    "report_generated_at" TIMESTAMPTZ,
    "qa_history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "investigations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "investigation_id" UUID NOT NULL,
    "ref" VARCHAR(10) NOT NULL,
    "category" "EvidenceCategory" NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "content_text" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'stored',
    "process_note" VARCHAR(300),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "investigation_id" UUID NOT NULL,
    "kind" "FindingKind" NOT NULL,
    "statement" TEXT NOT NULL,
    "time_label" VARCHAR(120),
    "evidence_ids" UUID[],
    "confidence" VARCHAR(10) NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investigations_user_id_created_at_idx" ON "investigations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "evidence_investigation_id_idx" ON "evidence"("investigation_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_investigation_id_ref_key" ON "evidence"("investigation_id", "ref");

-- CreateIndex
CREATE INDEX "findings_investigation_id_idx" ON "findings"("investigation_id");

-- AddForeignKey
ALTER TABLE "investigations" ADD CONSTRAINT "investigations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_investigation_id_fkey" FOREIGN KEY ("investigation_id") REFERENCES "investigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

