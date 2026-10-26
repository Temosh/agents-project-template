# C# Code Conventions

Use this file for all C# in the project. Follow `code-conventions.md` as the language-agnostic baseline. In Unity projects, the Unity-specific rules (MonoBehaviours, serialization, assets, async, performance in the engine) are in `code-conventions-unity.md`; they win where the two overlap.

## Language Version

- Use the newest language version the toolchain supports, and no feature beyond it.
- Unity 6 compiles C# 9. In Unity projects, do not use C# 10+ features (file-scoped namespaces, global usings, record structs, `required`, raw string literals, primary constructors on classes).
- In C# 9, `record` classes and `init` accessors work only with an `IsExternalInit` shim; prefer plain `sealed class` or `readonly struct` unless the shim is present in the assembly.
- Nullable reference types: enabled in pure C# domain assemblies and their tests, with nullable warnings as compile errors there (`-nullable:enable` and `-warnaserror+:nullable`; in Unity via `csc.rsp`). Not enabled in assemblies that deal heavily with `UnityEngine.Object`, whose overloaded `==` makes nullable analysis misleading.

## Formatting

- The repository `.editorconfig` is authoritative once the project adds one (Rider and Visual Studio read it). It encodes these rules:
- 4-space indentation, no tabs. Allman braces (opening brace on its own line).
- Always use braces, even for single-line `if`/`for`.
- One type per file; file name equals type name.
- `using` directives at the top of the file, outside the namespace, `System.*` first.
- Line length soft limit 120.

## Naming

| Element | Style | Example |
|---------|-------|---------|
| Namespace | `<Product>.<Layer>.<Feature>` | `Shop.Core.Orders` |
| Class, struct, enum, delegate | PascalCase | `OrderState` |
| Interface | `I` + PascalCase | `IPaymentGateway` |
| Method, property, event | PascalCase | `Submit`, `IsPaid`, `StatusChanged` |
| Private/protected field | `_camelCase` | `_currentOrder` |
| Private static field | `s_camelCase` | `s_sharedBuffer` |
| Constant, static readonly | PascalCase | `MaxLinesPerOrder` |
| Parameter, local | camelCase | `orderId` |
| Enum values | PascalCase, singular type name | `OrderStatus.Shipped` |
| Generic parameter | `T` or `T` + descriptor | `TDefinition` |
| Async method | `Async` suffix | `LoadOrderAsync` |

- Names use the domain vocabulary from `docs/project-brief.md` and `docs/domain-model.md`, not invented synonyms.
- Boolean members read as predicates: `IsPaid`, `HasDiscount`, `CanCancel`.
- Events are named for what happened (`OrderShipped`), handlers for what they do (`HandleOrderShipped`).

## Types And Design

- `sealed` by default. Open a class for inheritance only with a concrete reason.
- Prefer composition over inheritance. Deep hierarchies are forbidden; one level of abstract base is the usual maximum.
- Keep types small and single-purpose. A class that needs "Manager" in its name usually needs a more specific name.
- Use `readonly struct` for small immutable values (`OrderId`, `Money`, `Seed`). Keep structs at or under ~16 bytes unless measured.
- Use `class` for entities with identity and lifecycle (`Order`, `Customer`).
- Expose collections as `IReadOnlyList<T>` / `IReadOnlyDictionary<TKey, TValue>`; never return internal mutable collections.
- Mark fields `readonly` whenever possible.
- Use strongly typed IDs instead of raw `int`/`string` for domain identity.
- Model variants with enums + switch or small class hierarchies; handle unknown values with an explicit throw (`ArgumentOutOfRangeException`).
- Avoid static mutable state. Statics are allowed for pure functions, constants, and caches with explicit reset.
- No singletons for domain state. Services are created in the composition root and passed explicitly.

## Enums

- Enums that are serialized (in assets, scenes, save files, or persisted data) must have **explicit integer values**, and values are never reordered or reused. Serializers store the integer.
- Add new values at the end with a new number. Mark removed values `[Obsolete]` rather than deleting while data may still reference them.
- `[Flags]` enums use explicit powers of two and include `None = 0`.

