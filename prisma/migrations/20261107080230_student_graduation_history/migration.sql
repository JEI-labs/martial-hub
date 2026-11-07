-- A graduação do aluno passa a ser por modalidade, com histórico: cada faixa
-- dada é um registro (faixa, dia, quem registrou), e a faixa atual em cada
-- modalidade é a mais recente dela.
--
-- Regra desta migration: nenhum aluno perde a faixa. A faixa de hoje
-- (Student.graduationId) vira o primeiro registro do histórico dele, e o
-- passo 3 confere aluno por aluno antes de apagar a coluna antiga.

-- 1. O histórico.
CREATE TABLE "StudentGraduation" (
    "id" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT NOT NULL,
    "graduationId" TEXT NOT NULL,
    "userId" TEXT,

    CONSTRAINT "StudentGraduation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentGraduation_studentId_awardedAt_idx" ON "StudentGraduation"("studentId", "awardedAt");

CREATE INDEX "StudentGraduation_graduationId_idx" ON "StudentGraduation"("graduationId");

ALTER TABLE "StudentGraduation" ADD CONSTRAINT "StudentGraduation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NO ACTION: apagar faixa que está no histórico de alguém é recusado.
ALTER TABLE "StudentGraduation" ADD CONSTRAINT "StudentGraduation_graduationId_fkey" FOREIGN KEY ("graduationId") REFERENCES "Graduation"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "StudentGraduation" ADD CONSTRAINT "StudentGraduation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. A faixa de hoje vira o primeiro registro. O dia em que ela foi dada
-- nunca foi guardado: fica a última alteração do aluno, que é o mais perto
-- que existe, e a observação diz de onde veio.
INSERT INTO "StudentGraduation" ("id", "awardedAt", "note", "studentId", "graduationId")
SELECT gen_random_uuid(), s."updatedAt", 'Faixa registrada antes do histórico de graduações', s."id", s."graduationId"
FROM "Student" s
WHERE s."graduationId" IS NOT NULL;

-- 3. Conferência: todo aluno com faixa tem a mesma faixa no histórico.
DO $$
DECLARE
  com_faixa INTEGER;
  registros INTEGER;
  diferentes INTEGER;
BEGIN
  SELECT COUNT(*) INTO com_faixa FROM "Student" WHERE "graduationId" IS NOT NULL;
  SELECT COUNT(*) INTO registros FROM "StudentGraduation";
  SELECT COUNT(*) INTO diferentes
  FROM "Student" s
  WHERE s."graduationId" IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "StudentGraduation" g
      WHERE g."studentId" = s."id" AND g."graduationId" = s."graduationId"
    );

  IF com_faixa <> registros OR diferentes > 0 THEN
    RAISE EXCEPTION 'Graduações não conferem: % alunos com faixa, % registros, % sem a faixa no histórico.', com_faixa, registros, diferentes;
  END IF;

  RAISE NOTICE 'Graduações conferidas: % alunos mantiveram a faixa.', registros;
END $$;

-- 4. Só agora a coluna antiga sai.
ALTER TABLE "Student" DROP CONSTRAINT "Student_graduationId_fkey";

DROP INDEX "Student_graduationId_idx";

ALTER TABLE "Student" DROP COLUMN "graduationId";
