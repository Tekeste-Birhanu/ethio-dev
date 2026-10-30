# Design and UX Specification

## 1. Design direction

- **Product feel:** Social, modern, welcoming, and focused on building together.
- **Primary audience:** Beginner and junior Ethiopian developers discovering project opportunities and collaborators.
- **Design priorities:** Make opportunity posts feel personal and easy to browse; keep collaboration actions clear; maintain readable contrast in a dark-first interface.
- **Reference / inspiration:** Use the supplied Nuzz screenshot as inspiration for its dark surfaces, persistent navigation, and green accent. Do not copy its product features or branding.

## 2. Design principles

- **Design a social feed, not an admin dashboard:** Give author identity and post text visual priority. Avoid metrics, analytics panels, status dashboards, and dense data grids.
- **Keep posts easy to scan:** Show optional opportunity details as compact inline chips, and omit fields that have no value.
- **Keep people in context:** Expand long post text inline. Use a comments dialog for discussion and return members to their feed position when they close it.
- **Make collaboration the clear next action:** Keep “Send collaboration request” easy to find on opportunity posts without letting it overwhelm the post itself.
- **Use supporting copy only when useful:** Do not add decorative subtitles or taglines. Add helper text only when it clarifies a control, choice, or next step.
- **Use product language consistently:** Use Discover, Opportunities, Developers, Collabspace, and Chat labels as defined in product documentation.

## 3. Visual foundations

- **Typography:** Manrope is the current Latin-script font candidate for a friendly, modern UI. Use Noto Sans Ethiopic as a fallback for Amharic and other Ethiopic-script user content. Confirm the pairing during visual prototyping.
- **Color:** Use a near-black page background, layered charcoal surfaces, readable light text, and vivid green as the main accent. Use semantic colors in addition to text or icons so state is not conveyed by color alone. Exact color values are not yet set.
- **Spacing:** Use consistent spacing and generous separation between feed posts. Avoid tightly packed controls and metadata rows.
- **Shape and elevation:** Use softly rounded post surfaces and subtle borders. Keep depth restrained; avoid dashboard-like panels and excessive shadows.
- **Icons and imagery:** Use simple, consistent icons for navigation and post actions. Use member avatars where available, with a neutral fallback when absent.
- **Responsive behavior:** Use a single main feed column with no right rail. On mobile, collapse desktop navigation into a compact navigation pattern, keep controls reachable, and let dialogs use the available screen comfortably.

## 4. Components and patterns

| Component / pattern        | Purpose                                                              | Relevant behavior / variants                                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary sidebar            | Navigate the product                                                 | Contains Discover, Collabspaces, Chat, Notifications, and Profile. No Search or Post opportunity destination.                                                                                                                  |
| Account menu               | Provide current-account actions                                      | Bottom-left avatar/name opens a small menu containing Log out. Profile navigation remains a separate sidebar destination.                                                                                                      |
| Profile settings           | Let members change their account password                            | Keep Settings under the member's own Profile destination. Show Change password only when the account has a password credential; do not offer email change in the MVP. Profile editing is a separate action on the own profile. |
| Discover tabs              | Switch the Discover content type                                     | Opportunities and Developers; selected tab is visually clear.                                                                                                                                                                  |
| Opportunity post card      | Browse collaboration opportunities in a social feed                  | Author identity, time, text, optional inline metadata, and post actions. Long text expands in place.                                                                                                                           |
| Developer profile card     | Browse public developer profiles                                     | Identity, city, experience, short description, skills, and a View profile action; show only available profile information.                                                                                                     |
| Opportunity metadata chips | Show optional opportunity attributes without a data-table appearance | Compact labels for category, skills sought, experience sought, collaboration city, and status; display only values supplied on the post.                                                                                               |
| Comments dialog            | Read and add flat comments without leaving the feed context          | Centered dialog on desktop and a full-screen sheet on mobile. Show a clear close control and preserve the prior feed position.                                                                                                 |
| Collaboration request form | Send a request with an optional message                              | Opens from the post's collaboration action. Shows the opportunity context, an optional message field, and Send request / Cancel actions.                                                                                       |

## 5. Screen-specific guidance

### App shell and navigation

