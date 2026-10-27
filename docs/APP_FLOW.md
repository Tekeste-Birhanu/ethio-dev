# Application Flow

## 1. Purpose

This document describes how developers move through EthioDev to discover opportunities, connect with people, and work together. Product behavior and permissions are defined in `PRD.md`; visual guidance belongs in `DESIGN.md`.

## 2. Navigation map

Primary destinations have stable URLs. Discover keeps its selected tab in the URL; search text stays transient and clears on reload.

```text
Public entry
  ├── Discover
  │   ├── Opportunities tab → Opportunity post → Owner profile / collaboration request
  │   └── Developers tab → Developer profile → Chat request
  └── Sign in / register
      ├── Email/password registration (Full name, Username, Email, Password) → Sign in → Optional profile details (can skip) → Discover
      ├── Google sign-in (first time) → Create account with verified Google identity → Choose username → Optional profile details (can skip) → Discover
      └── Returning member sign-in → Discover

Signed-in navigation
  ├── Discover (Opportunities | Developers)
  │   └── Search → Results (Opportunities | Developers)
  │       └── Opportunity post expands inline; comments open in a dialog
  ├── Chat → Private conversations only
  ├── Collabspaces → Collabspace → Group chat / Members / Taskboard
  ├── Notifications → Incoming request or invitation → Review context → Accept / Decline
  └── My profile
      ├── Profile card
      ├── Requests → Outgoing requests and invitations
      ├── My Opportunities → Opportunity post / owner controls
      ├── Saved → Private saved opportunities
      ├── Edit profile
      └── Settings → Change password (password accounts only)

Discover → Create opportunity → Publish → Owner's post → Create Collabspace → Linked Collabspace
```

Discover is one page with Opportunities and Developers tabs. The Post opportunity action sits beside those tabs. Search stays inline, and only the active tab is stored in the URL (for example `/?tab=developers`); search text clears on reload. Switching between Discover and Profile updates the path; browser back and forward restore the previous destination and Discover tab. Chat remains visibly accessible as a primary destination. The owner's profile has Requests, My Opportunities, and Saved tabs; Requests and Saved are private. Other visitors see the public profile and My Opportunities only.

Requests are organized by direction. The Requests tab lists requests and invitations the member has sent in one chronological list. Each item identifies the recipient, related opportunity or Collabspace, and status. Pending items can be withdrawn; resolved items remain as history without further actions. Notifications is one chronological list of incoming requests, invitations, and private-message alerts, with unread items clearly indicated. Requests and invitations open their review context; message alerts open the relevant private chat. Comments do not create notifications.

## 3. Main journeys

### J-01 — Find an opportunity and request to join

- **Actor / role:** Developer seeking a project
- **Entry point:** Discover → Opportunities tab
- **Preconditions / access:** Anyone can browse public opportunities. A signed-in member with a completed profile can request collaboration.
- **Steps:**
  1. Browse the newest opportunities, or open Search and enter keywords or filters such as city, skills, experience, or work setup.
  2. Search results can be switched between Opportunities and Developers. Opportunity posts stay in the results: expand long text inline, open comments in a dialog, and open the owner's profile separately.
  3. Optionally save the post to the member's private Saved profile tab, share its stable `/opportunities/:id` URL, or add a comment if comments are enabled.
  4. Send a collaboration request with an optional message. The sent request appears in the member's private Requests tab as Pending.
  5. The owner receives an incoming notification. Opening it shows the request and applicant profile before the owner chooses to accept into a private chat, add directly to the Collabspace, or decline.
  6. Acceptance into a private chat opens the private conversation for both members; the applicant is not added to the Collabspace. The owner may invite them to the Collabspace later.
  7. Acceptance directly into the Collabspace adds the applicant as a member immediately. No second acceptance is required.
- **Success outcome:** The developer starts a private conversation with the owner or joins the project Collabspace.
- **Failure and recovery:** A pending request can be withdrawn from Requests. After withdrawal, the developer may submit another request. After decline, they cannot request again for that opportunity, though the owner may invite them. If the opportunity is Paused or Filled, no new requests can be sent, but pending requests remain reviewable. Completed opportunities do not accept new requests.
- **Related requirements:** F-02, F-04, F-06, F-07, F-10, F-12, F-17

### J-02 — Publish an opportunity and build a team

