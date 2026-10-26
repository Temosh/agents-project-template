# TypeScript Code Conventions

Use this file for TypeScript projects. Follow `code-conventions.md` as the language-agnostic baseline.

## Type Imports

Use `import type` for type-only imports.

```ts
import type { UserProfile, UserId } from '../types';
import { normalizeUserName } from '../utils/normalizeUserName';
```

## Prefer `satisfies` For Config Objects

Use `satisfies` when you want type checking without widening inferred literals.

```ts
const routeConfig = {
  defaultPageSize: 25,
  mode: 'compact',
} satisfies RouteConfig;
```

## Type Vs Interface

- Use `interface` for object shapes that represent entities, DTOs, service contracts, or component props.
- Use `type` for unions, intersections, aliases, mapped types, and utility types.

```ts
interface UserProfile {
  id: UserId;
  displayName: string;
}

type UserId = string;
type LoadState = 'idle' | 'loading' | 'loaded' | 'failed';
```

## Avoid Type Assertions

Avoid `as SomeType` in normal code. Use validation, type guards, `satisfies`, or narrower APIs.

```ts
function isUserProfile(value: unknown): value is UserProfile {
  return typeof value === 'object' && value !== null && 'id' in value;
}
```

Assertions are acceptable at true boundaries when a third-party API is under-typed and the value has been validated or constrained nearby.

## Exhaustive Checks

Use `assertNever` for exhaustive handling of unions.

```ts
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
```

## Nullability

- Prefer `null` for intentionally absent domain values.
- Reserve `undefined` for omitted optional parameters and optional object properties.
- Avoid mixing `null` and `undefined` for the same concept.

## `any`

Do not use `any` in application code. Use `unknown` and narrow it. If `any` is unavoidable because of a third-party boundary, keep it local and document why.

## Objects And Literals

- Prefer readonly arrays and readonly properties for values that should not mutate.
- Use `as const` for fixed literal lists.
- Avoid numeric enums; prefer union types or `as const` objects.
- Prefer discriminated unions for state machines and variant data.

```ts
const STATUSES = ['draft', 'active', 'archived'] as const;
type Status = (typeof STATUSES)[number];
```

## Async Code

- Always handle rejected promises.
- Avoid floating promises; explicitly `await`, return, or mark them with a project-approved helper.
- Prefer `AbortSignal` support for cancellable async operations.
- Keep retry and timeout policy explicit at integration boundaries.

## Modules

- Use named exports by default.
- Use default exports only when required by the framework or established project convention.
- Avoid broad barrel files that hide ownership boundaries or create circular imports.
- Keep cross-boundary imports aligned with the relevant architecture rule, such as `architecture-react-app.md` for React apps.

## Tests

- Prefer strongly typed fixtures and builders.
- Do not bypass types in tests unless testing invalid external input.
- Test runtime validation for untrusted boundaries; TypeScript types do not validate runtime data.