## Methods

- Guard clauses and early returns over nested conditionals.
- Validate arguments at the public boundaries of the domain layer (`ArgumentNullException`, `ArgumentOutOfRangeException`); trust internal calls.
- Avoid `out`/`ref` except for Try-pattern methods (`TryGetLine(lineId, out OrderLine line)`) and measured hot paths.
- Avoid optional boolean parameters; use enums or separate methods.
- Methods that query must not mutate. Commands that mutate should read as verbs: `Submit`, `Cancel`.

## Nullability

- Domain code returns non-null by default. Use `TryGet` or an explicit optional result instead of returning `null`.
- In Unity, never use `?.` or `??` on `UnityEngine.Object` references; Unity's destroyed-object semantics bypass them. See `code-conventions-unity.md`.

## Errors

- Exceptions for programmer errors and impossible states. Fail fast; do not catch and continue.
- Expected business outcomes (rejected payment, failed validation, lost round) are **domain results**, not exceptions.
- Never swallow exceptions. A `catch` must log with context and either recover meaningfully or rethrow (`throw;`, not `throw ex;`).
- No `catch (Exception)` outside top-level boundaries (startup, save/load, async entry points).

## Events And Delegates

- Use C# `event Action<T>` / custom delegates for code-to-code notifications.
- Every subscription has a matching unsubscription with a clear owner.
- Event payloads are immutable values.
- Do not raise events from constructors or while the object is in an inconsistent state.

## Collections And LINQ

- LINQ is fine in setup code, validation, tooling, and tests.
- No LINQ, closures capturing locals, or `foreach` over interfaces in hot paths (per-frame game code, tight loops); they allocate. Use `for` loops over `List<T>`/arrays.
- Pre-size collections when the size is known. Reuse buffers in hot paths.
- Use `Dictionary<TKey, TValue>` with value-type keys that implement `IEquatable<T>` to avoid boxing.

## Strings

- No string concatenation or interpolation in hot paths. Cache or use `StringBuilder`.
- User-facing text comes from content data or resources, not literals in code, so it can be edited and later localized.
- Use `nameof()` instead of string literals for member names.
- Use `StringComparison.Ordinal` for identifiers.

## Async

- Use `Task`/`ValueTask` for asynchronous work unless the platform provides a better-suited primitive (Unity: see `code-conventions-unity.md`).
- No `async void` except for event handlers that must be void; wrap their bodies in try/catch with logging.
- Pass `CancellationToken` into long-running operations.
- Never block on `.Result` or `.Wait()`.

## Randomness And Time

- Domain randomness uses a seeded random source passed in as a dependency. Never an unseeded `System.Random`.
- Domain code never reads the clock. Time is passed in (elapsed time, a clock abstraction) so logic is testable and deterministic.

## Comments And Documentation

- XML doc comments (`///`) on public types and members of the domain layer and of contracts other layers implement.
- Comments explain *why* (tuning rationale, platform quirk workaround), not what the code does.
- `TODO` comments include a short reason; do not leave stale ones.

## Tests

- NUnit (via Unity Test Framework in Unity projects) unless the project chose another framework.
- Test names: `MethodOrScenario_Condition_ExpectedResult`, e.g. `Submit_WithEmptyCart_ReturnsRejected`.
- Arrange/Act/Assert, one behavior per test.
- Use builders for domain fixtures (`OrderBuilder`, `CustomerBuilder`); keep magic numbers out of test bodies.
- Every domain behavior change comes with a unit test. Every bug fix comes with a regression test at the lowest level that reproduces it.
- Seeded randomness in tests; assert on fixed seeds, never on "probably" outcomes. Distribution tests run many seeded trials with explicit tolerances.

## Forbidden

- `dynamic`, reflection-based domain logic, `System.Linq.Expressions`.
- `goto`.
- `#region` blocks (they hide oversized types).
- Public mutable fields in plain C# types.
- Extension methods on `object` or broad framework types that hide behavior.
