-- Graduação deixa de ser o enum EGraduation (as 11 faixas do Muay Thai, e só
-- elas) e vira dado da modalidade: cada modalidade da academia tem a sua lista
-- de faixas, pré-cadastrada a partir do catálogo.
--
-- Regra desta migration: nenhum aluno perde a faixa. `GRAU_N` vira a faixa de
-- ordem N do Muay Thai da academia dele (o que se chama assim, ou o que ela
-- renomeou), e o passo 6 confere isso antes de apagar a coluna antiga — se a
-- conta não fechar, a migration inteira aborta.

-- 1. As faixas.
CREATE TABLE "Graduation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "colors" TEXT[],
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modalityId" TEXT NOT NULL,

    CONSTRAINT "Graduation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Graduation_modalityId_position_idx" ON "Graduation"("modalityId", "position");

ALTER TABLE "Graduation" ADD CONSTRAINT "Graduation_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Onde moram as faixas antigas. GRAU_N é faixa do Muay Thai, e cada
-- academia com aluno graduado precisa de uma modalidade que receba as 11
-- faixas dele. Ela é escolhida aqui, uma por academia, e os passos 3 e 5 a
-- usam — em vez de casar só pelo slug `muay-thai`, que some quando a
-- academia renomeia a modalidade (o slug muda junto com o nome).
CREATE TEMP TABLE "_MuayThaiDaAcademia" (
    "tenantId" TEXT PRIMARY KEY,
    "modalityId" TEXT NOT NULL
);

-- 2a. A que se chama Muay Thai.
INSERT INTO "_MuayThaiDaAcademia" ("tenantId", "modalityId")
SELECT "tenantId", "id" FROM "Modality" WHERE "slug" = 'muay-thai';

-- 2b. Renomeada. O backfill da migration de modalidades deu Muay Thai a toda
-- academia; se o nome mudou ("Muay Thai Tradicional"), ela é a modalidade
-- mais antiga da academia, e o nome com "muay" ou "thai" desempata. Só fora
-- do catálogo: uma que virou "Jiu-Jitsu" ganha as faixas do Jiu-Jitsu no
-- passo 3, e não pode ganhar as do Muay Thai também. Só para academia com
-- aluno graduado: sem ninguém para acomodar, não há por que adivinhar.
INSERT INTO "_MuayThaiDaAcademia" ("tenantId", "modalityId")
SELECT DISTINCT ON (m."tenantId") m."tenantId", m."id"
FROM "Modality" m
WHERE m."slug" NOT IN ('muay-thai', 'jiu-jitsu', 'karate', 'judo')
  AND NOT EXISTS (SELECT 1 FROM "_MuayThaiDaAcademia" x WHERE x."tenantId" = m."tenantId")
  AND EXISTS (SELECT 1 FROM "Student" s WHERE s."tenantId" = m."tenantId" AND s."graduation" IS NOT NULL)
ORDER BY m."tenantId",
         (m."slug" LIKE '%muay%' OR m."slug" LIKE '%thai%') DESC,
         m."createdAt", m."position";

-- 2c. Não tem nenhuma que sirva (ex.: academia criada pelo master sem
-- modalidades, mas com aluno graduado): ganha um Muay Thai, no fim da lista.
-- Ativo quando ela não tem outra modalidade ativa — desativado, ele deixaria
-- a academia sem modalidade nenhuma para matricular e, de quebra, calaria o
-- aviso de modalidades pendentes, que só olha se a lista está vazia.
INSERT INTO "Modality" ("id", "name", "slug", "isActive", "position", "updatedAt", "tenantId")
SELECT gen_random_uuid(), 'Muay Thai', 'muay-thai',
       NOT EXISTS (SELECT 1 FROM "Modality" m WHERE m."tenantId" = t."id" AND m."isActive"),
       COALESCE((SELECT MAX(m."position") + 1 FROM "Modality" m WHERE m."tenantId" = t."id"), 0),
       CURRENT_TIMESTAMP, t."id"
FROM "Tenant" t
WHERE EXISTS (SELECT 1 FROM "Student" s WHERE s."tenantId" = t."id" AND s."graduation" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "_MuayThaiDaAcademia" x WHERE x."tenantId" = t."id");

INSERT INTO "_MuayThaiDaAcademia" ("tenantId", "modalityId")
SELECT m."tenantId", m."id"
FROM "Modality" m
WHERE m."slug" = 'muay-thai'
  AND NOT EXISTS (SELECT 1 FROM "_MuayThaiDaAcademia" x WHERE x."tenantId" = m."tenantId");

