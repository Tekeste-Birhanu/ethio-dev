# Design and UX Specification

## 1. Design direction

- **Product feel:** Professional, current, and socially engaging. Keep the interface polished and approachable, with the visual energy of a developer community rather than a corporate dashboard.
- **Primary audience:** Beginner and junior developers across Ethiopia, whether they are looking for teammates or offering their skills to a project.
- **Design priorities:** Make opportunities easy to discover, help users understand how to collaborate, keep actions and permissions clear, and make the experience work well on mobile.
- **Reference products / inspiration:** Learn from Instagram's image-led social feed and Telegram's clear navigation and conversational simplicity. Do not copy either product's branding or exact layouts.
- **Theme:** Light theme for the MVP.

## 2. Design principles

- **Lead with the work.** Opportunity cards use cover imagery first when available, followed by the project's purpose, needed skills, and a clear path to learn more.
- **Support both sides of collaboration.** Give project creators and prospective contributors equal clarity and visibility.
- **Make social actions familiar.** Likes, comments, replies, messages, and membership controls should be easy to find and understand.
- **Keep the interface calm and legible.** Use neutral surfaces, concise copy, and restrained color. Apply color consistently to actions, links, and feedback.
- **Adapt the same experience to each screen size.** Keep discovery and collaboration usable on narrow screens without hiding essential actions.
- **Use local context with care.** Show Ethiopian developers, cities, and projects through relevant content and imagery. Avoid decorative national motifs or flag-like styling.

## 3. Visual foundations

- **Typography:** Use a neutral, familiar sans-serif system stack (`Inter` when available, then system UI fallbacks). Use clear heading hierarchy, readable body text, and concise labels. Do not require a remote font service.
- **Color:** Use the following palette as design tokens:

  | Token / role            | Color     | Usage                                                                                                        |
  | ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
  | Warm canvas             | `#FAF8F5` | Main page background                                                                                         |
  | Surface                 | `#FFFFFF` | Cards, panels, dialogs, and navigation surfaces                                                              |
  | Primary text            | `#24201D` | Headings and main content                                                                                    |
  | Muted text              | `#746B65` | Supporting copy and metadata                                                                                 |
  | Primary action and link | `#176B9B` | Primary buttons with white labels, links, selected navigation, and focused controls                          |
  | Sky-blue accent         | `#229ED9` | Small brand marks and decorative highlights; do not use for small text or as a button fill with a dark label |
  | Terracotta accent       | `#A9472A` | Likes and occasional emphasis                                                                                |
  | Border                  | `#E8E1DB` | Card and control outlines                                                                                    |

  Use semantic success, warning, and error colors consistently, with text or icons in addition to color. Maintain WCAG AA contrast for text and controls. The primary blue with white text and terracotta on white both provide approximately 5.8:1 contrast. Sky blue is too light for small text on white.

- **Spacing:** Use a consistent 4 px base scale (4, 8, 12, 16, 24, 32 px). Give feed cards and forms enough space to remain easy to scan on mobile.
- **Shape and elevation:** Prefer softly rounded corners: about 10–12 px for controls and 16–18 px for cards. Use thin warm-neutral borders and subtle shadows only to separate layers.
- **Icons and imagery:** Use clean outline icons with accessible names for icon-only controls. Lead opportunity cards with a project cover image when available. Use local project imagery and content where possible. Fall back to a simple, calm illustration or neutral placeholder when no image is available. Use a generic person icon for profiles without a photo.
- **Responsive behavior:** On desktop, use a left navigation sidebar, a central feed, and an optional supporting rail. On mobile, replace the sidebar with a bottom tab bar and combine discovery and the developer directory under one Explore item. Provide Discover and Developers tabs at the top of both screens, collapse supporting rails, and keep feed cards full width. Preserve readable text, touch-friendly controls, and the same task hierarchy at every width.
- **Motion:** Use brief, subtle transitions for hover, focus, selection, and action feedback. Respect `prefers-reduced-motion` and do not use motion to communicate state by itself.

## 4. Components and patterns

