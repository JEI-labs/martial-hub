-- CreateEnum
CREATE TYPE "EAppointmentRecurrence" AS ENUM ('NONE', 'WEEKLY');

-- CreateEnum
CREATE TYPE "EAppointmentStatus" AS ENUM ('SCHEDULED', 'CANCELED');

-- CreateTable
CREATE TABLE "LessonType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "LessonType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "recurrence" "EAppointmentRecurrence" NOT NULL DEFAULT 'NONE',
    "repeatUntil" TIMESTAMP(3),
    "status" "EAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "price" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonTypeId" TEXT,
    "teacherId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentStudent" (
    "appointmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "AppointmentStudent_pkey" PRIMARY KEY ("appointmentId","studentId")
);

-- CreateTable
CREATE TABLE "AppointmentOccurrence" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "EAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paidAt" TIMESTAMP(3),
    "financeEntryId" TEXT,
    "appointmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonType_tenantId_idx" ON "LessonType"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonType_tenantId_name_key" ON "LessonType"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_startsAt_idx" ON "Appointment"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_teacherId_startsAt_idx" ON "Appointment"("teacherId", "startsAt");

-- CreateIndex
CREATE INDEX "AppointmentStudent_studentId_idx" ON "AppointmentStudent"("studentId");

-- CreateIndex
CREATE INDEX "AppointmentOccurrence_appointmentId_idx" ON "AppointmentOccurrence"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentOccurrence_appointmentId_date_key" ON "AppointmentOccurrence"("appointmentId", "date");

-- AddForeignKey
ALTER TABLE "LessonType" ADD CONSTRAINT "LessonType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_lessonTypeId_fkey" FOREIGN KEY ("lessonTypeId") REFERENCES "LessonType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStudent" ADD CONSTRAINT "AppointmentStudent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStudent" ADD CONSTRAINT "AppointmentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentOccurrence" ADD CONSTRAINT "AppointmentOccurrence_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aula particular entra no caixa por uma categoria própria, separada da
-- mensalidade. Ela nasce com a academia (ver `createTenant`); aqui é para as
-- que já existem, senão a primeira aula paga não teria onde cair.
INSERT INTO "Category" ("id", "name", "description", "status", "isFixed", "tenantId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Aulas particulares', 'Aulas avulsas e particulares da agenda', 'ACTIVE', true, t."id", now(), now()
  FROM "Tenant" t
 WHERE NOT EXISTS (
   SELECT 1 FROM "Category" c
    WHERE c."tenantId" = t."id" AND c."name" = 'Aulas particulares'
 );

-- Um tipo de aula para a agenda já abrir com alguma coisa escolhida. O preço
-- é um chute que a academia corrige em Cadastros; zerar seria pior, porque
-- aula de graça não avisa que está errada.
INSERT INTO "LessonType" ("id", "name", "price", "durationMinutes", "isDefault", "isActive", "tenantId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'Aula particular', 100, 60, true, true, t."id", now(), now()
  FROM "Tenant" t
 WHERE NOT EXISTS (
   SELECT 1 FROM "LessonType" l WHERE l."tenantId" = t."id"
 );
