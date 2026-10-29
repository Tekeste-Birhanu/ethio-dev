ALTER TABLE "Opportunity"
RENAME COLUMN "workCity" TO "city";

ALTER TABLE "Opportunity"
DROP COLUMN "workSetup";

DROP TYPE "WorkSetup";
