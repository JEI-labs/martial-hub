-- Preço de plano por modalidade, e desconto da 2ª modalidade em diante.
--
-- Regras desta migration: planos e preços que já existem continuam valendo
-- (nenhum plano ganha preço por modalidade, então todos seguem no preço
-- padrão), e nenhuma parcela muda de valor (a tabela de parcelas não é
-- tocada). O passo 4 confere que toda matrícula ficou com valor e duração, e
-- que o valor das ativas é o das parcelas delas.

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

-- 3. O valor de cada matrícula passa a ser guardado nela, com a duração do
-- contrato (o MRR divide um pelo outro). Nenhuma das existentes tem desconto.
ALTER TABLE "Enrollment" ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "price" DOUBLE PRECISION,
ADD COLUMN "duration" INTEGER;

-- 3a. A duração. Matrícula ativa ainda tem o `endDate` que nasceu com ela
-- (início + duração do plano naquele dia), então os meses saem das datas —
-- o plano pode ter mudado de duração depois. A encerrada teve o `endDate`
-- trocado pela data do encerramento, e fica com a duração atual do plano.
UPDATE "Enrollment" e
SET "duration" = CASE
  WHEN e."isActive" THEN GREATEST(1, ROUND(EXTRACT(EPOCH FROM (e."endDate" - e."startDate")) / 86400 / 30.4375)::INTEGER)
  ELSE p."duration"
END
FROM "Plan" p
WHERE p."id" = e."planId";

-- 3b. O valor. É o que foi de fato combinado, e isso está nas parcelas, não
-- no preço de hoje do plano (que pode ter subido depois). Matrícula ativa
-- tem todas as parcelas (só o encerramento apaga as por vencer): o valor é
-- a soma. A encerrada perdeu as por vencer: média das que ficaram vezes o
-- número de parcelas do contrato. Sem parcela nenhuma, o preço do plano.
UPDATE "Enrollment" e
SET "price" = COALESCE(
  (
    SELECT CASE
      WHEN e."isActive" THEN SUM(pg."amount")
      ELSE ROUND(AVG(pg."amount") * CASE WHEN p."billing" = 'UPFRONT' THEN 1 ELSE e."duration" END, 2)
    END::DOUBLE PRECISION
    FROM "Payment" pg
    WHERE pg."enrollmentId" = e."id"
  ),
  p."price"
)
FROM "Plan" p
WHERE p."id" = e."planId";

-- 4. Conferência: toda matrícula ficou com valor e duração, e toda ativa com
-- parcelas vale exatamente a soma delas.
DO $$
DECLARE
  incompletas INTEGER;
  diferentes INTEGER;
BEGIN
  SELECT COUNT(*) INTO incompletas FROM "Enrollment" WHERE "price" IS NULL OR "duration" IS NULL;
  SELECT COUNT(*) INTO diferentes
  FROM "Enrollment" e
  JOIN (SELECT "enrollmentId", SUM("amount") AS "soma" FROM "Payment" GROUP BY "enrollmentId") x
    ON x."enrollmentId" = e."id"
  WHERE e."isActive" AND ABS(e."price" - x."soma"::DOUBLE PRECISION) > 0.001;

  IF incompletas > 0 OR diferentes > 0 THEN
    RAISE EXCEPTION 'Matrículas não conferem: % sem valor ou duração, % ativas com valor diferente das parcelas.', incompletas, diferentes;
  END IF;
END $$;

ALTER TABLE "Enrollment" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "Enrollment" ALTER COLUMN "duration" SET NOT NULL;

-- 5. Plano desativado sai das escolhas novas: é o jeito de aposentar um
-- plano usado, que não pode ser apagado. Todos seguem ativos.
ALTER TABLE "Plan" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
