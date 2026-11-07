-- Conta master criada por outro master nasce com senha temporária, e a troca
-- é a primeira coisa que ela faz. Contas que já existem ficam como estão.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
