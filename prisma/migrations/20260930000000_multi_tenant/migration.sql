-- Multi-tenant: o dado deixa de pertencer ao usuário e passa a pertencer à
-- academia. A ordem aqui importa — coluna nula, preenchimento, só então
-- obrigatória — porque o banco já tem dados e um NOT NULL antes da carga
-- derrubaria a migração.

-- ---------------------------------------------------------------- 1. tipos
CREATE TYPE "ETenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELED');
CREATE TYPE "EUserRole" AS ENUM ('MASTER', 'OWNER', 'STAFF', 'TEACHER');
CREATE TYPE "ETenantInvoiceStatus" AS ENUM ('OPEN', 'PAID', 'OVERDUE', 'CANCELED');

-- ------------------------------------------------------------- 2. tabelas
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ETenantStatus" NOT NULL DEFAULT 'TRIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantBranding" (
    "id" TEXT NOT NULL,
    "logoUrl" TEXT,
    "loginImageUrl" TEXT,
    "primaryColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "billingDay" INTEGER NOT NULL DEFAULT 10,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantInvoice" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "ETenantInvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "TenantInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE UNIQUE INDEX "TenantDomain_hostname_key" ON "TenantDomain"("hostname");
CREATE INDEX "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");
CREATE UNIQUE INDEX "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");
CREATE INDEX "TenantInvoice_tenantId_status_idx" ON "TenantInvoice"("tenantId", "status");
CREATE INDEX "TenantInvoice_dueDate_idx" ON "TenantInvoice"("dueDate");

ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantInvoice" ADD CONSTRAINT "TenantInvoice_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------- 3. colunas novas (ainda nulas)
ALTER TABLE "User" ADD COLUMN "role" "EUserRole" NOT NULL DEFAULT 'OWNER';
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;

ALTER TABLE "Student" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Plan" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "FinanceEntry" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Category" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Promotion" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "WhatsappConfig" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "MessageAutomation" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "tenantId" TEXT;