-- 3. O catálogo, para toda modalidade que já existe e está nele (pelo slug),
-- e as faixas do Muay Thai para a modalidade escolhida no passo 2, mesmo
-- renomeada. Cópia de `src/common/constants/graduations.ts` no dia desta
-- migration.
INSERT INTO "Graduation" ("id", "name", "level", "colors", "position", "updatedAt", "modalityId")
SELECT gen_random_uuid(), c."name", c."level", c."colors", c."position", CURRENT_TIMESTAMP, m."id"
FROM "Modality" m
JOIN (VALUES
    ('muay-thai', 0, 'Branco', 'Iniciante', ARRAY['#ffffff']::TEXT[]),
    ('muay-thai', 1, 'Vermelho e Branco', 'Iniciante', ARRAY['#ffffff', '#e11d1d']::TEXT[]),
    ('muay-thai', 2, 'Vermelho', 'Iniciante', ARRAY['#e11d1d']::TEXT[]),
    ('muay-thai', 3, 'Vermelho e Azul Claro', 'Intermediário', ARRAY['#e11d1d', '#22a3e0']::TEXT[]),
    ('muay-thai', 4, 'Azul Claro', 'Intermediário', ARRAY['#22a3e0']::TEXT[]),
    ('muay-thai', 5, 'Azul Claro e Azul Escuro', 'Intermediário', ARRAY['#22a3e0', '#1414c8']::TEXT[]),
    ('muay-thai', 6, 'Azul Escuro', 'Instrutor Auxiliar', ARRAY['#1414c8']::TEXT[]),
    ('muay-thai', 7, 'Azul Escuro e Preto', 'Instrutor', ARRAY['#1414c8', '#111111']::TEXT[]),
    ('muay-thai', 8, 'Preto', 'Professor', ARRAY['#111111']::TEXT[]),
    ('muay-thai', 9, 'Preto e Branco', 'Mestre', ARRAY['#111111', '#ffffff']::TEXT[]),
    ('muay-thai', 10, 'Preto, Branco e Vermelho', 'Grão-Mestre', ARRAY['#111111', '#ffffff', '#e11d1d']::TEXT[]),
    ('jiu-jitsu', 0, 'Branca', 'Infantil e adulto', ARRAY['#ffffff']::TEXT[]),
    ('jiu-jitsu', 1, 'Cinza e Branca', 'Infantil', ARRAY['#9ca3af', '#ffffff']::TEXT[]),
    ('jiu-jitsu', 2, 'Cinza', 'Infantil', ARRAY['#9ca3af']::TEXT[]),
    ('jiu-jitsu', 3, 'Cinza e Preta', 'Infantil', ARRAY['#9ca3af', '#111111']::TEXT[]),
    ('jiu-jitsu', 4, 'Amarela e Branca', 'Infantil', ARRAY['#facc15', '#ffffff']::TEXT[]),
    ('jiu-jitsu', 5, 'Amarela', 'Infantil', ARRAY['#facc15']::TEXT[]),
    ('jiu-jitsu', 6, 'Amarela e Preta', 'Infantil', ARRAY['#facc15', '#111111']::TEXT[]),
    ('jiu-jitsu', 7, 'Laranja e Branca', 'Infantil', ARRAY['#f97316', '#ffffff']::TEXT[]),
    ('jiu-jitsu', 8, 'Laranja', 'Infantil', ARRAY['#f97316']::TEXT[]),
    ('jiu-jitsu', 9, 'Laranja e Preta', 'Infantil', ARRAY['#f97316', '#111111']::TEXT[]),
    ('jiu-jitsu', 10, 'Verde e Branca', 'Infantil', ARRAY['#16a34a', '#ffffff']::TEXT[]),
    ('jiu-jitsu', 11, 'Verde', 'Infantil', ARRAY['#16a34a']::TEXT[]),
    ('jiu-jitsu', 12, 'Verde e Preta', 'Infantil', ARRAY['#16a34a', '#111111']::TEXT[]),
    ('jiu-jitsu', 13, 'Azul', 'Adulto', ARRAY['#2563eb']::TEXT[]),
    ('jiu-jitsu', 14, 'Roxa', 'Adulto', ARRAY['#7e22ce']::TEXT[]),
    ('jiu-jitsu', 15, 'Marrom', 'Adulto', ARRAY['#78350f']::TEXT[]),
    ('jiu-jitsu', 16, 'Preta', 'Adulto', ARRAY['#111111']::TEXT[]),
    ('jiu-jitsu', 17, 'Vermelha e Preta', 'Mestre', ARRAY['#e11d1d', '#111111']::TEXT[]),
    ('jiu-jitsu', 18, 'Vermelha e Branca', 'Mestre', ARRAY['#e11d1d', '#ffffff']::TEXT[]),
    ('jiu-jitsu', 19, 'Vermelha', 'Grão-Mestre', ARRAY['#e11d1d']::TEXT[]),
    ('karate', 0, 'Branca', 'Iniciante', ARRAY['#ffffff']::TEXT[]),
    ('karate', 1, 'Amarela', 'Iniciante', ARRAY['#facc15']::TEXT[]),
    ('karate', 2, 'Vermelha', 'Iniciante', ARRAY['#e11d1d']::TEXT[]),
    ('karate', 3, 'Laranja', 'Intermediário', ARRAY['#f97316']::TEXT[]),
    ('karate', 4, 'Verde', 'Intermediário', ARRAY['#16a34a']::TEXT[]),
    ('karate', 5, 'Roxa', 'Avançado', ARRAY['#7e22ce']::TEXT[]),
    ('karate', 6, 'Marrom', 'Avançado', ARRAY['#78350f']::TEXT[]),
    ('karate', 7, 'Preta', 'Faixa preta', ARRAY['#111111']::TEXT[]),
    ('judo', 0, 'Branca', 'Iniciante', ARRAY['#ffffff']::TEXT[]),
    ('judo', 1, 'Cinza', 'Iniciante', ARRAY['#9ca3af']::TEXT[]),
    ('judo', 2, 'Azul', 'Iniciante', ARRAY['#2563eb']::TEXT[]),
    ('judo', 3, 'Amarela', 'Intermediário', ARRAY['#facc15']::TEXT[]),
    ('judo', 4, 'Laranja', 'Intermediário', ARRAY['#f97316']::TEXT[]),
    ('judo', 5, 'Verde', 'Intermediário', ARRAY['#16a34a']::TEXT[]),
    ('judo', 6, 'Roxa', 'Avançado', ARRAY['#7e22ce']::TEXT[]),
    ('judo', 7, 'Marrom', 'Avançado', ARRAY['#78350f']::TEXT[]),
    ('judo', 8, 'Preta', 'Faixa preta', ARRAY['#111111']::TEXT[])
) AS c("slug", "position", "name", "level", "colors")
  ON c."slug" = CASE
    WHEN EXISTS (SELECT 1 FROM "_MuayThaiDaAcademia" x WHERE x."modalityId" = m."id") THEN 'muay-thai'
    ELSE m."slug"
  END;

