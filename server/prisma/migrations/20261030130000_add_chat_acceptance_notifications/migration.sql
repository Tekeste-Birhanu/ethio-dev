CREATE TYPE "NotificationType" AS ENUM ('CHAT_REQUEST_ACCEPTED');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "requestId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Notification_source_check" CHECK (
        "type" = 'CHAT_REQUEST_ACCEPTED' AND "requestId" IS NOT NULL AND "messageId" IS NULL
    )
);

CREATE UNIQUE INDEX "Notification_requestId_key" ON "Notification"("requestId");
CREATE UNIQUE INDEX "Notification_messageId_key" ON "Notification"("messageId");
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx"
    ON "Notification"("recipientId", "readAt", "createdAt");

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