- **Desktop:** Use a persistent left sidebar with the EthioDev mark and primary destinations in this order: Discover, Collabspaces, Chat, Notifications, Profile. Keep Chat easy to spot. Highlight the current destination with the green accent; use clear icons with text labels. Put Post opportunity in the Discover page header, not the sidebar.
- **Main content:** Give each page one focused content area with a comfortable reading width. Do not add a right rail, dashboard metrics, or promotional panels.
- **Account menu:** Anchor the signed-in member's avatar and name at the bottom of the sidebar. Clicking it opens a small menu with Log out. Keep Profile as its own navigation destination.
- **Mobile:** Replace the sidebar with a compact bottom navigation for Discover, Collabspaces, Chat, Notifications, and Profile. Keep Post opportunity available in the Discover page header without adding it as a sixth navigation destination. Search remains available from Discover and is not a global navigation item.
- **Related guidance:** Use the same shell across signed-in destinations; the selected destination and keyboard focus must remain visible and clear.

### Discover — Opportunities

- **Purpose:** Browse public collaboration opportunities and begin engaging with their owners.
- **Layout and hierarchy:** Use the persistent left sidebar and one centered feed column. The main content begins with a Discover heading, a search control, Opportunities and Developers tabs, and a compact Filters control. Opportunities is selected for this view. Do not show a right rail.
- **Primary action:** Place Post opportunity beside the Discover heading. Opportunity cards provide collaboration actions as those features are implemented.
- **Feed cards:** Use a social-post hierarchy: author avatar/name/username and timestamp, then title-free post text, optional metadata chips, and a simple action row. Keep the post text as the main content. Show Comment, Save, and Share, plus an inline Read more control for long posts. The full post remains in the feed; there is no separate opportunity details page or View details link.
- **Opportunity fields:** Use only the agreed categories: Web, Mobile, Desktop, Data/AI, Games, Developer Tools/Open Source, Hardware/IoT, and Other. Skills are flexible text. Experience uses Beginner, Junior, Intermediate, or Senior. An optional city may provide local collaboration context. Use the product status labels Open, Paused, and Completed when relevant. Omit missing optional fields.
- **Search and filters:** Search is opened from Discover and supports opportunities and developers. It starts on the Discover tab the member was viewing and closing it returns to that tab and feed context. Do not add Search to the sidebar. Opportunity filters may include city, skills, and experience.
- **Comments:** Comment opens a dialog with a clear Comments heading, the post's flat comment list, and a composer at the bottom. Show each comment's author, time, and text. A comment author can delete their own comment; the opportunity owner can delete any comment. On mobile, present the dialog as a full-screen sheet. If comments are disabled for a post, show that state and omit the composer. Closing the dialog returns to the same feed position.
- **Collaboration request:** Open a compact dialog from Send collaboration request. Show enough opportunity context to confirm what the member is requesting to join, an optional message field, and clear Send request and Cancel actions. Do not add unrelated profile fields or extra steps. Keep the owner's profile review and accept/decline actions in the owner's incoming request flow.
- **Sharing:** A shared post link opens the creator’s public profile and brings the specific opportunity post into view, expanded and highlighted. Identify the post by its stable post ID; a username may be included for readability.
- **Responsive changes:** Keep the feed single-column on narrow screens. Adapt the sidebar to mobile navigation and ensure post actions do not overflow horizontally.
- **Related flow:** J-01, J-02, and J-05 in `APP_FLOW.md`.

### Discover — Developers

- **Purpose:** Browse public developer profiles and find people to contact or invite to collaborate.
- **Layout and hierarchy:** Reuse the Discover shell and sidebar from the Opportunities view. Keep one centered column with the Discover heading, search control, Opportunities and Developers tabs, and a compact Filters control. Developers is selected. Do not show a right rail or a decorative subtitle.
- **Profile cards:** Use approachable social profile cards in a single-column list. Show avatar, name, username, city, experience level, a short preview of the flexible profile description, and a few skill chips. Omit fields that are not provided. Do not show email.
- **Primary action:** Use View profile to open the public profile. Keep chat requests on the profile page so the requester can review the developer first.
- **Search and filters:** Search developers by name, username, skills, or city. Filters may include city, skills, and experience.
- **Visual details:** Keep identity and description prominent, with metadata secondary. Use normal capitalization for experience labels: Beginner, Junior, Intermediate, and Senior.
- **Responsive changes:** Preserve the single-column card list on narrow screens and keep the View profile action easy to reach.
- **Related flow:** J-03 in `APP_FLOW.md`.

