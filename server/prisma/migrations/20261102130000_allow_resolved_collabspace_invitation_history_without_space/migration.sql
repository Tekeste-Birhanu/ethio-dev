ALTER TABLE "Request"
DROP CONSTRAINT "Request_type_opportunity_message_check";

ALTER TABLE "Request"
ADD CONSTRAINT "Request_type_opportunity_message_check" CHECK (
    ("type" = 'CHAT_REQUEST' AND "opportunityId" IS NULL AND "workspaceId" IS NULL AND "message" IS NULL)
    OR ("type" = 'COLLABORATION_REQUEST' AND "opportunityId" IS NOT NULL)
    OR ("type" = 'CHAT_INVITATION' AND "opportunityId" IS NOT NULL AND "workspaceId" IS NULL)
    OR ("type" = 'COLLABSPACE_INVITATION' AND ("workspaceId" IS NOT NULL OR "status" <> 'PENDING'))
);
