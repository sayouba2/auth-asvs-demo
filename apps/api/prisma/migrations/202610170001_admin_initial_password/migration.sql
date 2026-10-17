-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "initialPasswordExpiresAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationRequest_email_key" ON "RegistrationRequest"("email");

