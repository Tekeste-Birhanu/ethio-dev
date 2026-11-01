ALTER TABLE "Notification"
    DROP CONSTRAINT "Notification_source_check";

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_source_check" CHECK (
        ("type" IN ('CHAT_REQUEST_ACCEPTED', 'COLLABORATION_REQUEST_ACCEPTED') AND "requestId" IS NOT NULL AND "messageId" IS NULL)
        OR ("type" = 'PRIVATE_MESSAGE_RECEIVED' AND "requestId" IS NULL AND "messageId" IS NOT NULL)
    );
