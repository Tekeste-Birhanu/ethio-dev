-- Accepted profile chat requests must have an active private conversation.
-- Older accepted requests may predate conversation creation on acceptance.
WITH accepted_pairs AS (
    SELECT
        LEAST("senderId", "recipientId") AS "userA",
        GREATEST("senderId", "recipientId") AS "userB",
        MIN(COALESCE("resolvedAt", "updatedAt", "createdAt")) AS "createdAt"
    FROM "Request"
    WHERE "type" = 'CHAT_REQUEST'
      AND "status" = 'ACCEPTED'
    GROUP BY LEAST("senderId", "recipientId"), GREATEST("senderId", "recipientId")
), missing_pairs AS (
    SELECT pair.*
    FROM accepted_pairs AS pair
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Conversation" AS conversation
        WHERE conversation."type" = 'PRIVATE'
          AND conversation."endedAt" IS NULL
          AND EXISTS (
              SELECT 1 FROM "PrivateConversationParticipant" AS participant
              WHERE participant."conversationId" = conversation."id"
                AND participant."userId" = pair."userA"
          )
          AND EXISTS (
              SELECT 1 FROM "PrivateConversationParticipant" AS participant
              WHERE participant."conversationId" = conversation."id"
                AND participant."userId" = pair."userB"
          )
          AND NOT EXISTS (
              SELECT 1 FROM "PrivateConversationParticipant" AS participant
              WHERE participant."conversationId" = conversation."id"
                AND participant."userId" NOT IN (pair."userA", pair."userB")
          )
    )
)
INSERT INTO "Conversation" ("id", "type", "createdAt")
SELECT
    'cb_' || MD5('private-chat:' || pair."userA" || ':' || pair."userB"),
    'PRIVATE',
    pair."createdAt"
FROM missing_pairs AS pair;

WITH accepted_pairs AS (
    SELECT
        LEAST("senderId", "recipientId") AS "userA",
        GREATEST("senderId", "recipientId") AS "userB"
    FROM "Request"
    WHERE "type" = 'CHAT_REQUEST'
      AND "status" = 'ACCEPTED'
    GROUP BY LEAST("senderId", "recipientId"), GREATEST("senderId", "recipientId")
)
INSERT INTO "PrivateConversationParticipant" ("conversationId", "userId")
SELECT conversation_id."id", participants."userId"
FROM accepted_pairs AS pair
CROSS JOIN LATERAL (
    SELECT 'cb_' || MD5('private-chat:' || pair."userA" || ':' || pair."userB") AS "id"
) AS conversation_id
CROSS JOIN LATERAL (VALUES (pair."userA"), (pair."userB")) AS participants("userId")
WHERE EXISTS (
    SELECT 1 FROM "Conversation" AS conversation
    WHERE conversation."id" = conversation_id."id"
      AND conversation."type" = 'PRIVATE'
      AND conversation."endedAt" IS NULL
)
ON CONFLICT ("conversationId", "userId") DO NOTHING;
