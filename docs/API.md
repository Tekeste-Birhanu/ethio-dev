# API

The API is served by Express under `/api`. State-changing requests use the signed-in member's HttpOnly session cookie and same-origin checks. Public reads do not require a session.

## Private chat requests

### Send a chat request

`POST /api/chat/requests`

Requires a signed-in member with a completed profile. Accepts `{ "recipientId": "..." }`; chat requests have no message field. A member cannot request a chat with themselves or send another request while a request between the pair is pending or an active private conversation exists. A new request may be sent after a prior request was declined or its accepted conversation was deleted.

Success returns `201` with `{ "request": { "id": "...", "status": "PENDING", "createdAt": "...", "recipient": { "id": "...", "name": "...", "username": "..." } } }`. Invalid input returns `400`; an incomplete profile returns `403`; an unknown developer returns `404`; an existing pending or accepted request returns `409`; unauthenticated requests return `401`.

### Check a request with a developer

`GET /api/chat/requests/with/:username`

Requires a signed-in member. Returns the latest active chat-request state between the member and the named developer, as `{ "status": "NONE" }` or `{ "status": "PENDING|ACCEPTED|DECLINED", "direction": "OUTGOING|INCOMING" }`. An accepted request is reported as `NONE` after its conversation ends, allowing a new request while preserving the resolved request in history. This private status is not part of public profile data.

### List incoming chat requests

`GET /api/chat/requests/incoming`

Requires a signed-in member. Returns only that member's pending chat requests, oldest first, with each sender's public `id`, `name`, and `username`.

Success returns `200` with `{ "requests": [...] }`; unauthenticated requests return `401`.

### Accept or decline a chat request

`PATCH /api/chat/requests/:id`

Requires the intended recipient. Accepts `{ "status": "ACCEPTED" }` or `{ "status": "DECLINED" }`. Acceptance atomically records the decision, creates or opens the private conversation, and saves an unread acceptance notification for the requester. Repeating an accepted request returns the same conversation and does not create another notification. Declining does not notify the requester.

Acceptance returns `200` with `{ "request": { "id": "...", "status": "ACCEPTED" }, "conversation": { "id": "...", "createdAt": "...", "participants": [...] } }`. Decline returns `200` with `{ "request": { "id": "...", "status": "DECLINED" } }`. Invalid status returns `400`; unauthenticated requests return `401`; missing or non-owned requests return `404`; already resolved requests return `409`.

### Poll and read an acceptance alert

`GET /api/chat/notifications/chat-alert` returns the oldest unread chat acceptance, collaboration-request acceptance, or private-message alert for the signed-in member, or `{ "notification": null }`. Acceptance alerts include the accepting member's public identity. Collaboration acceptance alerts also include the accepted request and its Collabspace destination, if selected; private-chat acceptance includes the conversation ID. Message alerts include the sender's public identity and conversation ID for the small temporary Chat toast. The toast marks an alert read with `PATCH /api/chat/notifications/:id/read`; this endpoint only affects an unread supported alert belonging to the current member and returns `{ "read": true }`. Both routes require authentication; the PATCH also requires same-origin.

`GET /api/chat/notifications` returns up to 50 persisted chat-request and collaboration-request acceptance notifications, newest first, with their read timestamp and accepted-request context. Incoming private-message alerts are intentionally excluded from the Notifications page and remain available through the Chat toast endpoint above. The endpoint requires authentication.

## Collaboration requests

### Create a collaboration request

`POST /api/opportunities/:id/requests`

Requires same-origin and a signed-in member with a completed profile. Accepts an optional `{ "message": "..." }`; the message is trimmed and limited to 1,000 characters, and an omitted or blank message is stored as `null`. The signed-in member is recorded as the requester, and the opportunity owner is the recipient. The request is associated with the opportunity and starts with `PENDING` status. Members cannot request to collaborate on their own opportunity, send a request for a non-Open opportunity, or create another request while a previous one is pending, accepted, or declined. A withdrawn request may be sent again. Missing or deleted opportunities return `404`; invalid IDs or messages and requests to one's own opportunity return `400`; an incomplete profile returns `403`; non-Open opportunities and prior pending, accepted, or declined requests return `409`; unauthenticated requests return `401`.

Success returns `201` with `{ "request": { "id": "...", "status": "PENDING", "message": "...", "createdAt": "...", "opportunity": { "id": "...", "description": "..." }, "recipient": { "id": "...", "name": "...", "username": "..." } } }`.

