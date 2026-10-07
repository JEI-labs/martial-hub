-- Várias conexões de WhatsApp por usuário, com uma ativa por vez.
-- O índice único em userId era o que limitava a uma só.
DROP INDEX IF EXISTS "WhatsappConfig_userId_key";

ALTER TABLE "WhatsappConfig" ADD COLUMN IF NOT EXISTS "label" TEXT;

CREATE INDEX IF NOT EXISTS "WhatsappConfig_userId_isActive_idx"
  ON "WhatsappConfig"("userId", "isActive");
