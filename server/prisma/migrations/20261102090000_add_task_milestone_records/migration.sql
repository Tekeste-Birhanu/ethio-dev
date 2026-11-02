CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Milestone_workspaceId_position_idx" ON "Milestone"("workspaceId", "position");
CREATE INDEX "Task_milestoneId_status_position_idx" ON "Task"("milestoneId", "status", "position");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

ALTER TABLE "Milestone"
ADD CONSTRAINT "Milestone_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_milestoneId_fkey"
FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_assigneeId_fkey"
FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