### Search

- **Purpose:** Search opportunities and developers from Discover.
- **Entry and return:** Open as a full-page view within the app shell from Discover; do not add a Search sidebar destination. Provide a clear close/back control. Return to the Discover tab and feed position from which Search was opened.
- **Layout:** Keep the search field prominent with result tabs for Opportunities and Developers. Start on the same result type as the member's current Discover tab. Keep relevant filters available without crowding the results.
- **Results:** Reuse the existing opportunity and developer card patterns. Opportunity posts stay in the results and expand inline; opening a developer profile returns the member to their search results and query.
- **Empty state:** Show a concise no-results message and let the member adjust the query or filters.
- **Content:** Avoid a decorative subtitle or separate dashboard-style search panels.
- **Related flows:** J-01 and J-03 in `APP_FLOW.md`.

### Sign in and registration

- **Purpose:** Let developers sign in or create an EthioDev account with minimal friction.
- **Layout:** Use one centered, width-constrained auth form in the established dark visual style. Place the EthioDev mark above it, with a simple switch between Sign in and Create account. Show Google sign-in first, then a quiet divider and the mode-specific fields. On mobile, let the form use the available width with comfortable side padding. Do not use a split-screen marketing panel or decorative subtitles.
- **Sign in:** Accept email or username in one identifier field, plus password. Offer Google sign-in as an alternate method.
- **Registration:** Collect Full name, Username, Email, and Password in that order. Username is required and unique. Keep email private and identify it as account/authentication information, not public profile content.
- **Google account setup:** After first-time Google sign-in, show the name provided by Google and ask the member to choose a unique username. Provide a clear Continue action; do not ask for email or password again.
- **Feedback:** Show field-level validation and concise authentication errors. Preserve entered non-sensitive fields when correcting a recoverable error; never repopulate a password field after failure.
- **Related flow:** Sign in / profile setup in `APP_FLOW.md`.

### Public developer profile

- **Purpose:** Let visitors understand a developer and decide whether to start a private chat request.
- **Layout and hierarchy:** Take inspiration from the reference's spacious, identity-first profile header. Use one focused content column with the avatar beside the developer's name and username, then city and experience as quieter metadata. Place the chat action near the identity; continue into the description, skills, and My Opportunities list below. Keep the page dark, social, and uncluttered.
- **Profile content:** Show avatar, name, username, city, experience, skills, and flexible description when provided. Never show email.
- **Primary action:** Place Send chat request near the profile identity. It is available to signed-in visitors; opening it sends a request without a note. The recipient must accept before a private chat opens.
- **Content below the profile:** Show the developer's My Opportunities list. Each opportunity uses the same post presentation and interactions as in Discover.
- **Privacy and ownership:** Visitors see public profile information and My Opportunities only. Requests, Saved, Edit profile, and Settings appear only to the profile owner; Settings is for changing a password when the account has one.
- **Content:** Do not add follower/following counts, activity or stats tabs, achievement metrics, charts, or decorative subtitles. Avoid follow controls, a public activity feed, and unrelated profile actions.
- **Related flow:** J-03 in `APP_FLOW.md`.

### Own developer profile

