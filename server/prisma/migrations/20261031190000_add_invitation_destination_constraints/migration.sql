CREATE UNIQUE INDEX "Request_chat_invitation_pair_key"
    ON "Request"(LEAST("senderId", "recipientId"), GREATEST("senderId", "recipientId"))
    WHERE "type" = 'CHAT_INVITATION' AND "status" IN ('PENDING', 'DECLINED');

CREATE UNIQUE INDEX "Request_collabspace_invitation_destination_key"
    ON "Request"("workspaceId", "recipientId")
    WHERE "type" = 'COLLABSPACE_INVITATION' AND "status" IN ('PENDING', 'DECLINED');