### List outgoing collaboration request statuses for opportunities

`GET /api/opportunities/requests/statuses`

Requires a signed-in member. Returns the opportunity ID and status for the member's latest pending, accepted, or declined request per opportunity as `{ "requests": [{ "opportunityId": "...", "status": "PENDING|ACCEPTED|DECLINED" }] }`. Withdrawn requests are omitted so the member can request again. Unauthenticated requests return `401`.

### List sent collaboration requests

`GET /api/opportunities/requests`

Requires a signed-in member. Returns that member's collaboration requests, newest first, with each request's ID, status, optional message, creation time, recipient's public identity, and opportunity description/status. Deleted opportunities are identified with `isDeleted: true`; no private account fields are returned. Unauthenticated requests return `401`.

### List incoming collaboration requests

`GET /api/opportunities/requests/incoming`

Requires a signed-in member. Returns pending collaboration requests on the member's own undeleted Open or Paused opportunities and previously accepted or declined requests on the member's opportunities, newest first. Each item includes its status, optional message, creation time, opportunity context, and the sender's public profile fields (name, username, city, experience, description, and skills). Private account fields are excluded. Resolved requests remain available as notification history even if the opportunity is later closed or deleted. Unauthenticated requests return `401`.

### Accept or decline a collaboration request

`PATCH /api/opportunities/requests/:id`

Requires same-origin and the owner of the request's opportunity. Accepts `{ "status": "DECLINED" }` or one of `{ "status": "ACCEPTED", "destination": { "type": "PRIVATE_CHAT" } }`, `{ "status": "ACCEPTED", "destination": { "type": "COLLABSPACE", "workspaceId": "..." } }`, or `{ "status": "ACCEPTED", "destination": { "type": "CREATE_COLLABSPACE", "name": "..." } }`. Open and Paused opportunity requests can be resolved. Private-chat acceptance creates or opens the pair's active conversation. Collabspace acceptance requires an active Owner or Admin membership for the opportunity owner and adds the requester as an active Member. Creating a space, adding the requester, resolving the request, and creating its unread acceptance notification happen in one transaction; canceling in the client sends no request. Acceptance returns `{ "request": { "id": "...", "status": "ACCEPTED", "workspaceId": "...", "conversationId": "..." } }` (the unused destination ID is `null`). Decline returns `{ "request": { "id": "...", "status": "DECLINED", "workspaceId": null, "conversationId": null } }` and creates no notification. A missing request returns `404`; an unauthorized/missing space returns `404`; a resolved or completed/deleted opportunity request returns `409`; invalid status or destination returns `400`; invalid space name returns `400`; transaction conflicts return `409`; unauthenticated requests return `401`.

## Private conversations

### List private conversations

`GET /api/chat/conversations`

Requires a signed-in member. Returns only active private conversations in which the member participates, ordered by most recent message. Each item includes the other participant's public identity, latest message preview, that member's derived unread message count, and `isMuted` for the signed-in member's own mute setting. Muting suppresses private-message alerts but does not stop message delivery or unread counting. Group conversations and ended private conversations are excluded.

### Read conversation history

`GET /api/chat/conversations/:id/messages?before=:messageId`

Requires one of the two current participants in an active private conversation. Returns up to 100 messages in chronological order, with sender's public identity. Omit `before` for the newest page; pass the previous page's `nextCursor` to load older messages. The response contains `{ "messages": [...], "hasMore": true, "nextCursor": "..." }`; the cursor is `null` when the full history has been returned. Invalid cursors return `400`; inaccessible or ended conversations return `404`.

The client links to a conversation at `/chat?conversation=:id`. The identifier only selects a conversation in the participant-scoped list; it does not grant access. Message history, read markers, deletion, and WebSocket message delivery each enforce current participant membership server-side. Inaccessible or ended conversations are not returned by the list or message-history APIs.

### Delete a private conversation

`DELETE /api/chat/conversations/:id`

Requires same-origin and either participant in an active private conversation. The server ends the conversation and deletes its messages in one transaction, then sends a `conversation.ended` WebSocket event to connected sessions for both participants. Returns `204`; inaccessible or already ended conversations return `404`; a concurrent change returns `409`.

### Mark visible conversation messages as read

`PATCH /api/chat/conversations/:id/read`

