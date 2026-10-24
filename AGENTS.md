# AI Agent Instructions

## 1. Mission

Build **EthioDev** according to the approved requirements and existing codebase. Prioritize correctness, maintainability, security, and testability over the fastest-looking implementation.

## 2. Read the relevant context

Before making changes, inspect the repository and read the documents relevant to the task:

- `README.md` — project overview and milestone list
- `docs/PRD.md` — product goals, scope, requirements, and acceptance criteria
- `docs/APP_FLOW.md` — user journeys, navigation, and interaction states
- `docs/DESIGN.md` — visual and interaction conventions
- `docs/ARCHITECTURE.md` — system boundaries and technical decisions
- `docs/SCHEMA.md` — data structures, relationships, and invariants
- `docs/TASKS.md` — task order, dependencies, and completion status
- `docs/API.md` — API contracts and integrations, if this document exists

Read the documents that apply to the task; do not assume every document or capability exists in every project. Follow repository-specific instructions as well. Treat approved decisions and the existing codebase as context, and flag consequential conflicts instead of silently guessing.

## 3. Working rules

- Inspect existing code and configuration before proposing or implementing changes.
- Work on one well-defined task at a time. Avoid unrelated refactors.
- Follow the task order in `docs/TASKS.md`; complete each milestone as one coherent feature and make one Git commit for that milestone.
- Use `main` directly for M1, M9, and M10. For M2–M8, use one branch per milestone and merge its single milestone commit into `main`.
- Use Prettier for formatting and ESLint for JavaScript code checks. Follow the established JavaScript and React naming conventions in the codebase.
- Follow established patterns and architecture unless there is a clear reason to change them.
- Prefer simple, readable solutions over unnecessary abstractions or dependencies.
- Do not invent product behavior when requirements are unclear. Flag the ambiguity and ask for a decision when it materially affects scope, data, security, or user experience.
- Treat user input and external data as untrusted.
- Never expose secrets, credentials, private data, or sensitive values in code, logs, tests, or documentation.
- Do not overwrite user changes or perform destructive operations without permission.
- Do not claim a task, command, or test passed unless it was actually verified.

## 4. Implementation expectations

- Keep components, modules, and functions focused and maintainable.
- Validate data at appropriate trust boundaries.
- Enforce authentication and authorization on the server or another trusted backend, not only in the UI.
- Handle relevant loading, empty, success, validation, and error states.
- Use semantic, accessible elements and keyboard-friendly interactions.
- Add or update tests for changed behavior and important edge cases.
- Consider security, privacy, and failure handling appropriate to the feature and project.

## 5. Verification

Before marking a task complete:

1. Check its acceptance criteria in `docs/TASKS.md` and the relevant specifications.
2. Run applicable tests, linting, type checks, and build commands that are configured for the project.
3. Review the diff for regressions, accidental files, exposed secrets, and unrelated changes.
4. Report what changed, what was verified, and anything not verified.

If a check cannot be run, state why. Do not treat an unrun check as a pass. If the project does not use a particular check or tool, do not invent a requirement to add it without a reason.

## 6. Documentation and conflicts

- Keep documentation aligned with implemented behavior and approved decisions. Update the relevant file under `docs/` when requirements, flows, design, architecture, schema, or API contracts change; update `README.md` when setup or usage instructions change.
- Use stable IDs such as `F-01`, `J-01`, and `T-01` when linking requirements, journeys, and tasks where traceability is useful.
- If documents conflict, identify the conflict. Prefer an explicit approved decision over an outdated or inferred statement; seek clarification when the conflict is consequential.
- Treat explicitly approved decisions as settled. When docs/PRD.md is still in Draft or In review, work only within the scope the user has authorized, and flag unresolved decisions that materially affect implementation rather than treating assumptions as approved requirements.
- Keep `docs/TASKS.md` status current, but do not mark work complete until its acceptance criteria and applicable checks have been verified.

## 7. Project-specific constraints

Add only instructions that the agent must follow for this particular project and that are not already clear from the code, configuration, or documentation. Examples include restrictions on dependencies, files or modules that must not be changed, and required compatibility constraints.
