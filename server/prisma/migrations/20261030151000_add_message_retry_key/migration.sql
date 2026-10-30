ALTER TABLE "Message"
    ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key"
    ON "Message"("senderId", "clientMessageId");

ALTER TABLE "Notification"
    DROP CONSTRAINT "Notification_source_check";

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_source_check" CHECK (
        ("type" = 'CHAT_REQUEST_ACCEPTED' AND "requestId" IS NOT NULL AND "messageId" IS NULL)
        OR ("type" = 'PRIVATE_MESSAGE_RECEIVED' AND "requestId" IS NULL AND "messageId" IS NOT NULL)
    );
