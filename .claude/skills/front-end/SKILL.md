---
name: front-end
description: Write front-end code in React
version: 1.0.0
---

# React Front-end skill

This document defines **non-negotiable rules** and a **folder structure** that keeps **data, logic, and presentation** separated, makes **pages layout-only**, and keeps **CSS colocated** with components.

## Skill Purpose

This skill assists with:

- Writing scalable front-end code in React
- Separation of concerns in front-end
- Files to create and their name patterns

---

## Goals

- Separation of concerns:
  - **Data**: API calls, DTOs, caching
  - **Logic**: business rules, domain model, transformations
  - **Presentation**: React components + CSS
- **Pages** are layout only (no fetching, no business logic).
- UI is built from **autonomous widgets** dropped into pages.
- CSS is **colocated** with the component it styles (using vanilla-extract).

---

## 1/ Hard Boundaries (Non-Negotiable)

### Rule 1 — Pages don’t fetch, don’t compute

- Pages may read route params and decide which widgets to render.
- Pages **must not**:
  - call `useQuery`, `useMutation`
  - call API clients directly
  - contain business logic (pricing, permissions, validation rules, etc.)
- Pages **may** pass:
  - IDs, filters, primitive config, feature flags, route params

### Rule 2 — Presentational components don’t know where data comes from

- “View” components are **pure**: props in → JSX out.
- View components **must not**:
  - import TanStack Query
  - import API clients
  - access storage (`localStorage`, cookies) or `window`
- View components **may**:
  - use UI-only hooks for rendering (e.g. `useMemo`), but avoid stateful orchestration.

---

## 2/ Folder Structure That Enforces Separation

Recommended layout (feature-oriented + widgets):

```
src/
├─ app/ # app shell, router config, providers
├─ modules/ # Features and widgets, separated by domain
│ ├─ [module_name]/ # domain name
│ │ ├─ widgets/ # autonomous UI blocks used by pages
│ │ ├─ features/ # user-facing capabilities (invite, checkout, search)
│ │ └─ entities/ # core domain objects (user, invoice, project)
├─ pages/ # route-level layout only
└─ shared/ # generic UI, hooks, utils, styles, api client



apps/web/
├── app/                        # Next.js App Router
│   └── api/                    # Next.js API routes (sign-in, sign-out, refresh, locale)
├── api/                        # API layer (client, query provider, SSE)
├── config/                     # App configuration (env variables)
├── modules/ # Features and widgets, separated by domain
│ ├─ [module_name]/ # domain name
│ │ ├─ components/ # autonomous UI blocks used by pages
│ │ ├─ api/ # api hooks
│ │ └─ hooks/ # business hooks
```

---

## 3/ Import & Dependency Rules

### Prohibited imports

- Any module must not import from `page` files
- `common` must not import from any specific module
- `page` files must not import from `api` or TanStack Query

---

## 4/ TanStack Query Rules

### Rule 1 — Server state lives in TanStack Query

- Do not duplicate server data into local/global state.
- Use query cache as the source of truth.

### Rule 2 — Local state is for ephemeral UI only

- modal open/close, local input drafts, tab selection, disclosure state

### Rule 3 — Global client state is rare and explicit

Examples:

- auth session (token/user)
- theme
- feature flags
  Keep it small and separated from server state.

### Rule 4 — Query keys are standardized

- Use a central key factory per entity/feature.
- Keys must be stable and serializable.

### Rule 5 — Mutations must invalidate/update queries intentionally

- Always decide which queries to invalidate or update.
- Never “invalidate everything”.

---

## 5/ CSS Rules

### Rules

- Use Tailwindcss for styling
- Mobile first
- No styling across component boundaries:
  - don’t target children from outside with `.parent :global(.child)`
- Global style is minimal:
  - Do not add style unless it's really relevant
- Use @aura/system package as design system

---

## 6/ Enforcement (Recommended)

### ESLint boundary rules (must-have)

Enforce:

- no deep imports
- no forbidden cross-layer imports
- no TanStack Query imports in `*.page.tsx`

### TypeScript path aliases

Use `@/` for `src/` to make imports consistent and readable.

---

## 7/ Quick Examples (Contract Summary)

### Page: layout only

- reads route params
- places components
- passes IDs/filters

### Components: autonomous

- uses TanStack Query
- orchestration + mapping
- renders view

---

## “Definition of Done” Checklist

- [ ] No `useQuery/useMutation` in `page`
- [ ] No API calls in `*.page.tsx`
- [ ] Folder has `index.ts` and consumers don’t deep-import
- [ ] Query keys follow the standard key factory
- [ ] Mutations invalidate/update the right queries (not all)
- [ ] Text is always translated in french and english

---
