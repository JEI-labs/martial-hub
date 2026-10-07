-- Dois eventos novos: lembrete antes do vencimento e aviso no dia.
-- ADD VALUE é aditivo: enum existente continua válido.
ALTER TYPE "EMessageEvent" ADD VALUE IF NOT EXISTS 'PAYMENT_DUE_SOON';
ALTER TYPE "EMessageEvent" ADD VALUE IF NOT EXISTS 'PAYMENT_DUE_TODAY';

-- Regras de envio automático, uma por evento e por usuário.
CREATE TABLE IF NOT EXISTS "MessageAutomation" (
  "id"         TEXT NOT NULL,
  "event"      "EMessageEvent" NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT false,
  "offsetDays" INTEGER NOT NULL DEFAULT 3,
  "sendHour"   INTEGER NOT NULL DEFAULT 9,
  "templateId" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  "userId"     TEXT NOT NULL,

  CONSTRAINT "MessageAutomation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageAutomation_userId_event_key"
  ON "MessageAutomation"("userId", "event");

ALTER TABLE "MessageAutomation"
  ADD CONSTRAINT "MessageAutomation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageAutomation"
  ADD CONSTRAINT "MessageAutomation_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
