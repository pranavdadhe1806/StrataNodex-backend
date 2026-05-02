-- CreateTable
CREATE TABLE "CliSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CliSession_code_key" ON "CliSession"("code");
