CREATE UNIQUE INDEX "Request_pending_collaboration_per_opportunity_key"
    ON "Request"("senderId", "opportunityId")
    WHERE "type" = 'COLLABORATION_REQUEST' AND "status" = 'PENDING';
