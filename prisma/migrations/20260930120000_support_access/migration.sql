-- Rastro do acesso de suporte: quem do sistema entrou em qual academia e
-- quando. Dado de cliente não se olha sem deixar registro.
CREATE TABLE "SupportAccess" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SupportAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAccess_tenantId_createdAt_idx"
  ON "SupportAccess"("tenantId", "createdAt");

ALTER TABLE "SupportAccess" ADD CONSTRAINT "SupportAccess_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportAccess" ADD CONSTRAINT "SupportAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