Requires same-origin and a current participant in an active private conversation. Accepts `{ "throughMessageId": "..." }`, a message in the conversation that the member has loaded. The server records that message's timestamp as the participant's `lastReadAt`; omitting the marker leaves read state unchanged. This keeps messages that arrive after the loaded history unread. Returns `{ "read": true }`; invalid markers return `400`; inaccessible conversations return `404`.

### Edit a private message

`PATCH /api/chat/conversations/:id/messages/:messageId`

Requires same-origin, an active conversation participant, and the message author. Accepts `{ "content": "..." }` with trimmed text of 1–5,000 characters. Success returns `{ "message": ... }` with `editedAt` set and broadcasts `message.updated` to both participants' connected sessions. Invalid content returns `400`; a message that is missing, outside the conversation, or authored by another member returns `404`.

### Delete a private message

`DELETE /api/chat/conversations/:id/messages/:messageId`

Requires same-origin, an active conversation participant, and the message author. Deletes the message and its associated message alert. Success returns `204` and broadcasts `{ "type": "message.deleted", "conversationId": "...", "messageId": "..." }` to both participants' connected sessions. Each client removes the message and refreshes its conversation preview and unread count. A message that is missing, outside the conversation, or authored by another member returns `404`.

### Mute or unmute a private conversation

`PATCH /api/chat/conversations/:id/mute`

Requires same-origin and a current participant in an active private conversation. Accepts `{ "muted": true }` or `{ "muted": false }` and changes only the signed-in participant's mute setting. Success returns `{ "muted": true|false }`; invalid values return `400`; inaccessible or ended conversations return `404`. Muted conversations continue receiving messages and accumulating unread messages; private-message alerts are suppressed for the muted participant.

### Send and receive private messages

Connect to `/api/chat/socket` using `ws:` locally or `wss:` over HTTPS. The browser must send its matching `Origin` header and the signed-in HttpOnly session cookie. The server rejects missing, expired, or invalid sessions and unexpected origins.

Send a JSON event `{ "type": "message.send", "conversationId": "...", "clientMessageId": "...", "content": "..." }`. `clientMessageId` is a retry key unique per sender; reuse it only for retrying the same content in the same conversation. Content is trimmed and must contain 1–5,000 characters. Attachments are not supported.

The server checks current private-conversation membership and session validity, persists the message and recipient alert, then broadcasts `{ "type": "message.created", "message": ... }` to connected sessions for the two participants and acknowledges the sender with `{ "type": "message.ack", "clientMessageId": "...", "message": ... }`. Successful edits and deletions broadcast `message.updated` and `message.deleted` events to both participants. Validation, authorization, and delivery failures return a JSON `{ "type": "error", "code": "...", "message": "..." }` event. The client reloads REST history after reconnecting and safely retries any send whose result was uncertain.

## Opportunities

### List opportunities

`GET /api/opportunities`

Public. Returns up to 20 non-deleted opportunities in any status (Open, Paused, or Completed), including each post's public owner identity and matching metadata. Results are ordered newest first, with IDs as a stable tie-breaker. Pass the previous response's `nextCursor` as the `cursor` query parameter to load the next page. An optional case-insensitive `q` parameter (up to 100 characters) searches post text, owner name and username, owner or opportunity city, and owner or requested skills. Optional `skill` and `city` parameters (up to 60 characters) filter requested skills and opportunity city; `experience` accepts `BEGINNER`, `JUNIOR`, `INTERMEDIATE`, or `SENIOR` and filters the experience sought. Filters combine with `q` and `cursor`; invalid experience values return `400`.

Success returns `200` with `{ "opportunities": [...], "hasMore": true, "nextCursor": "..." }`. `nextCursor` is `null` when there are no more results. A server error returns `500`.

### Create an opportunity

`POST /api/opportunities`

Requires a signed-in member with a name and username. The server assigns the owner and initializes status to `OPEN` and comments to enabled; client-supplied ownership, status, and comment settings are ignored.

```json
{
  "description": "Looking for a frontend developer to help build a study planner.",
  "categories": ["WEB", "MOBILE"],
  "skillsSought": ["react", "typescript"],
  "experienceSought": "JUNIOR",
  "city": "Addis Ababa"
}
```

Only `description` is required. `categories` and `skillsSought` default to empty arrays; experience sought and city may be omitted or set to `null`. City is optional and provides local collaboration context. Supported category values are `WEB`, `MOBILE`, `DESKTOP`, `DATA_AI`, `GAMES`, `DEVELOPER_TOOLS_OPEN_SOURCE`, `HARDWARE_IOT`, and `OTHER`. Experience values are `BEGINNER`, `JUNIOR`, `INTERMEDIATE`, and `SENIOR`.