-- 4. A faixa do aluno passa a apontar para a tabela. NO ACTION: apagar uma
-- faixa em uso é recusado, em vez de tirar a graduação do aluno em silêncio.
ALTER TABLE "Student" ADD COLUMN "graduationId" TEXT;

CREATE INDEX "Student_graduationId_idx" ON "Student"("graduationId");

ALTER TABLE "Student" ADD CONSTRAINT "Student_graduationId_fkey" FOREIGN KEY ("graduationId") REFERENCES "Graduation"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- 5. GRAU_N vira a faixa de posição N-1 (a posição começa em 0) do Muay Thai
-- da academia do aluno — a modalidade escolhida no passo 2.
UPDATE "Student" s
SET "graduationId" = g."id"
FROM "_MuayThaiDaAcademia" x
JOIN "Graduation" g ON g."modalityId" = x."modalityId"
WHERE s."graduation" IS NOT NULL
  AND x."tenantId" = s."tenantId"
  AND g."position" = SUBSTRING(s."graduation"::TEXT FROM 6)::INTEGER - 1;

-- 6. A conferência: todo aluno que tinha faixa tem faixa, e a mesma.
DO $$
DECLARE
  antes INTEGER;
  depois INTEGER;
  perdidos INTEGER;
BEGIN
  SELECT COUNT(*) INTO antes FROM "Student" WHERE "graduation" IS NOT NULL;
  SELECT COUNT(*) INTO depois FROM "Student" WHERE "graduationId" IS NOT NULL;
  SELECT COUNT(*) INTO perdidos
  FROM "Student" s
  LEFT JOIN "Graduation" g ON g."id" = s."graduationId"
  WHERE s."graduation" IS NOT NULL
    AND (g."id" IS NULL OR g."position" <> SUBSTRING(s."graduation"::TEXT FROM 6)::INTEGER - 1);

  IF antes <> depois OR perdidos > 0 THEN
    RAISE EXCEPTION 'Graduações não conferem: % alunos tinham faixa, % ficaram com faixa, % com faixa errada ou perdida.', antes, depois, perdidos;
  END IF;

  RAISE NOTICE 'Graduações conferidas: % alunos mantiveram a faixa.', depois;
END $$;

DROP TABLE "_MuayThaiDaAcademia";

-- 7. Só agora o enum sai.
ALTER TABLE "Student" DROP COLUMN "graduation";

DROP TYPE "EGraduation";
