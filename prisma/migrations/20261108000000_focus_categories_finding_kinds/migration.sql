-- Step-B focus evidence categories (additive) — fingerprint/dna are stored
-- but never extracted by this deployment.
ALTER TYPE "EvidenceCategory" ADD VALUE IF NOT EXISTS 'cctv';
ALTER TYPE "EvidenceCategory" ADD VALUE IF NOT EXISTS 'photograph';
ALTER TYPE "EvidenceCategory" ADD VALUE IF NOT EXISTS 'fingerprint';
ALTER TYPE "EvidenceCategory" ADD VALUE IF NOT EXISTS 'dna';
ALTER TYPE "EvidenceCategory" ADD VALUE IF NOT EXISTS 'phone_records';
ALTER TYPE "EvidenceCategory" ADD VALUE IF NOT EXISTS 'location';
ALTER TYPE "EvidenceCategory" ADD VALUE IF NOT EXISTS 'documents';

-- Extended AI finding kinds: suspects, leads, clearly-labelled simulated
-- evidence, alternative explanations.
ALTER TYPE "FindingKind" ADD VALUE IF NOT EXISTS 'suspect';
ALTER TYPE "FindingKind" ADD VALUE IF NOT EXISTS 'lead';
ALTER TYPE "FindingKind" ADD VALUE IF NOT EXISTS 'simulated_evidence';
ALTER TYPE "FindingKind" ADD VALUE IF NOT EXISTS 'alternative';
