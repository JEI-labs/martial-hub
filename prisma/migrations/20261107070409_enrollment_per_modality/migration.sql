-- A matrícula passa a ser de uma modalidade, e a parcela, de uma matrícula.
-- Quem faz muay thai e boxe tem duas matrículas, cada uma com o seu plano e as
-- suas parcelas: cancelar uma não mexe na outra.
--
-- Regras desta migration: nenhuma matrícula fica sem modalidade, nenhum aluno
-- fica com duas ativas na mesma modalidade, nenhuma parcela muda de valor, e
-- toda parcela de aluno matriculado fica ligada a uma matrícula. Os passos 4 e 8 conferem isso; se a conta não fechar, a migration
-- inteira aborta.

-- 0. O retrato de antes, para a conferência do fim.
CREATE TEMP TABLE "_parcelas_antes" AS
SELECT COUNT(*) AS "quantas", COALESCE(SUM("amount"), 0) AS "soma" FROM "Payment";

-- 1. A modalidade da matrícula, ainda opcional enquanto é preenchida.
ALTER TABLE "Enrollment" ADD COLUMN "modalityId" TEXT;

-- 2. Rede de segurança: academia com matrícula e sem modalidade nenhuma (só
-- possível em academia criada sem modalidade escolhida, antes desta migration)
-- ganha um Muay Thai — era o que o sistema assumia até aqui. Ativo: é a única
-- modalidade dela, e desativado a academia ficaria sem ter onde matricular
-- (e sem poder criar "Muay Thai", que já existiria escondido).
INSERT INTO "Modality" ("id", "name", "slug", "isActive", "position", "updatedAt", "tenantId")
SELECT gen_random_uuid(), 'Muay Thai', 'muay-thai', true, 0, CURRENT_TIMESTAMP, t."id"
FROM "Tenant" t
WHERE EXISTS (
        SELECT 1 FROM "Enrollment" e JOIN "Student" s ON s."id" = e."studentId"
        WHERE s."tenantId" = t."id"
      )
  AND NOT EXISTS (SELECT 1 FROM "Modality" m WHERE m."tenantId" = t."id");

-- 3. Toda matrícula existente fica na modalidade que a academia tinha: o
-- Muay Thai, que o backfill das modalidades deu a todas. Se ele foi renomeado
-- (o slug muda junto), fica no mesmo que a migration das graduações escolheu
-- para as faixas: nome com "muay" ou "thai", senão a modalidade mais antiga
-- (a do backfill) — a posição muda quando o dono reordena, a idade não.
UPDATE "Enrollment" e
SET "modalityId" = (
  SELECT m."id"
  FROM "Modality" m
  JOIN "Student" s ON s."tenantId" = m."tenantId"
  WHERE s."id" = e."studentId"
  ORDER BY (m."slug" = 'muay-thai') DESC,
           (m."slug" LIKE '%muay%' OR m."slug" LIKE '%thai%') DESC,
           m."createdAt" ASC, m."isActive" DESC, m."position" ASC
  LIMIT 1
);

-- 4. Conferência: nenhuma matrícula sem modalidade.
DO $$
DECLARE
  sem_modalidade INTEGER;
BEGIN
  SELECT COUNT(*) INTO sem_modalidade FROM "Enrollment" WHERE "modalityId" IS NULL;
  IF sem_modalidade > 0 THEN
    RAISE EXCEPTION 'Matrículas sem modalidade: %.', sem_modalidade;
  END IF;
END $$;

ALTER TABLE "Enrollment" ALTER COLUMN "modalityId" SET NOT NULL;

-- 4b. Uma matrícula ativa por aluno e modalidade. Antes desta migration a
-- matrícula não tinha modalidade, e um aluno podia ficar com mais de uma
-- ativa (a tela usava a mais recente); agora todas caíram na mesma
-- modalidade. Fica ativa a mais recente, como a tela já mostrava, e as
-- outras são encerradas — as parcelas delas não mudam.
WITH "excedentes" AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "studentId", "modalityId"
    ORDER BY "startDate" DESC, "createdAt" DESC
  ) AS "ordem"
  FROM "Enrollment"
  WHERE "isActive"
)
UPDATE "Enrollment" e
SET "isActive" = false
FROM "excedentes" x
WHERE x."id" = e."id" AND x."ordem" > 1;

