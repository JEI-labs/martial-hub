-- Verificação em duas etapas. Obrigatória para quem manda — dono de academia
-- e dono do sistema — porque são as contas que abrem o dado de todo mundo.
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