- **Actor / role:** Opportunity owner
- **Entry point:** Discover → Create opportunity
- **Preconditions / access:** Signed in with email/username and password or Google OAuth, and has a completed profile (name and username).
- **Steps:**
  1. Compose a title-free opportunity post with a description. Skill tags, categories, experience sought, and work setup are visible as optional controls beneath the post; the owner may publish with description only.
  2. Publish the opportunity. It appears in Discover; no Collabspace is created yet.
  3. From the owner's opportunity post, use Create Collabspace to open a focused dialog, enter a name, and create the space. The app explicitly links it to that opportunity. Cancel closes the dialog without creating a space; the owner can later open a created space from the opportunity.
  4. The owner receives incoming collaboration requests through Notifications. Opening a request shows the applicant profile and opportunity context before a decision.
  5. For each request, the owner can accept into private chat, add the applicant to the opportunity's linked Collabspace, or decline. If no linked space exists, choosing Add to Collabspace guides the owner to enter a name and create it, then adds the applicant. Canceling keeps the request pending.
  6. The owner may also invite a developer to private chat or directly to the existing linked Collabspace. The recipient must accept a direct invitation before the chat opens or membership begins.
  7. The owner can find and manage posts in My Opportunities under their profile. The post card has a three-dot actions menu for editing, pausing/reopening, marking Filled or Completed, archiving/unarchiving, and deleting. Choosing Delete opens a confirmation before the post is removed.
- **Success outcome:** A public opportunity is available for discovery. Its owner can create a named, linked Collabspace when ready to organize team work.
- **Failure and recovery:** Validation errors keep the owner in the creation flow with entered content available to correct. Paused and Filled opportunities stop new requests and invitations while pending requests remain reviewable. Completing the opportunity closes pending requests and invitations. Archiving removes the opportunity from active Discover results while retaining it on the owner's profile with an Archived tag; the owner can unarchive it. Deleting it requires confirmation; if it has a linked Collabspace, that space is archived as read-only for members who have access at that time.
- **Related requirements:** F-01, F-05, F-07, F-09, F-10, F-12, F-18

### J-03 — Find and contact a developer

- **Actor / role:** Signed-in member
- **Entry point:** Discover → Developers tab, or a developer profile shown on an opportunity
- **Preconditions / access:** Signed in to send a chat request. Public profile viewing is available to signed-in and signed-out visitors.
- **Steps:**
  1. Browse developers or search by name, username, skills, or city; apply relevant filters.
  2. Open a developer profile and review its public information.
  3. Send a chat request without a note. The outgoing request appears in Requests as Pending.
  4. The recipient sees an incoming notification. Opening it shows the sender profile and request context before the recipient accepts or declines.
  5. If accepted, a private conversation opens for both members and the requester receives an acceptance notification.
- **Success outcome:** The members can communicate in a private chat after the recipient accepts.
- **Failure and recovery:** A declined request sends no notification to the requester; its Requests row changes to Declined. The requester may send another chat request later, which appears as a new Requests row. A chat request does not create Collabspace membership.
- **Related requirements:** F-02, F-04, F-08, F-17

### J-04 — Work together in a Collabspace

- **Actor / role:** Owner, admin, or member
- **Entry point:** Collabspaces list, accepted invitation, or linked opportunity
- **Preconditions / access:** The developer is an accepted member. Direct addition after acceptance of a collaboration request takes effect immediately; a separately invited developer joins only after accepting the invitation.
- **Steps:**
  1. Open the Collabspace and use its group chat to communicate with the team.
  2. Open the shared taskboard and view milestones and tasks with To do, In progress, and Done statuses.
  3. An owner or admin creates, edits, and deletes empty milestones; creates and edits tasks, optionally sets due dates, and assigns one member to each task. Adding a task from a status column makes it inherit that milestone and status. An admin may assign a task to themselves. Tasks can be moved to another milestone before an empty milestone is deleted.
  4. An assignee updates the status of their own task by moving it between columns. Other current members see saved task changes live; the milestone's completed/total count updates too.
  5. The owner appoints or removes admins. Owners and admins manage regular member access; only the owner changes admin privileges. A member can also leave.
  6. When someone leaves or is removed, access ends and their open tasks become unassigned. Other members retain the team history.