Success returns `201` with `{ "opportunity": ... }`. Validation errors return `400` with field errors; unauthenticated requests return `401`; incomplete profiles return `403`.

### List your opportunities

`GET /api/opportunities/mine`

Requires a signed-in member. Returns all of the member's non-deleted opportunities, ordered newest first. Opportunity records do not include Collabspace data.

Success returns `200` with `{ "opportunities": [...] }`; unauthenticated requests return `401`.

### Create a standalone Collabspace

`POST /api/collabspaces`

Requires same-origin and a signed-in member. Accepts `{ "name": "Study Planner team" }` with a trimmed name of 1–100 characters. The server creates the standalone Collabspace and an active Owner membership for the creator atomically. Invalid names return `400`; unauthenticated requests return `401`; a transaction conflict returns `409`.

Success returns `201` with `{ "collabspace": { "id": "...", "name": "...", "createdAt": "..." } }`.

### List your Collabspaces

`GET /api/collabspaces`

Requires a signed-in member. Returns Collabspaces where the member has an active membership, ordered newest first. Each item includes its ID, name, the signed-in member's role, and derived unread group-message count. No private account fields are returned.

Success returns `200` with `{ "collabspaces": [...] }`; unauthenticated requests return `401`.

### View a Collabspace overview

`GET /api/collabspaces/:id`

Requires an active member of a Collabspace. Returns its name, member identities and roles, and the group conversation ID when one exists. User email and other private account fields are excluded. Nonmembers and unknown IDs receive the same `404` response; unauthenticated requests return `401`.

Success returns `200` with `{ "collabspace": { ... } }`.

### Rename a Collabspace

`PATCH /api/collabspaces/:id`

Requires same-origin and the active Collabspace Owner. Accepts `{ "name": "Study Planner team" }`; the server trims whitespace and requires a name of 1–100 characters. The updated name is returned for the client to show across the space. Invalid names return `400`; non-owners and unknown spaces return `404`; concurrent changes return `409`; unauthenticated requests return `401`.

### Manage Collabspace membership

`PATCH /api/collabspaces/:id/members/:userId/role` accepts `{ "role": "ADMIN" }` or `{ "role": "MEMBER" }`. Only the Collabspace Owner can change an active member's role; the Owner role cannot be changed. Success returns `{ "membership": { "id": "...", "role": "ADMIN|MEMBER", "status": "ACTIVE" } }`.

`DELETE /api/collabspaces/:id/members/:userId` ends the target's active membership immediately. Owners can remove admins or members; admins can remove regular members only; members can use this endpoint for themselves to leave. The Collabspace Owner cannot leave, and admins cannot remove themselves or another admin through this route. The membership record is retained with status `REMOVED` or `LEFT` and an `endedAt` timestamp. The response is `204`; inaccessible targets return `404`, and concurrent membership changes return `409`. New members must first accept a collaboration request or invitation; this endpoint does not add members.

### Permanently delete a Collabspace

`DELETE /api/collabspaces/:id`

Requires same-origin and the active Collabspace Owner. Permanently deletes the Collabspace and its dependent memberships, group conversation, and messages. The client must show a clear warning that all members lose access and group chat history is permanently removed before calling this endpoint. Success returns `204`; non-owners and unknown spaces return `404`; concurrent changes return `409`; unauthenticated requests return `401`.

### Read Collabspace group chat history

`GET /api/collabspaces/:id/messages?before=:messageId`

Requires an active member of a Collabspace. The first request creates its single group conversation if needed. Returns up to 100 messages in chronological order, sender public identity, `conversationId`, `hasMore`, `nextCursor`, the member's `unreadCount`, and whether the member can write. Omit `before` for the newest page; pass `nextCursor` to load older history. Inaccessible spaces return `404`; invalid cursors return `400`.

### Mark Collabspace group messages as read

`PATCH /api/collabspaces/:id/read`

Requires same-origin and membership with access to the space. Accepts `{ "throughMessageId": "..." }` for a message in its group conversation and advances only the signed-in member's read marker. Returns `{ "read": true, "unreadCount": 0 }`; an invalid marker returns `400`; inaccessible spaces return `404`.

### Edit a Collabspace group message

`PATCH /api/collabspaces/:id/messages/:messageId`

