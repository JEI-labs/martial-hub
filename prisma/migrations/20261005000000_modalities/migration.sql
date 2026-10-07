-- Modalidade: o que a academia ensina. Até aqui o sistema assumia Muay Thai
-- em todo lugar; agora cada academia tem as suas.
CREATE TABLE "Modality" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Modality_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Modality_tenantId_position_idx" ON "Modality"("tenantId", "position");

-- Único pelo slug, não pelo nome: "Boxe" e "boxe" são a mesma modalidade.
CREATE UNIQUE INDEX "Modality_tenantId_slug_key" ON "Modality"("tenantId", "slug");

ALTER TABLE "Modality" ADD CONSTRAINT "Modality_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Toda academia que já existe ensina Muay Thai: é o que o sistema assumia até
-- aqui, e é nela que alunos, faixas e matrículas vão pendurar nas próximas
-- migrations. O id sai do banco porque o uuid() do schema é gerado pelo
-- Prisma, não pelo Postgres.
INSERT INTO "Modality" ("id", "name", "slug", "isActive", "position", "updatedAt", "tenantId")
SELECT gen_random_uuid(), 'Muay Thai', 'muay-thai', true, 0, CURRENT_TIMESTAMP, "id"
FROM "Tenant";