| Component / pattern         | Purpose                                                           | Required behavior / variants                                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary button              | Main page action, such as posting an idea or submitting a request | Deep blue fill with white label; visible hover, focus, pressed, disabled, and loading states. Keep the label verb-led and specific.                                                                                            |
| Secondary button            | Supporting or lower-priority action                               | Neutral surface with clear border or text treatment. Destructive actions use an explicit destructive style and confirmation when required.                                                                                     |
| Form field                  | Account, profile, opportunity, and workspace data entry           | Persistent label, optional hint, field-level validation, visible required state, and preserved safe input after recoverable errors.                                                                                            |
| Search and filters          | Find opportunities, skills, cities, and developers                | Keep the search field visible and reveal staged filter controls while search is active; apply selections with an explicit action, provide a clear reset, and show a helpful empty state.                                       |
| Opportunity post            | Read and engage with a public project in the social feed          | Show creator, title, description, skills, city when present, plus visible like and comment icon counts. Expand long descriptions inline and open comments in a popup; closed status remains visible without hiding engagement. |
| Avatar and profile identity | Recognize contributors and creators                               | Use a profile photo when available; otherwise show a generic person icon. Provide a text name alongside the avatar.                                                                                                            |
| Skill and status chip       | Summarize skills and project state                                | Use concise text and sufficient contrast. Never use color as the only status indicator.                                                                                                                                        |
| Comments and likes          | Engage with opportunities                                         | Show nested replies with clear author and reply context. Label like controls with their current state for assistive technology.                                                                                                |
| Chat message and attachment | Private and workspace conversations                               | Distinguish sender and timestamp; show sending, sent, failed, and retry states. Make attachment type and download action clear.                                                                                                |
| Task and milestone row      | Review and update workspace progress                              | Make status, assignees, due date, milestone, and permitted actions scannable. Clearly indicate read-only project states.                                                                                                       |
| Dialog and feedback message | Confirm destructive actions and report results                    | Move focus into dialogs, support keyboard dismissal where safe, describe consequences, and return focus to the invoking control. Use concise success and error feedback.                                                       |
| Empty state                 | Explain an empty feed, inbox, search, or workspace section        | Use a simple icon and helpful text. Include a relevant next action when one exists.                                                                                                                                            |

## 5. Screen-specific guidance

### Public home and opportunity feed

- **Purpose:** Help visitors discover projects and understand how EthioDev collaboration works.
- **Layout:** Desktop uses sidebar navigation, a central image-led feed, and optional supporting content such as popular skills or developers to meet. Mobile uses a compact header, search, feed cards, and bottom tabs.
- **Primary action:** Engage with an opportunity in the feed; signed-in creators can expand the inline composer to post an idea.
- **Secondary actions:** Search, filter, like, comment, and open a creator profile.
- **Content and behavior:** Keep title, description, skills, location when provided, and like/comment icon counts with each post. Expand a long description in place and open the comment thread in a popup. A closed opportunity remains discoverable and interactive, while making its closed state clear.
- **Responsive changes:** Collapse supporting content below the feed and keep the opportunity card full width.
- **Related flow:** J-01, J-02, J-04 in `APP_FLOW.md`.

### Opportunity composer and management

- **Purpose:** Let users publish and manage opportunity posts from the feed.
- **Layout:** Expand the composer in the feed for creating a post. Keep edit controls on a dedicated management form; display the full description and engagement in the feed post.
- **Primary action:** Like or comment for signed-in users; request to join for eligible verified users; edit/manage for the creator.
- **Secondary actions:** View the creator profile and read or reply in the comment thread.
- **Content and behavior:** Explain verification requirements at the point a user tries to publish or request to join. Closing or deleting an opportunity must explain what happens to pending requests and existing collaborations before confirmation.
- **Responsive changes:** Stack details and actions vertically; avoid sticky controls covering comment or form content.
- **Related flow:** J-02 through J-05 in `APP_FLOW.md`.

### Developer directory and profile

- **Purpose:** Help developers find potential collaborators and understand their skills and interests.
- **Layout:** Searchable directory cards link to public profiles. Profiles prioritize display name, username, bio, skills, city, and the developer’s opportunity posts.
- **Primary action:** Open a profile or begin an allowed collaboration path.
- **Content and behavior:** Optional profile fields may be absent; render incomplete profiles cleanly without placeholder-heavy layouts.
- **Responsive changes:** Use a single-column result list on small screens.
- **Related flow:** J-01 and J-02 in `APP_FLOW.md`.