Requires same-origin, active membership, and the message author. Accepts `{ "content": "..." }` with trimmed text of 1–5,000 characters. Success returns `{ "message": ... }` and broadcasts `message.updated` to current members.

### Delete a Collabspace group message

`DELETE /api/collabspaces/:id/messages/:messageId`

Requires same-origin and active membership. The author may delete their own message; owners and admins may also delete group messages from other members. Success returns `204` and broadcasts `group.message.deleted` to current members.

### Send and receive Collabspace group messages

Use the authenticated `/api/chat/socket` connection described under private messaging and send the same `{ "type": "message.send", "conversationId": "...", "clientMessageId": "...", "content": "..." }` event. The server verifies current active Collabspace membership, persists the message, then broadcasts `group.message.created` and acknowledges the sender with `group.message.ack`. Group messages are sent to current member sessions only and do not create notifications. Edits and deletions broadcast `group.message.updated` and `group.message.deleted` to current members.

### List a developer’s opportunities

`GET /api/opportunities/user/:username`

Public. Returns all non-deleted opportunities posted by the named developer, ordered newest first. Unknown usernames return `404`.

Success returns `200` with `{ "opportunities": [...] }`.

### List saved opportunities

`GET /api/opportunities/saved`

Requires a signed-in member. Returns only that member's saved, non-deleted opportunities, ordered by most recently saved.

Success returns `200` with `{ "opportunities": [...] }`; unauthenticated requests return `401`.

### Save an opportunity

`POST /api/opportunities/:id/save`

Requires a signed-in member. Saving the same opportunity more than once is safe and keeps one private saved record.

Success returns `200` with `{ "saved": true }`; unauthenticated requests return `401`; deleted or unknown opportunities return `404`.

### Unsave an opportunity

`DELETE /api/opportunities/:id/save`

Requires a signed-in member. Removes that member's saved record if present.

Success returns `204`; unauthenticated requests return `401`.

### Edit an opportunity

`PATCH /api/opportunities/:id`

Requires the opportunity owner. Accepts the same fields and validation rules as creation. A member who does not own the opportunity, or an opportunity that was deleted, receives `404`.

Success returns `200` with `{ "opportunity": ... }`; validation errors return `400`; unauthenticated requests return `401`.

### Change an opportunity status

`PATCH /api/opportunities/:id/status`

Requires the opportunity owner. Send `{ "status": "PAUSED" }`, `{ "status": "OPEN" }`, or `{ "status": "COMPLETED" }` for an allowed status transition. Completion is terminal and must be confirmed in the client; the server rejects attempts to reopen a completed opportunity and all status changes to a deleted post.

Completing an opportunity atomically changes its pending collaboration requests to `CANCELED` and records their resolution time.

## Developer invitations

### Load invitation destinations

`GET /api/invitations/options`

Requires a signed-in member. Returns the member's undeleted Open opportunities, which can be used to invite a developer to private chat, and Collabspaces where they are an active Owner or Admin. Paused and Completed opportunities are not available for new invitations.

### Send an invitation

`POST /api/invitations`

Requires same-origin, a signed-in member with a completed profile, and a different developer as recipient. For a private-chat invitation send `{ "recipientId": "...", "type": "CHAT_INVITATION", "opportunityId": "...", "message": "..." }`; the opportunity must be Open and owned by the inviter. For a Collabspace invitation send `{ "recipientId": "...", "type": "COLLABSPACE_INVITATION", "workspaceId": "...", "message": "..." }`; the inviter must be an active Owner or Admin. `message` is optional, trimmed, and limited to 1,000 characters. Creating an invitation does not create a conversation or membership. Success returns `201` with the invitation ID, type, status, creation time, and recipient's public identity. Invalid input returns `400`; unknown recipients or unauthorized destinations return `404`; closed opportunities, active chats/memberships, and prior pending or declined invitations to the same destination return `409`; unauthenticated requests return `401`.

### List sent invitations

`GET /api/invitations`

Requires a signed-in member. Returns their sent invitations newest first with status, recipient identity, optional message, and opportunity or Collabspace context. Private account fields are excluded.

### List incoming invitations

`GET /api/invitations/incoming`

Requires a signed-in member. Returns pending invitations addressed to them, newest first, with the inviter's public profile, optional message, and destination context. Unauthenticated requests return `401`.

### Accept or decline an invitation

`PATCH /api/invitations/:id`