- **Success outcome:** The team coordinates in one group conversation and tracks shared work on its taskboard.
- **Failure and recovery:** A non-member or removed member who opens a stale Collabspace link is told the space is unavailable to them and returned to an accessible destination. Archived spaces are read-only for members who belonged to the space when the opportunity was deleted.
- **Milestone deletion:** If the selected milestone still has tasks, explain that its tasks must be moved before deletion and provide a way to review them. Deleting an empty milestone requires confirmation and never deletes tasks.
- **Related requirements:** F-12, F-13, F-14, F-16, F-17, F-18

### J-05 — Finish and share a project

- **Actor / role:** Opportunity owner
- **Entry point:** My Opportunities under the owner's profile
- **Preconditions / access:** The owner controls the opportunity.
- **Steps:**
  1. Mark the opportunity Completed when the project is finished.
  2. Add one or more project, demo, or repository links if available.
  3. Share the completed opportunity post. The post remains visible in the owner's public My Opportunities list and can be found in Discover when Completed opportunities are included by a filter.
- **Success outcome:** The opportunity serves as a public record of completed work and can help developers discover project ideas and collaborators.
- **Failure and recovery:** Completion closes pending collaboration requests and invitations. The Collabspace remains available to its members for continued access to team work.
- **Related requirements:** F-10, F-11

### J-06 — Manage profile and password settings

- **Actor / role:** Signed-in member
- **Entry point:** Own Profile → Edit profile or Settings
- **Steps:**
  1. Edit profile details from the own profile page: name, username, city, experience, skills, and description.
  2. In Settings, members whose account has a password credential can change their password. Accounts without one do not show a password-change action.
- **Success outcome:** Profile changes are saved, and members with a password credential can update it in Settings.
- **Scope note:** Email changes are not available in the MVP.
- **Related requirements:** F-01

## 4. Screen and route inventory

Discover uses `/`; a public developer profile uses `/profile/:username`; the signed-in member's profile uses `/profile`; and a shared opportunity uses `/opportunities/:id`.

| Screen / destination           | Purpose                                                                                                                                                          | Who can access it                                                          | Related journeys       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------- |
| Discover — Opportunities       | Browse public collaboration posts                                                                                                                                | Everyone                                                                   | J-01, J-02, J-05       |
| Discover — Developers          | Browse public developer profiles                                                                                                                                 | Everyone                                                                   | J-03                   |
| Search                         | Search opportunities and developers with filters and result tabs                                                                                                 | Everyone; sign-in required for actions                                     | J-01, J-03             |
| Opportunity post               | Read and expand the post inline, open comments, save/share, and request collaboration                                                                            | Everyone; signed-in for interactions                                       | J-01, J-02, J-05       |
| Create / edit opportunity      | Publish or edit the owner's post                                                                                                                                 | Signed-in completed-profile member for creation; owner for editing         | J-02                   |
| Create Collabspace dialog      | Name and create a Collabspace linked to the current opportunity                                                                                                  | Opportunity owner                                                          | J-02, J-04             |
| Developer profile              | View public profile and send a chat request                                                                                                                      | Everyone; signed-in to send request                                        | J-01, J-03             |
| Own profile — Requests         | Track outgoing requests and invitations in one chronological list; withdraw pending items and review resolved history                                            | Profile owner only                                                         | J-01, J-02, J-03, J-04 |
| Own profile — My Opportunities | View and manage the owner's opportunity posts across all statuses                                                                                                | Everyone can view; owner can manage                                        | J-02, J-05             |
| Own profile — Saved            | Revisit and unsave saved opportunities, ordered by most recent save                                                                                              | Profile owner only                                                         | J-01, J-05             |
| Profile settings               | Change password for password-based accounts                                                                                                                      | Signed-in member; password change only for password-based accounts         | J-06                   |
| Request / invitation review    | Review the sender's profile and request context, then take the actions available for that request type                                                           | Signed-in recipient                                                        | J-01, J-02, J-03, J-04 |
| Chat                           | View private conversations, unread counts, and messages                                                                                                          | Signed-in member; conversation participants only                           | J-03                   |
| Collabspaces                   | View the member's Collabspaces and open a space or its linked opportunity                                                                                        | Signed-in member                                                           | J-01, J-02, J-04, J-05 |
| Collabspace                    | Use group chat, membership controls, and taskboard                                                                                                               | Current members; archived read-only access for members present at archival | J-02, J-04, J-05       |
| Notifications                  | Review incoming requests/invitations and private-message alerts in one chronological list; unread items are indicated and each item opens its relevant context   | Signed-in member                                                           | J-01, J-02, J-03, J-04 |
| Sign in / profile setup        | Register with required account fields, then invite the signed-in member to add optional city, experience, skills, and description; the invitation can be skipped | Signed-out visitor / new member                                            | J-01, J-02, J-03       |