-- O índice é a garantia contra dois pedidos simultâneos: no READ COMMITTED
-- do Postgres, a busca por "já tem matrícula ativa" dentro da transação não
-- impede os dois inserts. O Prisma não descreve índice parcial no schema;
-- por isso ele mora só aqui (ver o comentário em `model Enrollment`).
CREATE UNIQUE INDEX "Enrollment_studentId_modalityId_active_key"
  ON "Enrollment" ("studentId", "modalityId") WHERE "isActive";

CREATE INDEX "Enrollment_studentId_isActive_idx" ON "Enrollment"("studentId", "isActive");

CREATE INDEX "Enrollment_modalityId_idx" ON "Enrollment"("modalityId");

-- NO ACTION: apagar modalidade com matrícula é recusado, em vez de levar o
-- histórico do aluno junto.
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- O mesmo para o plano, que era CASCADE: excluir um plano apagava as
-- matrículas nele, e as parcelas delas viravam parcelas soltas. NO ACTION, e
-- não RESTRICT, porque a exclusão da academia apaga planos e matrículas no
-- mesmo comando: o NO ACTION confere no fim dele, quando as matrículas já
-- foram junto; o RESTRICT confere linha a linha e barraria a cascata.
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_planId_fkey";
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- 5. A matrícula da parcela.
ALTER TABLE "Payment" ADD COLUMN "enrollmentId" TEXT;

CREATE INDEX "Payment_enrollmentId_idx" ON "Payment"("enrollmentId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Cada parcela vai para a matrícula do aluno que estava valendo no
-- vencimento: a mais recente que começou até aquele dia. Na troca de plano a
-- matrícula velha fecha e a nova abre no mesmo dia, então as parcelas
-- atrasadas ficam com a velha e as novas com a nova.
UPDATE "Payment" p
SET "enrollmentId" = (
  SELECT e."id"
  FROM "Enrollment" e
  WHERE e."studentId" = p."studentId" AND e."startDate" <= p."dueDate"
  ORDER BY e."startDate" DESC, e."createdAt" DESC
  LIMIT 1
);

-- 7. Parcela que vence antes da primeira matrícula (lançada à mão, ou com a
-- data mexida) fica com a primeira.
UPDATE "Payment" p
SET "enrollmentId" = (
  SELECT e."id"
  FROM "Enrollment" e
  WHERE e."studentId" = p."studentId"
  ORDER BY e."startDate" ASC, e."createdAt" ASC
  LIMIT 1
)
WHERE p."enrollmentId" IS NULL;

-- 8. Conferência: as parcelas são as mesmas, com o mesmo valor, e toda
-- parcela de aluno com matrícula ficou ligada a uma.
DO $$
DECLARE
  antes RECORD;
  quantas_depois BIGINT;
  soma_depois NUMERIC;
  soltas INTEGER;
BEGIN
  SELECT * INTO antes FROM "_parcelas_antes";
  SELECT COUNT(*), COALESCE(SUM("amount"), 0) INTO quantas_depois, soma_depois FROM "Payment";
  SELECT COUNT(*) INTO soltas
  FROM "Payment" p
  WHERE p."enrollmentId" IS NULL
    AND EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentId" = p."studentId");

  IF antes."quantas" <> quantas_depois OR antes."soma" <> soma_depois OR soltas > 0 THEN
    RAISE EXCEPTION 'Parcelas não conferem: % antes e % depois, soma % antes e % depois, % sem matrícula.',
      antes."quantas", quantas_depois, antes."soma", soma_depois, soltas;
  END IF;

  RAISE NOTICE 'Parcelas conferidas: %, somando %.', quantas_depois, soma_depois;
END $$;

DROP TABLE "_parcelas_antes";