Requires same-origin and the invitation recipient. Accepts `{ "status": "ACCEPTED" }` or `{ "status": "DECLINED" }`. Acceptance atomically marks the invitation resolved and either creates/opens the private conversation or activates the invitee's Collabspace membership. The invitee gains no access before acceptance. A Collabspace invitation is accepted only while the inviter remains an active Owner or Admin; an invitee already in that space receives `409`. A missing/non-owned invitation returns `404`; an already-resolved or no-longer-authorized destination returns `409`; invalid status returns `400`; transaction conflicts return `409`; unauthenticated requests return `401`.

### Withdraw a sent invitation

`DELETE /api/invitations/:id`

Requires same-origin and the invitation sender. Withdraws only a pending invitation and retains it with `WITHDRAWN` status for history. Success returns `204`; a missing, resolved, or non-owned invitation returns `404`; unauthenticated requests return `401`.

Completing or deleting an opportunity cancels its pending collaboration requests and opportunity-linked private-chat invitations. Deleting a Collabspace cancels its pending invitations before removing the space.

Success returns `200` with `{ "opportunity": ... }`; invalid statuses or transitions return `400`; unauthenticated requests return `401`; unknown, deleted, or non-owned opportunities return `404`.

### Delete an opportunity

`DELETE /api/opportunities/:id`

Requires the opportunity owner. Soft-deletes the post so it no longer appears in discovery or the owner's active list. A member who does not own the opportunity, or an opportunity that was already deleted, receives `404`.

Success returns `204`; unauthenticated requests return `401`.

### Read an opportunity

`GET /api/opportunities/:id`

Public. Returns the opportunity, its categories and sought skills, and the owner's public name and username. Deleted opportunities return `404`.

Success returns `200` with `{ "opportunity": ... }`. An unknown or deleted opportunity returns `404`.

The client shares opportunities with a stable public URL at `/opportunities/:id`; opening it loads this same opportunity record.

### List opportunity comments

`GET /api/opportunities/:id/comments`

Public. Returns flat comments in chronological order and the opportunity's `commentsEnabled` setting.

Success returns `200` with `{ "comments": [...], "commentsEnabled": true }`; deleted or unknown opportunities return `404`.

### Add an opportunity comment

`POST /api/opportunities/:id/comments`

Requires a signed-in member. Accepts `{ "text": "..." }` with non-empty text up to 1,000 characters. The server assigns the comment author. Comments cannot be added when the opportunity owner has turned them off.

Success returns `201` with `{ "comment": ... }`; invalid text returns `400`; unauthenticated requests return `401`; disabled comments return `403`; deleted or unknown opportunities return `404`.

### Delete an opportunity comment

`DELETE /api/opportunities/:id/comments/:commentId`

Requires the comment author or opportunity owner. Success returns `204`; unauthenticated requests return `401`; missing comments and unauthorized deletion return `404`.

### Edit an opportunity comment

`PATCH /api/opportunities/:id/comments/:commentId`

Requires the comment author. Accepts `{ "text": "..." }` with non-empty text up to 1,000 characters. Success returns `200` with `{ "comment": ... }`; invalid text returns `400`; unauthenticated requests return `401`; missing comments and unauthorized edits return `404`.

### Turn opportunity comments on or off

`PATCH /api/opportunities/:id/comments`

Requires the opportunity owner. Accepts `{ "commentsEnabled": true }` or `{ "commentsEnabled": false }`. Success returns `200` with the updated setting; invalid values return `400`; unauthenticated requests return `401`; deleted, unknown, or non-owned opportunities return `404`.

## Profiles

### List public developer profiles

`GET /api/profiles?q=...&cursor=...`

Public. Returns up to 20 developer profiles with a username, including only public fields: name, username, city, experience, description (bio), skills, and profile creation date. An optional case-insensitive `q` parameter (up to 100 characters) searches name, username, city, and skills. Optional `skill` and `city` parameters (up to 60 characters) filter profile skills and city; `experience` accepts `BEGINNER`, `JUNIOR`, `INTERMEDIATE`, or `SENIOR` and filters experience. Filters combine with `q` and `cursor`; invalid experience values return `400`. Bio and opportunity content are not searched. Use the optional `cursor` from the previous response to fetch the next page with the same search and filters. Email and authentication data are never included.

Success returns `200` with `{ "profiles": [...], "hasMore": true, "nextCursor": "..." }`. `nextCursor` is `null` when there are no more profiles. A server error returns `500`.