## 5. Shared states and edge cases

- **Loading:** Keep the current destination identifiable while opportunities, profiles, Requests, Saved, Notifications, chats, messages, or taskboard data load. Prevent duplicate submissions while an action is processing.
- **Empty:** Explain how to find opportunities or developers, create an opportunity, send a first request, start a chat, or add the first milestone/task in the relevant destination. Empty states should offer the next relevant action.
- **Success / confirmation:** Confirm when a request or invitation is sent, accepted, declined, or withdrawn; when an opportunity is published or its status changes; and when a member joins or leaves a Collabspace.
- **Request status:** Outgoing items appear in one chronological Requests list. Pending items can be withdrawn; resolved items remain visible as history without extra actions. Accepted requests notify the sender and lead to the resulting chat or membership. Declined items show Declined in Requests without notifying the sender. A withdrawn request disappears from the recipient's incoming list without a notification.
- **Error:** Show a concise explanation and a retry or correction path. Preserve form content when a recoverable publish, comment, message, request, or task action fails.
- **Unauthorized / unavailable:** When signed out, allow public browsing and route the user to sign-in (email/username and password or Google) when they begin a protected action, then return them to the intended context. If content was deleted or access was removed, explain that it is unavailable and provide a safe return destination.
- **Destructive action:** Deleting a private chat requires a warning that it removes the conversation for both participants and ends that chat. Deleting an opportunity requires confirmation and explains that it is removed from discovery and its Collabspace is archived read-only for current members.
- **Interrupted:** If a request or message submission has an uncertain result after interruption, show the current server state before allowing a retry so users do not accidentally duplicate the action.

## 6. Flow rules

- Discover has Opportunities and Developers tabs. Search offers both result tabs and defaults to the Discover tab from which it was opened. Closing Search returns to that prior Discover tab.
- A public profile shows its profile card and My Opportunities across all statuses. The owner's profile has Requests, My Opportunities, and Saved tabs. Requests shows outgoing requests and invitations; Saved shows only that member's saved opportunities.
- Saved opportunities are private to their saver, appear in most-recently-saved order, and can be unsaved from the Saved tab.
- Incoming requests and invitations appear in Notifications. Opening one first shows the relevant context; users make the accept or decline decision there, not directly in the notification item. Private-message alerts open the relevant chat. Comments do not create notifications.
- Acceptance notifies the sender. Decline sends no notification; the sender sees the declined status in Requests. Withdrawal removes the incoming item silently.
- Any sender can withdraw an outgoing pending request or invitation from Requests. A new request after withdrawal creates a new Requests row. Declined chat requests may be sent again as new rows; declined collaboration requests and declined invitations cannot be repeated.
- Accepting a collaboration request into a private chat opens the chat immediately and does not add the applicant to the Collabspace. Accepting a collaboration request into the Collabspace adds the applicant immediately. A separate private-chat or Collabspace invitation requires recipient acceptance.
- The Chat destination contains private conversations only. Collabspace group chat is accessed from inside its Collabspace. Joining a Collabspace does not remove an existing private conversation.
- A member's unread count belongs to its individual chat list item. Muting a chat suppresses its message alerts while unread counts continue to change.
- A member can view public profiles and opportunities without signing in. Protected actions require authentication; collaboration requests also require a completed profile.
- The member edits profile details from their own Profile destination. Settings contains password change for password-based accounts; email changes are unavailable in the MVP.
- Opportunity statuses govern available actions: Open accepts new requests/invitations; Paused and Filled stop new ones but allow pending requests to be reviewed; Completed closes pending requests/invitations and is included in Discover only when selected by a filter; Archived is excluded from active Discover results but remains on the owner's profile and can be unarchived. My Opportunities shows the owner's posts across all statuses.
- Leaving or being removed from a Collabspace ends access immediately. The owner remains in their own Collabspace. An archived Collabspace is read-only for members who belonged to it at archive time.
- Deleting an opportunity archives its linked Collabspace if one exists and cancels pending requests and invitations. Existing private chats remain available unless a participant deletes the chat.
- The app interface is English; user-authored profile and opportunity content may be English or Amharic.