### Private chat and workspace

- **Purpose:** Support one-to-one coordination and team collaboration.
- **Layout:** Keep conversation or workspace identity visible, with a distinct message area and composer. Workspace sections provide clear access to chat, tasks, milestones, members, and project status.
- **Primary action:** Send a message in chat; create or update work items in a workspace.
- **Content and behavior:** Distinguish private chat from workspace chat. In workspace chat, show the sender’s display name above each message. Group messages by day with a centered date pill and show each message’s local time without seconds. Show attachment progress and failure recovery. Clearly communicate membership and read-only status. Confirm ending a private collaboration or removing a member when the action has consequential effects.
- **Responsive changes:** Use a single-pane navigation pattern on mobile and make the composer reachable above the mobile keyboard.
- **Related flow:** J-06 through J-08 in `APP_FLOW.md`.

### Showcase

- **Purpose:** Present a completed collaboration publicly.
- **Layout:** Use a clear project title, overview, links, project status, and contributor list. Use project imagery when available.
- **Primary action:** Open project links; authorized creators and admins can publish, edit, or unpublish.
- **Content and behavior:** Explain that contributor names are attributed automatically.
- **Responsive changes:** Stack project details and links in a single column on mobile.
- **Related flow:** J-06 in `APP_FLOW.md`.

## 6. Interaction and UI states

- **Controls:** Define default, hover, focus-visible, pressed, disabled, and loading states. Ensure focus is visible and is not represented by color alone.
- **Forms:** Show inline validation near the field, preserve safe values after recoverable failures, and provide clear success confirmation after saving.
- **Discovery:** Provide loading, populated, empty, and error states. Preserve search and filter values after an empty result or recoverable load failure.
- **Social actions:** Reflect saved like state and comment changes only after confirmation from the service. Prevent accidental duplicate submissions while a request is in flight.
- **Chat and uploads:** Distinguish pending, sent, failed, and retryable messages and files. Never present failed content as sent.
- **Collaboration and membership:** Clearly label pending, accepted, rejected, withdrawn, closed, and canceled states. Explain unavailable actions where the user's role or project state prevents them.
- **Destructive actions:** Confirm opportunity deletion, ending a private collaboration, and removing a member with concise consequences. Provide a safe cancel path.
- **Feedback:** Use in-context status text or a concise notice for success and failure. Explain the next available action when an operation fails.

## 7. Accessibility

- Use semantic landmarks, heading hierarchy, buttons for actions, and links for navigation.
- Associate form labels and hints with inputs. Identify required fields and errors in text.
- Support full keyboard operation and provide a visible focus indicator.
- Maintain at least WCAG AA contrast for normal text; do not use sky blue `#229ED9` for small text on white. Do not rely on color alone for status or selection.
- Give icon-only buttons accessible names. Provide appropriate alternative text for informative images and empty alternative text for decorative art.
- Make interactive targets comfortably touchable on mobile (aim for at least 44 by 44 CSS pixels).
- Respect reduced-motion preferences and avoid motion that flashes or blocks interaction.
- Announce chat, upload, and form results to assistive technology without moving focus unexpectedly.

## 8. Content guidelines

- **Tone:** Concise and neutral. Be respectful, clear, and helpful without sounding corporate or overly casual.
- **Labels and messages:** Use direct action labels such as “Request to join,” “Send message,” and “Create task.” Prefer familiar words and explain product-specific states in context.
- **Dates, numbers, and localization:** English is the MVP language. Use readable dates and make location names explicit. Avoid ambiguous numeric-only dates.
- **Errors:** Say what happened, preserve recoverable input, and tell the user how to retry or correct the issue.
- **Empty states:** Use a simple icon with helpful text and a clear next step when possible.
- **Local context:** Use authentic Ethiopian project examples, developer profiles, and city names where sample content is shown. Do not use stereotypes as visual shorthand.

## 9. Open design questions

- **Production imagery:** Which real project cover images can be used with appropriate permission? The preview illustration is placeholder artwork.
- **Brand mark:** The preview uses a temporary “E” mark; define the final EthioDev logo before implementation of the shared brand assets.
