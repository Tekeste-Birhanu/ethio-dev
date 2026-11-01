ALTER TABLE "Request"
ADD COLUMN "workspaceId" TEXT;

CREATE INDEX "Request_workspaceId_idx" ON "Request"("workspaceId");

ALTER TABLE "Request"
ADD CONSTRAINT "Request_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
