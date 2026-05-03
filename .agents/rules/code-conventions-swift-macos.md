# Swift macOS Desktop Code Conventions

Use this file for Swift desktop macOS applications. Follow `code-conventions.md` as the language-agnostic baseline.

## Baseline

- Target the newest macOS version the product can reasonably support.
- Prefer SwiftUI for new UI unless the project has an established AppKit architecture or needs AppKit-only behavior.
- Use AppKit intentionally for menu bar apps, advanced window management, custom controls, responder-chain behavior, document apps, and mature desktop interactions.
- Keep Xcode build settings, signing, capabilities, entitlements, and sandbox decisions explicit in the project.
- Use Swift Package Manager for dependencies unless the project has a documented reason to use another dependency manager.

## App Architecture

- Keep app lifecycle code small: app entry, scene/window setup, dependency construction, command/menu registration.
- Separate UI, domain logic, persistence, integrations, and platform services.
- Keep business logic out of SwiftUI views, `NSViewController`, `NSWindowController`, app delegates, and menu command handlers.
- Prefer feature modules or folders with clear ownership when the app grows.
- Keep platform adapters thin: file system, Keychain, notifications, pasteboard, menu bar, accessibility, and network clients should wrap system APIs behind focused interfaces.

Recommended shape for non-trivial apps:

```text
App/
  AppEntry.swift
  AppCommands.swift
  WindowManagement/
Features/
  <FeatureName>/
    Views/
    ViewModels/
    Models/
    Services/
Shared/
  UI/
  Utilities/
  Platform/
  Persistence/
Tests/
```

## SwiftUI

- Keep `View` types declarative and small.
- Extract subviews when the body becomes hard to scan, not preemptively for every small block.
- Use `@State` for view-local state.
- Use `@Binding` for parent-owned state edited by a child.
- Use `@StateObject` or `@Observable` ownership at the feature boundary; do not recreate long-lived models during view recomputation.
- Use `@Environment` for cross-cutting UI dependencies such as scene phase, dismiss actions, color scheme, and injected app services.
- Avoid doing network, file, or persistence work directly in `body`.
- Use `.task` for view-scoped async loading when cancellation should follow view lifecycle.

## AppKit

- Keep `NSViewController` and `NSWindowController` thin.
- Use the responder chain, menu validation, and first responder behavior deliberately for desktop-native workflows.
- Keep custom `NSView` drawing isolated and tested where practical.
- Avoid mixing SwiftUI and AppKit casually; wrap AppKit with `NSViewRepresentable` or `NSViewControllerRepresentable` behind a focused component.
- Keep window restoration identifiers, autosave names, and tabbing behavior explicit.
- Do not block the main thread with file, network, indexing, or export work.

## State And Data Flow

- Prefer one owner for each piece of mutable state.
- Keep draft/editing state separate from persisted domain state.
- Model app state with explicit enums for loading, empty, loaded, failed, permission-denied, and offline states.
- Avoid global singletons for mutable application state.
- Use dependency injection for services that need mocking in tests.
- Keep derived values computed unless caching is measured and justified.

## Concurrency

- Use Swift structured concurrency for new async work.
- Keep UI updates on `@MainActor`.
- Mark view models or UI-facing models `@MainActor` when they publish UI state.
- Avoid detached tasks unless there is a clear ownership and cancellation plan.
- Propagate cancellation; do not treat every cancellation as an error.
- Use `TaskGroup` or `async let` for bounded parallel work.
- Avoid callback-based APIs in new code when an async wrapper is practical.
- Never block the main actor with synchronous file, network, database, or process calls.

## Errors

- Use typed domain errors where callers need to distinguish expected failures.
- Preserve underlying errors when wrapping system or integration failures.
- Convert technical errors into user-facing messages at UI boundaries.
- Do not show raw `localizedDescription` for errors that need product-specific recovery guidance.
- Include recovery actions when possible: retry, choose file, grant permission, open settings, reveal in Finder.

## Files, Security, And Sandbox

- Treat file URLs as security-sensitive.
- Use security-scoped bookmarks when sandboxed apps need persistent access to user-selected files or folders.
- Start and stop security-scoped resource access in tightly scoped code.
- Store secrets in Keychain, not `UserDefaults`, plist files, logs, or source-controlled fixtures.
- Keep entitlements minimal and documented.
- Validate file types and paths before reading or writing.
- Use atomic writes for user documents and important app data.

## Persistence

- Use `UserDefaults` only for small preferences.
- Use files, SQLite, SwiftData, Core Data, or another documented store for durable application data.
- Keep persistence models separate from UI view state.
- Make migrations explicit and test them with representative data.
- Avoid performing migrations on the main thread if they can take noticeable time.
- Store timestamps with clear time-zone semantics.

## Menus, Commands, And Shortcuts

- Use native menu commands for desktop workflows users expect: new, open, save, close, undo, redo, copy, paste, find, preferences, help.
- Keep command handlers thin; delegate real work to feature/application services.
- Validate menu items based on current selection, document state, and permissions.
- Use standard keyboard shortcuts where possible.
- Avoid hijacking system-reserved shortcuts.

## Windows And Scenes

- Define whether the app is single-window, multi-window, document-based, menu bar only, or hybrid.
- Keep window identity and restoration behavior explicit.
- Preserve unsaved work when windows close.
- Confirm destructive close/quit operations when data may be lost.
- Make toolbar, sidebar, inspector, and settings windows feel native to macOS.

## Accessibility

- Provide labels, values, hints, and roles for custom controls.
- Preserve keyboard navigation and focus order.
- Support VoiceOver for primary workflows.
- Respect Reduce Motion, Increase Contrast, and Dynamic Type where applicable.
- Do not communicate state using color alone.
- Test custom AppKit and SwiftUI controls with keyboard and VoiceOver when they affect core workflows.

## UI Quality

- Prefer native macOS controls, spacing, typography, toolbars, sidebars, sheets, popovers, and settings patterns.
- Use sheets for document/window-scoped decisions and separate windows for independent workflows.
- Avoid iOS-style navigation patterns unless the app intentionally shares a cross-platform UI.
- Keep destructive actions visually and behaviorally distinct.
- Keep long-running work cancellable or visibly progressing.
- Do not use custom chrome unless the product has a strong reason and preserves native window behavior.

## Testing

- Use XCTest for unit and integration tests.
- Test domain logic without UI frameworks where possible.
- Test view models with injected clocks, file systems, and services.
- Use UI tests for critical workflows, menu commands, window behavior, and permissions where practical.
- Keep tests deterministic; avoid sleeps in favor of expectations or controllable clocks.
- Add fixtures for migration, file import/export, and permission edge cases.

## Logging And Diagnostics

- Use `Logger` from `os` for structured logging.
- Avoid `print` in production paths.
- Never log secrets, security-scoped bookmark data, access tokens, personal data, or file contents.
- Include subsystem/category names that make logs useful in Console.
- Add diagnostics for startup, migrations, background jobs, imports/exports, and integration failures.

## Style

- Follow Swift API Design Guidelines.
- Use `UpperCamelCase` for types and protocols, `lowerCamelCase` for methods, properties, variables, and enum cases.
- Prefer `let` over `var`.
- Prefer value types when identity is not needed.
- Keep access control as narrow as practical.
- Avoid force unwraps and force casts outside tests or impossible states documented next to the code.
- Prefer `guard` for preconditions and early exits.
- Keep extensions focused by protocol conformance or narrow behavior.

