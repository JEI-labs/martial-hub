-- Preço de plano por modalidade, e desconto da 2ª modalidade em diante.
--
-- Regras desta migration: planos e preços que já existem continuam valendo
-- (nenhum plano ganha preço por modalidade, então todos seguem no preço
-- padrão), e nenhuma parcela muda de valor (a tabela de parcelas não é
-- tocada). O passo 4 confere que toda matrícula ficou com o valor do plano.

-- 1. O valor do plano em cada modalidade. Vazia: todo plano segue no preço
-- padrão, como hoje.
CREATE TABLE "PlanModalityPrice" (
    "id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planId" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,

    CONSTRAINT "PlanModalityPrice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlanModalityPrice_modalityId_idx" ON "PlanModalityPrice"("modalityId");

CREATE UNIQUE INDEX "PlanModalityPrice_planId_modalityId_key" ON "PlanModalityPrice"("planId", "modalityId");

ALTER TABLE "PlanModalityPrice" ADD CONSTRAINT "PlanModalityPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanModalityPrice" ADD CONSTRAINT "PlanModalityPrice_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. O desconto da academia para quem faz mais de uma modalidade. Zero para
-- todas: até a academia configurar, cada modalidade paga o valor cheio.
ALTER TABLE "Tenant" ADD COLUMN "multiModalityDiscount" INTEGER NOT NULL DEFAULT 0;

-- 3. O valor de cada matrícula passa a ser guardado nela. As existentes
-- ficam com o preço de hoje do plano, sem desconto — é o que o MRR já usava.
ALTER TABLE "Enrollment" ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "price" DOUBLE PRECISION;

UPDATE "Enrollment" e
SET "price" = p."price"
FROM "Plan" p
WHERE p."id" = e."planId";

-- 4. Conferência: toda matrícula ficou com o valor do plano dela.
DO $$
DECLARE
  sem_valor INTEGER;
  diferentes INTEGER;
BEGIN
  SELECT COUNT(*) INTO sem_valor FROM "Enrollment" WHERE "price" IS NULL;
  SELECT COUNT(*) INTO diferentes
  FROM "Enrollment" e JOIN "Plan" p ON p."id" = e."planId"
  WHERE e."price" <> p."price";

  IF sem_valor > 0 OR diferentes > 0 THEN
    RAISE EXCEPTION 'Valor das matrículas não confere: % sem valor, % diferentes do plano.', sem_valor, diferentes;
  END IF;
END $$;

ALTER TABLE "Enrollment" ALTER COLUMN "price" SET NOT NULL;