-- ------------------------------------------------------------ 4. carga
-- Cada usuário que existe hoje vira uma academia, e os dados dele vão junto.
-- O slug sai do e-mail e ganha sufixo se colidir.
-- Acentos fora do slug sem depender da extensão `unaccent`, que nem todo
-- Postgres gerenciado deixa instalar.
CREATE OR REPLACE FUNCTION unaccent_simples(txt TEXT) RETURNS TEXT AS $func$
  SELECT translate(
    txt,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$func$ LANGUAGE SQL IMMUTABLE;

DO $$
DECLARE
  u            RECORD;
  novo_tenant  TEXT;
  slug_base    TEXT;
  slug_final   TEXT;
  tentativa    INT;
BEGIN
  FOR u IN SELECT "id", "name", "email" FROM "User" ORDER BY "createdAt" LOOP
    novo_tenant := gen_random_uuid()::text;

    -- O slug vira subdomínio, então sai do nome da academia e não do e-mail:
    -- "contato@muay-sp.com.br" daria "contato", que não diz nada e colide com
    -- o próximo cliente que usar o mesmo prefixo.
    slug_base := regexp_replace(lower(unaccent_simples(u."name")), '[^a-z0-9]+', '-', 'g');
    slug_base := trim(both '-' from slug_base);
    IF slug_base = '' THEN
      slug_base := regexp_replace(lower(split_part(u."email", '@', 1)), '[^a-z0-9]+', '-', 'g');
      slug_base := trim(both '-' from slug_base);
    END IF;
    IF slug_base = '' THEN
      slug_base := 'academia';
    END IF;

    slug_final := slug_base;
    tentativa := 1;
    WHILE EXISTS (SELECT 1 FROM "Tenant" WHERE "slug" = slug_final) LOOP
      tentativa := tentativa + 1;
      slug_final := slug_base || '-' || tentativa;
    END LOOP;

    INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
    VALUES (novo_tenant, u."name", slug_final, 'ACTIVE', now(), now());

    UPDATE "User" SET "tenantId" = novo_tenant, "role" = 'OWNER' WHERE "id" = u."id";

    UPDATE "Student"           SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "Plan"              SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "FinanceEntry"      SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "Category"          SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "Supplier"          SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "Promotion"         SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "WhatsappConfig"    SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "MessageTemplate"   SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "MessageAutomation" SET "tenantId" = novo_tenant WHERE "userId" = u."id";
    UPDATE "MessageLog"        SET "tenantId" = novo_tenant WHERE "userId" = u."id";
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS unaccent_simples(TEXT);

-- --------------------------------------- 5. agora a coluna pode ser exigida
ALTER TABLE "Student"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Plan"              ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "FinanceEntry"      ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Category"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Supplier"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Promotion"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "WhatsappConfig"    ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "MessageTemplate"   ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "MessageAutomation" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "MessageLog"        ALTER COLUMN "tenantId" SET NOT NULL;

-- ------------------------------- 6. userId vira "quem cadastrou", opcional
-- O cascade estava no usuário: apagar um login levaria junto os alunos e o
-- financeiro da academia. Agora o cascade é no tenant e o usuário só marca
-- autoria.
ALTER TABLE "Student"           ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Plan"              ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "FinanceEntry"      ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Category"          ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Supplier"          ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Promotion"         ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "WhatsappConfig"    ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "MessageTemplate"   ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "MessageAutomation" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "MessageLog"        ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Student"           DROP CONSTRAINT "Student_userId_fkey";
ALTER TABLE "Plan"              DROP CONSTRAINT "Plan_userId_fkey";
ALTER TABLE "FinanceEntry"      DROP CONSTRAINT "FinanceEntry_userId_fkey";
ALTER TABLE "Category"          DROP CONSTRAINT "Category_userId_fkey";
ALTER TABLE "Supplier"          DROP CONSTRAINT "Supplier_userId_fkey";
ALTER TABLE "Promotion"         DROP CONSTRAINT "Promotion_userId_fkey";
ALTER TABLE "WhatsappConfig"    DROP CONSTRAINT "WhatsappConfig_userId_fkey";
ALTER TABLE "MessageTemplate"   DROP CONSTRAINT "MessageTemplate_userId_fkey";
ALTER TABLE "MessageAutomation" DROP CONSTRAINT "MessageAutomation_userId_fkey";
ALTER TABLE "MessageLog"        DROP CONSTRAINT "MessageLog_userId_fkey";

ALTER TABLE "Student"           ADD CONSTRAINT "Student_userId_fkey"           FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Plan"              ADD CONSTRAINT "Plan_userId_fkey"              FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceEntry"      ADD CONSTRAINT "FinanceEntry_userId_fkey"      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Category"          ADD CONSTRAINT "Category_userId_fkey"          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supplier"          ADD CONSTRAINT "Supplier_userId_fkey"          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Promotion"         ADD CONSTRAINT "Promotion_userId_fkey"         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsappConfig"    ADD CONSTRAINT "WhatsappConfig_userId_fkey"    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageTemplate"   ADD CONSTRAINT "MessageTemplate_userId_fkey"   FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageAutomation" ADD CONSTRAINT "MessageAutomation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageLog"        ADD CONSTRAINT "MessageLog_userId_fkey"        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------ 7. o tenant manda no dado
ALTER TABLE "User"              ADD CONSTRAINT "User_tenantId_fkey"              FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student"           ADD CONSTRAINT "Student_tenantId_fkey"           FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Plan"              ADD CONSTRAINT "Plan_tenantId_fkey"              FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceEntry"      ADD CONSTRAINT "FinanceEntry_tenantId_fkey"      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category"          ADD CONSTRAINT "Category_tenantId_fkey"          FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Supplier"          ADD CONSTRAINT "Supplier_tenantId_fkey"          FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Promotion"         ADD CONSTRAINT "Promotion_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappConfig"    ADD CONSTRAINT "WhatsappConfig_tenantId_fkey"    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageTemplate"   ADD CONSTRAINT "MessageTemplate_tenantId_fkey"   FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAutomation" ADD CONSTRAINT "MessageAutomation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageLog"        ADD CONSTRAINT "MessageLog_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------- 8. índices e unicidade agora por academia
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "Student_email_key";
DROP INDEX IF EXISTS "Plan_name_key";
DROP INDEX IF EXISTS "Plan_userId_isDefault_idx";
DROP INDEX IF EXISTS "FinanceEntry_userId_date_idx";
DROP INDEX IF EXISTS "FinanceEntry_userId_status_idx";
DROP INDEX IF EXISTS "Promotion_userId_isActive_idx";
DROP INDEX IF EXISTS "WhatsappConfig_userId_isActive_idx";
DROP INDEX IF EXISTS "MessageTemplate_userId_event_idx";
DROP INDEX IF EXISTS "MessageAutomation_userId_event_key";
DROP INDEX IF EXISTS "MessageLog_userId_createdAt_idx";

CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX "Student_tenantId_idx" ON "Student"("tenantId");
CREATE UNIQUE INDEX "Student_tenantId_email_key" ON "Student"("tenantId", "email");
CREATE INDEX "Plan_tenantId_isDefault_idx" ON "Plan"("tenantId", "isDefault");
CREATE UNIQUE INDEX "Plan_tenantId_name_key" ON "Plan"("tenantId", "name");
CREATE INDEX "FinanceEntry_tenantId_date_idx" ON "FinanceEntry"("tenantId", "date");
CREATE INDEX "FinanceEntry_tenantId_status_idx" ON "FinanceEntry"("tenantId", "status");
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");
CREATE INDEX "Promotion_tenantId_isActive_idx" ON "Promotion"("tenantId", "isActive");
CREATE INDEX "WhatsappConfig_tenantId_isActive_idx" ON "WhatsappConfig"("tenantId", "isActive");
CREATE INDEX "MessageTemplate_tenantId_event_idx" ON "MessageTemplate"("tenantId", "event");
CREATE UNIQUE INDEX "MessageAutomation_tenantId_event_key" ON "MessageAutomation"("tenantId", "event");
CREATE INDEX "MessageLog_tenantId_createdAt_idx" ON "MessageLog"("tenantId", "createdAt");
