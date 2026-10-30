CREATE TYPE "RequestType" AS ENUM (
    'COLLABORATION_REQUEST',
    'CHAT_REQUEST',
    'CHAT_INVITATION',
    'COLLABSPACE_INVITATION'
);

CREATE TYPE "RequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'WITHDRAWN',
    'CANCELED'
);

CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "opportunityId" TEXT,
    "message" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Request_type_opportunity_message_check" CHECK (
        ("type" = 'CHAT_REQUEST' AND "opportunityId" IS NULL AND "message" IS NULL)
        OR ("type" <> 'CHAT_REQUEST' AND "opportunityId" IS NOT NULL)
    )
);

CREATE INDEX "Request_recipientId_status_createdAt_idx"
    ON "Request"("recipientId", "status", "createdAt");
CREATE INDEX "Request_senderId_createdAt_idx"
    ON "Request"("senderId", "createdAt");
CREATE INDEX "Request_opportunityId_idx"
    ON "Request"("opportunityId");
-- Keep only one pending chat request for each unordered user pair.
CREATE UNIQUE INDEX "Request_pending_chat_pair_key"
    ON "Request"(LEAST("senderId", "recipientId"), GREATEST("senderId", "recipientId"))
    WHERE "type" = 'CHAT_REQUEST' AND "status" = 'PENDING';

ALTER TABLE "Request"
    ADD CONSTRAINT "Request_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Request"
    ADD CONSTRAINT "Request_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Request"
    ADD CONSTRAINT "Request_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
