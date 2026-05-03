# React Code Conventions

Use this file for React projects. Follow `code-conventions.md` and `code-conventions-typescript.md` when the project uses TypeScript.

## Components

- Use plain functions with explicit props interfaces. Avoid `React.FC`.
- Keep one primary component per file.
- Small helper subcomponents may live in the same file if they are private to the primary component.
- Prefer composition with `children` or named slots over large configuration objects.
- Do not pass props through many layers just to reach a distant child; introduce scoped context or reshape ownership.

```tsx
interface UserCardProps {
  user: UserProfile;
  onSelect: (userId: UserId) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return <button onClick={() => onSelect(user.id)}>{user.displayName}</button>;
}
```

## Component File Structure

1. Imports
2. Props and local types
3. File-local constants
4. Primary exported component
5. Private helper components/functions

## Props

- Callback props use `on` prefix: `onSave`, `onSelectionChange`, `onClose`.
- Local event handlers use `handle` prefix: `handleSave`, `handleSelectionChange`, `handleClose`.
- Boolean props read as predicates: `isOpen`, `hasError`, `canEdit`.
- Keep prop objects focused; split components when props become unrelated clusters.

## Hooks

- Extract a custom hook when stateful logic is reused or a component's state logic becomes hard to scan.
- Name hooks for what they manage, not where they are used.
- Use `useEffect` for side effects, not for pure data derivation.
- Return cleanup functions for subscriptions, timers, and external resources.
- Keep one concern per effect.

## State

- Keep state as local as possible.
- Use reducers for complex transitions or state that depends heavily on previous state.
- Store derived data as derived data unless measurement shows a real performance issue.
- Put URL-relevant UI state in the router/search params when applicable.
- Do not mirror props into state unless the component intentionally maintains a draft.

## Rendering

- Keep render paths deterministic.
- Avoid generating unstable keys; use stable domain IDs.
- Do not use array indexes as keys when order can change.
- Keep expensive rendering measurable before optimizing.
- Follow project-specific compiler/memoization rules in `stack.md`.

## Effects

- Effects should synchronize with external systems: network, subscriptions, timers, imperative APIs, browser APIs.
- Do not use effects to calculate values that can be computed during render.
- If an effect intentionally runs only once, document why.
- Include all dependencies unless the project has a documented exception pattern.

## Forms

- Keep validation close to the form model.
- Show field-level errors where possible.
- Preserve user input on submission errors.
- Prevent duplicate submissions during pending operations.
- Use the project's design-system form components when configured.

## Styling

- Use the project's design system and tokens.
- Keep static styles out of inline `style` props.
- Do not target undocumented internal class names from third-party component libraries.
- Verify responsive behavior for long text, narrow screens, and zoomed text.

