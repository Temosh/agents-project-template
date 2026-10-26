# React frontend architecture rules

## Top-level structure

`src/` has exactly four directories: `app/`, `pages/`, `domains/`, `shared/`.

Do **not** create `src/components/`, `src/utils/`, `src/hooks/`, or `src/types/` at the root level.

## Dependency rule — never violate

```
pages   →  domains, shared
domains →  shared only
shared  →  (nothing project-internal)
app     →  pages, domains, shared
```

A domain never imports from another domain or from `pages/`. Cross-domain data flows upward through page composition or `app/`-level state.

## Where new code goes

| What you're creating | Where it goes |
|----------------------|--------------|
| React component for a domain | `domains/<domain>/components/` |
| React component used by 2+ domains with no domain knowledge | `shared/ui/` |
| Domain hook (data fetching, mutations, derived state) | `domains/<domain>/hooks/` |
| Generic hook (no domain knowledge) | `shared/hooks/` |
| Pure business function (calculation, mapper, row builder) | `domains/<domain>/utils/` |
| Generic utility (formatDate, assertNever) | `shared/utils/` |
| Domain TypeScript types | `domains/<domain>/types/` |
| Shared primitive types (ID aliases, common value types) | `shared/types/` |
| Route entry point | `pages/<route-name>/` |
| API calls for a domain | `domains/<domain>/api/` |
| Domain state (Zustand slice or context) | `domains/<domain>/store/` |

## Pages

Pages are thin composers — they import domain components and wire them together. No business logic, no direct API calls, no local state beyond simple UI state (open/closed drawer, selected tab, view-mode toggle, etc.). If a page grows beyond ~120 lines, consider extracting orchestration to a domain hook.

Page-level state that is **allowed**: `viewMode`, `selectedTab`, `isDrawerOpen`, `selectedRowId` — these are UI state with no persistence requirement. State that involves business logic or needs to survive navigation belongs in a domain hook (`useEntityEditor`, `useFeatureData`) or Zustand store.

## `shared/`

Zero domain knowledge. If a file in `shared/` references a concrete business feature, workflow, entity, or product-specific concept — it belongs in a domain instead.

Only create a `shared/ui/` component when the same UI pattern is genuinely needed by 2+ domains. Do not preemptively abstract.

## Component subfolders

Complex components get their own folder with co-located files:

```
domains/orders/components/
  OrderTable/
    OrderTable.tsx           ← table wrapper
    columnDefs.ts
    StatusCellRenderer.tsx
    QuantityCellEditor.tsx
    index.ts                 ← exports OrderTable only
  OrderDetailView/
    OrderDetailView.tsx      ← detail composition for one order
    OrderActionBar.tsx       ← toolbar row for order-specific actions
    OrderDetailView.css
    index.ts                 ← exports OrderDetailView + OrderActionBar (both are public API)
  OrderListView/
    OrderListView.tsx
    OrderListView.css
  OrdersToolbar/
    OrdersToolbar.tsx
    OrdersToolbar.css
```

A subfolder's `index.ts` may export **multiple** components when they form a cohesive public API (e.g. `OrderDetailView` + `OrderActionBar` always appear together). This is not the same as a barrel re-export of internals — only the intended consumers of the folder are exposed.

Simple components are a single file. Don't create a folder for a one-file component.

## Exports

Named exports everywhere. Default exports only for page components (required for `React.lazy`). Do not create barrel `index.ts` files that re-export an entire domain's internals — only expose the public API.

## Naming

| What | Convention |
|------|-----------|
| React components | `PascalCase.tsx` |
| Hooks | `camelCase.ts`, must start with `use` |
| Utilities, API, store files | `camelCase.ts` |
| Route and feature folders | `kebab-case` |
| Component subfolders | `PascalCase` |

