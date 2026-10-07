-- Plano padrão: o que já vem escolhido na hora de matricular.
-- Só um por academia, mas a regra fica no router (transação que zera os
-- outros antes de marcar o novo), porque a unicidade aqui seria parcial
-- (WHERE "isDefault") e o Prisma não a representa no schema.
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Plan_userId_isDefault_idx"
  ON "Plan"("userId", "isDefault");
