ALTER TABLE "Task"
DROP CONSTRAINT "Task_milestoneId_fkey";

ALTER TABLE "Task"
ADD CONSTRAINT "Task_milestoneId_fkey"
FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
