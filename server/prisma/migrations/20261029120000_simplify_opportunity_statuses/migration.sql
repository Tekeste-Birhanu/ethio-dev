-- Preserve existing posts while retiring the Filled and Archived statuses.
-- A missing or invalid saved archive status falls back to Open.
UPDATE "Opportunity"
SET "status" = CASE
  WHEN "status" = 'FILLED' THEN 'PAUSED'::"OpportunityStatus"
  WHEN "status" = 'ARCHIVED' THEN CASE "statusBeforeArchive"
    WHEN 'OPEN' THEN 'OPEN'::"OpportunityStatus"
    WHEN 'PAUSED' THEN 'PAUSED'::"OpportunityStatus"
    WHEN 'FILLED' THEN 'PAUSED'::"OpportunityStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"OpportunityStatus"
    ELSE 'OPEN'::"OpportunityStatus"
  END
  ELSE "status"
END
WHERE "status" IN ('FILLED', 'ARCHIVED');

ALTER TABLE "Opportunity"
DROP COLUMN "statusBeforeArchive";

CREATE TYPE "OpportunityStatus_new" AS ENUM ('OPEN', 'PAUSED', 'COMPLETED');

ALTER TABLE "Opportunity"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Opportunity"
ALTER COLUMN "status" TYPE "OpportunityStatus_new"
USING ("status"::text::"OpportunityStatus_new");

DROP TYPE "OpportunityStatus";

ALTER TYPE "OpportunityStatus_new" RENAME TO "OpportunityStatus";

ALTER TABLE "Opportunity"
ALTER COLUMN "status" SET DEFAULT 'OPEN';