- **Purpose:** Let a member manage their public profile and review outgoing requests, opportunities, and saved posts.
- **Layout:** Reuse the public developer profile's identity-first header and profile information. Show three tabs below the profile card: Requests, My Opportunities, and Saved.
- **Requests:** Show one chronological list of the member's outgoing requests and invitations. Each row identifies the recipient, related opportunity or Collabspace, and current status. Pending items can be withdrawn; resolved items remain visible as history without extra actions.
- **My Opportunities:** Show the owner's opportunity posts using the same cards as Discover, with a three-dot owner actions menu for Edit and the relevant lifecycle action: Pause while Open, Resume while Paused, or Mark as completed while Open or Paused. Completed is terminal. Keep Delete out of this menu; deletion remains a separate confirmed owner action.
- **Saved:** Show only the member's saved opportunities in most-recently-saved order, using the same post cards as Discover with an action to unsave each item. This tab is private and never appears to visitors.
- **Owner actions:** Provide Edit profile and Settings actions visible only to the owner. Edit profile covers name, username, city, experience, skills, and description. Settings includes password change when the account has an EthioDev password; email changes are not available in the MVP.
- **Privacy:** Do not expose Requests, Saved, or owner controls to visitors. Visitors see the public profile and My Opportunities as described above.
- **Content:** Keep the page focused on the member and their work; avoid adding a separate public activity feed or decorative subtitles.
- **Related flows:** J-01, J-02, J-03, J-04, and J-06 in `APP_FLOW.md`.

### Own profile settings

- **Purpose:** Let a member change password-based account credentials.
- **Entry:** Open Settings from the member's own Profile destination. Keep settings private and separate from the public profile visitors see.
- **Password:** Show password change only when the account has an EthioDev password credential. Require the current password and confirmation of the new password.
- **Content:** Keep the screen focused on password change. Profile editing is a separate action on the own profile; email changes are outside MVP scope.
- **Related flow:** J-06 in `APP_FLOW.md`.

### Create opportunity

- **Purpose:** Let a member publish a collaboration opportunity in a simple, post-first composer.
- **Post:** Use one simple, title-free post composer with a prominent description text area. Do not turn it into a long labeled form.
- **Skills:** Show Skills directly below the text area as removable tags. Explain that tags help developers find the opportunity.
- **Metadata:** Show categories, experience sought, and optional collaboration city as compact controls below the skill tags. These are optional; do not hide them behind a disclosure. Allow publishing with only a description.
- **Publish:** Use a clear Publish opportunity action. Publishing creates only the opportunity; do not add attachments or a separate preview step.
- **After publishing:** Return the owner to Discover with the new post visible. On the owner's post, show Create Collabspace until one is created; then show Open Collabspace. Creating the space requires a name and links it explicitly to that opportunity.
- **Adding members:** In request review, Add to Collabspace adds the accepted applicant directly when the linked space exists. If it does not, guide the owner to name and create the linked space, then add the applicant. Canceling leaves the request pending. Do not show a space picker in an opportunity request flow.
- **Validation and recovery:** Explain missing required text near the text area and retain entered content when the owner needs to correct the form.
- **Content:** Keep the composer focused. Avoid decorative subtitles and unrelated settings.
- **Related flow:** J-02 in `APP_FLOW.md`.

### Create Collabspace dialog

- **Purpose:** Let an opportunity owner create the linked team space when ready to organize collaboration.
- **Entry:** Open from Create Collabspace on the owner's opportunity post. Keep the dialog tied to that opportunity; do not provide a Collabspace picker.
- **Form:** Ask for the Collabspace name and provide clear Create and Cancel actions. Keep the form focused and omit unrelated settings.
- **Outcome:** Create links the new space to the current opportunity and returns to its post, where the owner can open the Collabspace. Cancel closes the dialog without creating a space. When this flow was launched while handling a pending collaboration request, canceling also leaves that request pending.
- **Related flow:** J-02 and J-04 in `APP_FLOW.md`.

### Collabspace

