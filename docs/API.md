# API

The API is served by Express under `/api`. State-changing requests use the signed-in member's HttpOnly session cookie and same-origin checks. Public reads do not require a session.

## Opportunities

### List opportunities

`GET /api/opportunities`

Public. Returns the 30 newest non-deleted opportunities whose status is Open, Paused, or Filled, including each post's public owner identity and matching metadata. Completed and Archived opportunities are omitted from the default feed.

Success returns `200` with `{ "opportunities": [...] }`. A server error returns `500`.

### Create an opportunity

`POST /api/opportunities`

Requires a signed-in member with a name and username. The server assigns the owner and initializes status to `OPEN` and comments to enabled; client-supplied ownership, status, and comment settings are ignored.

```json
{
  "description": "Looking for a frontend developer to help build a study planner.",
  "categories": ["WEB", "MOBILE"],
  "skillsSought": ["react", "typescript"],
  "experienceSought": "JUNIOR",
  "workSetup": "REMOTE",
  "workCity": null
}
```

Only `description` is required. `categories` and `skillsSought` default to empty arrays; experience sought and work setup may be omitted or set to `null`. Supported category values are `WEB`, `MOBILE`, `DESKTOP`, `DATA_AI`, `GAMES`, `DEVELOPER_TOOLS_OPEN_SOURCE`, `HARDWARE_IOT`, and `OTHER`. Experience values are `BEGINNER`, `JUNIOR`, `INTERMEDIATE`, and `SENIOR`. Work setup values are `REMOTE`, `IN_PERSON`, and `HYBRID`; in-person or hybrid work requires `workCity`.

Success returns `201` with `{ "opportunity": ... }`. Validation errors return `400` with field errors; unauthenticated requests return `401`; incomplete profiles return `403`.

### List your opportunities

`GET /api/opportunities/mine`

Requires a signed-in member. Returns all of the member's non-deleted opportunities, including paused, filled, completed, and archived posts, ordered newest first.

Success returns `200` with `{ "opportunities": [...] }`; unauthenticated requests return `401`.

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

### Delete an opportunity

`DELETE /api/opportunities/:id`

Requires the opportunity owner. Soft-deletes the post so it no longer appears in discovery or the owner's active list. A member who does not own the opportunity, or an opportunity that was already deleted, receives `404`.

Success returns `204`; unauthenticated requests return `401`.

### Read an opportunity

`GET /api/opportunities/:id`

Public. Returns the opportunity, its categories and sought skills, and the owner's public name and username. Deleted opportunities return `404`; archived opportunities remain readable by their stable URL.

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
