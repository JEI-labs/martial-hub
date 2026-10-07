-- AlterEnum
ALTER TYPE "EWhatsappProvider" ADD VALUE 'META';

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "providerLanguage" TEXT DEFAULT 'pt_BR',
ADD COLUMN     "providerTemplateName" TEXT;
