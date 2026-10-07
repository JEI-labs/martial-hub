-- Plano passa a dizer como é cobrado. O padrão mantém o comportamento
-- anterior (parcelas mensais), então nenhum plano existente muda de regime.
DO $$
BEGIN
  CREATE TYPE "EPlanBilling" AS ENUM ('MONTHLY', 'UPFRONT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "billing" "EPlanBilling" NOT NULL DEFAULT 'MONTHLY';
