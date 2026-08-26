---
name: frontend-reviewer
description: Review Motion Analysis React and TypeScript changes against the project's Frontend Architecture. Use when reviewing frontend diffs, PRs, components, hooks, API calls, state handling, UI styling, accessibility, or proposed client-side structure.
---

# Frontend Reviewer

Review against [the local architecture reference](references/motion-analysis-frontend-architecture.md). Review only; do not edit files unless the user explicitly requests fixes.

## Workflow

1. Read the relevant diff and enough surrounding code to identify the feature boundary and existing conventions.
2. Check the change against the criteria below. Treat code introduced or modified by the change as the primary review scope.
3. Report pre-existing architectural debt separately; do not attribute it to the reviewed change unless it expands or depends on it.
4. Run the relevant validation command when available. Report tests not run or unavailable.

## Review Criteria

### Boundaries and Structure

- Organize new business code by feature, not by a global technical bucket.
- Keep pages focused on composing features and layouts; do not place feature orchestration in pages when a feature boundary exists.
- Keep visual shared UI independent of feature-specific business logic.
- Avoid files that combine upload, request orchestration, player behavior, editing, export, and error handling when a coherent feature split is practical.
- Do not create empty folders, generic `utils.ts`, wrappers around MUI with no added value, or abstractions used only once without a clear reason.

### API, Types, and State

- Keep HTTP, FormData construction, endpoint paths, and response parsing in a feature API/service layer. Presentation components must not call `fetch` directly.
- Keep feature models and API contracts outside presentation components. Move a type to `shared` only when multiple features use it.
- Model mutually exclusive workflow states as an explicit union/state machine, not independent booleans that permit invalid combinations.
- Keep UI-local state in React. Do not introduce Redux, Zustand, or TanStack Query unless the change demonstrates a real shared-state, caching, or server-state need.
- Require user-facing, understandable handling for invalid files, network failures, unavailable backend, processing failures, and invalid results. Do not expose raw backend internals.

### UI and Accessibility

- Require Material UI and the central MUI theme for new visual UI. Flag repeated hardcoded visual values or new parallel styling systems.
- Preserve responsive behavior and use theme tokens, MUI breakpoints, and accessible components where applicable.
- Check labels, keyboard interactions, visible focus, semantic buttons, contrast, and status/error messaging. Do not communicate state by color alone.

## Reporting Format

List findings first, ordered by severity. For each finding include severity, file and line, the architectural rule affected, impact, and a concrete correction.

Use these severities:

- `blocking`: breaks an explicit architecture decision, accessibility, or user flow.
- `major`: creates likely maintenance, state, API, or UI consistency problems.
- `minor`: lower-risk deviation or follow-up improvement.

If there are no findings, say so explicitly. Then list residual risks, pre-existing debt, and validation status in separate short sections.