- **Purpose:** Give an opportunity's team one place for group chat and shared task planning.
- **Entry and identity:** Open from the linked opportunity or the Collabspaces list. Show the Collabspace name and a clear link to its opportunity. A Collabspace exists only after its owner creates it from the opportunity.
- **Layout:** Reuse the app shell. Put the Collabspace header above two views, Chat and Taskboard. Open Chat by default. Keep the page focused without a dashboard rail.
- **Group chat:** Show the chronological conversation with member avatar, name, timestamp, and message. Do not add role/skill tags to chat names. Provide a text composer that supports messages and links; do not show attachment controls. Follow the agreed message edit/delete permissions.
- **Taskboard:** Use Trello as inspiration for a clear board of status columns and movable task cards. Show milestones as a list with a compact completed/total task count. Opening a milestone shows three desktop columns: To do, In progress, and Done. Task cards show a concise title, one assignee, and an optional due date; an expand control reveals task details. Owners and admins can add a task from a column; it inherits the selected milestone and status. Let authorized users drag tasks between columns to update status: owners/admins can manage tasks, and an assignee can update the status of their own task. On mobile, use status tabs and show one column at a time; provide a keyboard-accessible status control as an alternative to dragging. Persist changes before showing them as saved and broadcast them live to current members. Do not allow multiple assignees per task.
- **Add/edit task dialog:** Use one focused dialog for creating and editing tasks. Include a required task title, optional details, one assignee selected from current members, and an optional due date. When creating from a board column, inherit the selected milestone and status; do not ask the user to select them again. When editing, owners and admins can move the task to another milestone. Owners and admins can create and edit task details, including assigning a member or themselves. Save and Cancel actions remain clear. On mobile, present the form as a full-height sheet. Assignees can update their own task status from the board without opening this form.
- **Milestone controls:** Owners and admins can add milestones. A milestone's three-dot menu offers Edit name and Delete. If it contains tasks, selecting Delete explains that tasks must be moved first and offers a way to review them. Once empty, deleting requires confirmation; deletion never removes tasks. Do not provide a bulk-delete path for milestone tasks.
- **Members:** Show a compact row of member avatars side by side in the Collabspace header, with a **View all** control that opens the full Members panel. The panel lists members by avatar and name with Owner or Admin labels where relevant. Each member row has a context menu: the owner can make a member an admin or remove an admin role; owners and admins can remove regular members; members can leave for themselves. Admins cannot change admin roles or edit the opportunity. On mobile, show the full list in a full-height sheet. Confirm removal and explain that access ends immediately, open tasks become unassigned, and remaining members keep chat and task history. Do not label individual chat messages with a member's project role.
- **Removal confirmation:** Confirm removal and explain that the member immediately loses access and their open tasks become unassigned; the remaining team keeps chat and task history. Do not offer the owner an action to leave their own Collabspace.
- **Privacy:** The Collabspace is available only to current members. Do not mark it as a public space; its linked opportunity remains publicly viewable.
- **Related flow:** J-04 in `APP_FLOW.md`.

### Collabspaces list

- **Purpose:** Let a member find and open Collabspaces they belong to.
- **Layout:** Reuse the app shell and show a straightforward list of the member's spaces. Keep the page focused; avoid a dashboard rail or extra metrics.
- **Space items:** Show the Collabspace name and its linked opportunity. Open the item to enter the Collabspace; make the linked opportunity available from the item. Show a small Archived tag on archived spaces, which remain in the list as read-only.
- **Access:** List only spaces the member currently belongs to, plus archived spaces they were a member of when archived.
- **Related flow:** J-04 in `APP_FLOW.md`.

### Notifications

- **Purpose:** Give members one place to see incoming requests, invitations, and relevant activity alerts.
- **Layout:** Reuse the app shell and show one straightforward chronological list. Clearly mark unread items. Do not add separate tabs, filters, or dashboard counts.
- **Incoming requests and invitations:** Show who sent it and the relevant opportunity or Collabspace context. Opening the item takes the recipient to a review view with the sender's profile and context; accept or decline there rather than directly in the list.
- **Message alerts:** A new private message creates an alert that opens the relevant private chat. Collabspace group messages remain inside their Collabspace rather than appearing in the Chat destination. Comments do not create notifications.
- **Content:** Keep rows concise and scannable, with clear sender identity and destination. Avoid decorative subtitles and unrelated actions.
- **Related flows:** J-01, J-02, J-03, and J-04 in `APP_FLOW.md`.

### Request review

