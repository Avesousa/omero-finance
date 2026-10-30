-- CreateTable
CREATE TABLE "AppErrorReport" (
    "id" TEXT NOT NULL,
    "householdId" TEXT,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppErrorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppErrorReport_createdAt_idx" ON "AppErrorReport"("createdAt");

-- CreateIndex
CREATE INDEX "AppErrorReport_source_code_idx" ON "AppErrorReport"("source", "code");

-- AddForeignKey
ALTER TABLE "AppErrorReport" ADD CONSTRAINT "AppErrorReport_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;
