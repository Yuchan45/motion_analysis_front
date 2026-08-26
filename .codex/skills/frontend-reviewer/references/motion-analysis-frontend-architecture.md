# Motion Analysis Frontend Architecture

Source: Notion page `Frontend Architecture` fetched on 2026-08-26.

## Required Decisions

- Use React + TypeScript as a SPA.
- Organize by feature first. Apply Atomic Design only to reusable shared visual UI.
- Use Material Design through Material UI (MUI).
- Centralize visual tokens and component customization in a MUI theme.
- Keep presentation components independent from HTTP and FastAPI details.
- Centralize backend communication in API/services, using native `fetch` when sufficient.
- Separate server state from UI state. Use local React state initially; add TanStack Query or a global store only when justified.
- Keep feature contracts and models outside presentation components.
- Build responsive and accessible UI from the start.

## Target Boundaries

```text
app -> pages -> features -> feature components -> shared UI -> MUI
                              |        |             |
                            hooks   API/services    types
```

Dependencies flow downward. Shared UI must not depend on a specific feature.

## Implementation Guidance

- Feature APIs own endpoint calls, FormData, request parsing, and normalized errors.
- Pages compose features and layouts rather than hold complex business logic.
- Model analysis workflow with explicit statuses such as `idle`, `uploading`, `processing`, `success`, and `error`.
- Use `useState` or `useReducer` for local workflow state. Avoid premature Redux, Zustand, Context, Axios, or TanStack Query.
- Prefer MUI components directly unless an abstraction adds domain behavior or shared semantics.
- Use PascalCase component files, `useSomething` hooks, camelCase utilities/services, and explicit suffixes such as `.api.ts` or `.types.ts`.

## Review Scope Rule

The current codebase may contain deviations from this target architecture. Report them as pre-existing debt unless the reviewed change introduces, expands, or relies on that deviation.
