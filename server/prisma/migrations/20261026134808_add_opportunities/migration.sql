-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'PAUSED', 'FILLED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkSetup" AS ENUM ('REMOTE', 'IN_PERSON', 'HYBRID');

-- CreateEnum
CREATE TYPE "OpportunityCategoryValue" AS ENUM ('WEB', 'MOBILE', 'DESKTOP', 'DATA_AI', 'GAMES', 'DEVELOPER_TOOLS_OPEN_SOURCE', 'HARDWARE_IOT', 'OTHER');

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "experienceSought" "Experience",
    "collaboratorTarget" INTEGER,
    "workSetup" "WorkSetup",
    "workCity" TEXT,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityCategory" (
    "opportunityId" TEXT NOT NULL,
    "category" "OpportunityCategoryValue" NOT NULL,

    CONSTRAINT "OpportunityCategory_pkey" PRIMARY KEY ("opportunityId","category")
);

-- CreateTable
CREATE TABLE "OpportunitySkill" (
    "opportunityId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunitySkill_pkey" PRIMARY KEY ("opportunityId","skillId")
);

-- CreateIndex
CREATE INDEX "Opportunity_status_createdAt_idx" ON "Opportunity"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_ownerId_createdAt_idx" ON "Opportunity"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityCategory_category_idx" ON "OpportunityCategory"("category");

-- CreateIndex
CREATE INDEX "OpportunitySkill_skillId_idx" ON "OpportunitySkill"("skillId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityCategory" ADD CONSTRAINT "OpportunityCategory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySkill" ADD CONSTRAINT "OpportunitySkill_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySkill" ADD CONSTRAINT "OpportunitySkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
