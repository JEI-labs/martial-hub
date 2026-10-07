-- CreateEnum
CREATE TYPE "EGraduation" AS ENUM ('GRAU_1', 'GRAU_2', 'GRAU_3', 'GRAU_4', 'GRAU_5', 'GRAU_6', 'GRAU_7', 'GRAU_8', 'GRAU_9', 'GRAU_10', 'GRAU_11');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "graduation" "EGraduation";