- **Purpose:** Let a recipient review the sender and relevant context before accepting or declining an incoming request or invitation.
- **Entry:** For M5 profile chat requests, open the pending item in Chat. Later request types open from Notifications. Do not put accept/decline controls directly on a notification row.
- **Context:** Show the sender's profile with a way to view the full profile, plus the relevant context: opportunity and optional message for a collaboration request, profile for a chat request, or Collabspace and linked opportunity for a Collabspace invitation. Reuse the same layout while varying context and actions by request type.
- **Collaboration request actions:** Offer Accept into private chat, Add to Collabspace, and Decline. Adding to the linked Collabspace immediately grants membership. If no Collabspace exists, guide the opportunity owner to name and create it, then add the requester; canceling leaves the request pending.
- **Chat request actions:** Offer Accept and Decline. Acceptance opens the private conversation.
- **Invitation actions:** Offer Accept and Decline. Acceptance opens the private chat or adds the recipient to the invited Collabspace, depending on the invitation.
- **Feedback:** Confirm successful actions clearly. Declining sends no notification to the sender; the sender sees the declined status in Requests.
- **Content:** Keep the request and its context central, with only the actions relevant to that request type. Avoid unrelated links and dashboard elements.
- **Related flows:** J-01, J-02, J-03, and J-04 in `APP_FLOW.md`.

### Chat

- **Purpose:** Let members continue accepted one-to-one private conversations.
- **Layout:** Use Telegram's familiar two-pane conversation layout within the EthioDev app shell. On desktop, enclose the conversation list and selected private chat in one shared outer border with a divider between the panes. At narrower widths, show one pane at a time inside that same shared frame. Give each selected conversation a direct `/chat?conversation=:id` link. Clicking Chat navigation returns to `/chat`. Let the chat area fill the available page height; do not cap it or leave unused space above mobile navigation.
- **Conversation list:** Include active private chats only. Show the other member's name beside the latest message time and that chat's unread count; do not show a message text preview. Order by recent activity. Collabspace group chats are accessed inside their Collabspace and do not appear here.
- **Conversation view:** Show the other member's identity and chronological persisted messages, with a way to load older history. Opening a chat marks the messages shown as read. The text composer supports messages and links without attachment controls. Each sender can edit or delete their own messages; edits are marked, and deletion removes the message for both participants while refreshing the chat preview and unread count.
- **Conversation settings:** Put per-chat mute and Delete chat in the conversation header menu. Deleting requires a warning that the conversation is removed for both participants and ends the chat; do not offer a delete-for-me option.
- **Requests:** During M5, incoming chat requests appear as selectable rows in Chat. Selecting a request shows its sender and Accept / Decline actions in the conversation pane; accepting replaces the request view with the new conversation. The shared Notifications screen is planned outside M5 as T-58.
- **Related flows:** J-01, J-02, and J-03 in `APP_FLOW.md`.

## 6. Interaction and UI states

- **Navigation and controls:** Provide visible hover, keyboard-focus, pressed, and disabled states. Clearly distinguish the selected Discover tab.
- **Feed loading and empty states:** Preserve the Discover context while posts load. If no opportunities match, show a concise empty state with a way to adjust search or filters; do not fill it with metrics or recommendations.
- **Post text:** Long text expands inline and can be collapsed again. Keep the user’s position in the feed.
- **Comments dialog:** Opening and closing comments must preserve feed position. The dialog should distinguish loading, no comments, comments disabled, and comment submission states.
- **Request form:** Clearly show when submission is in progress and give success or recoverable error feedback without losing the optional message.
- **Comment deletion:** Provide clear feedback when a comment is deleted. Deleting a comment removes only that comment.

## 7. Accessibility

- Use semantic structure and meaningful labels for navigation, post actions, tabs, and dialogs.
- Ensure keyboard access and visible focus; dialogs must support keyboard navigation and a clear close action.
- Maintain readable contrast on dark surfaces and do not convey status or selection by color alone.
- Give icon-only controls accessible names and provide alternative text for meaningful avatars or images.
- Respect reduced-motion preferences for expansion and dialog transitions.
- Ensure mobile controls have practical touch targets and do not require horizontal scrolling to use post actions.

## 8. Content guidelines

- **Tone and terminology:** Friendly, clear, and developer-focused. Use Collabspace for the team space and Opportunity for a collaboration post.
- **Labels and messages:** Prefer plain social language. Avoid decorative subtitles, technical status jargon, promotional badges, invented metrics, and role labels that are not part of the opportunity fields. Use helper text only when it clarifies a control or action.
- **Dates, numbers, and localization:** The interface is English. User-authored profile and post text may be in English or Amharic. Format post timestamps compactly and consistently.
- **Errors:** Explain what happened in concise language and offer a clear next step when one exists.
