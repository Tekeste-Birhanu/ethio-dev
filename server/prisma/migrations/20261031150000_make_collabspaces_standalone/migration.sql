ALTER TABLE "Workspace"
    DROP CONSTRAINT "Workspace_opportunityId_fkey";

DROP INDEX "Workspace_opportunityId_key";

ALTER TABLE "Workspace"
    DROP COLUMN "opportunityId",
    DROP COLUMN "status",
    DROP COLUMN "archivedAt";

DROP TYPE "WorkspaceStatus";
