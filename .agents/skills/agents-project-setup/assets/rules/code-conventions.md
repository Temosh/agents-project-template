# Code Conventions

This file contains language-agnostic conventions. Keep language and framework specifics in separate rule files, for example:

- `code-conventions-java.md`
- `code-conventions-typescript.md`
- `code-conventions-react.md`
- `code-conventions-swift-macos.md`

When a project adds another language or major framework, create a dedicated rule file instead of growing this file with unrelated sections.

## General Principles

- Keep functions small enough to name and test coherently.
- Put business rules in domain/application code, not UI glue or transport adapters.
- Validate untrusted input at system boundaries and use typed/validated values internally.
- Avoid global mutable state unless it is an explicit infrastructure concern.
- Do not swallow errors silently; either handle them meaningfully or propagate them.
- Add comments for non-obvious decisions, not for code that already reads plainly.

## Naming

- Use names that describe domain meaning, not implementation mechanics.
- Avoid vague names such as `data`, `item`, `obj`, `manager`, `helper`, or `util` when a more specific name exists.
- Boolean names should read as predicates: `isActive`, `hasPermission`, `canRetry`, `shouldRefresh`.
- Callback or event names should describe the event: `onSave`, `onSelectionChange`, `handleSubmit`.
- Keep abbreviations out of public APIs unless they are standard in the project domain.

## Functions

- Functions should do one conceptual thing.
- Prefer early returns over deeply nested conditionals.
- Avoid hidden side effects in functions that look like queries or formatters.
- Keep I/O at the edges; isolate pure transformations where practical.
- Prefer passing explicit dependencies over reaching into global singletons.
- Avoid boolean parameters when named alternatives or option objects make intent clearer.

## Data And State

- Prefer immutable values for data passed across module boundaries.
- Keep ownership of mutable state explicit.
- Do not expose internal mutable collections directly.
- Normalize data at system boundaries rather than repeatedly compensating in inner code.
- Keep derived data derived unless caching is measured and justified.

## Error Handling

- Preserve the original error cause when wrapping exceptions.
- Include actionable context in logs and error messages.
- Do not leak secrets, tokens, credentials, or personal data into logs.
- Prefer typed/domain errors for expected business failures.
- Use crash-fast behavior for impossible states after exhaustive checks.

## Testing

- Add or update tests for behavior changes, bug fixes, and risky refactors.
- Test public behavior and important edge cases rather than private implementation details.
- Prefer deterministic tests with explicit fixtures.
- Avoid sleeps and timing-dependent tests unless the timing behavior is the subject under test.
- Keep test names descriptive enough to explain the expected behavior.

## Imports And Dependencies

- Keep imports ordered consistently with the project's formatter/linter.
- Avoid circular dependencies.
- Prefer existing dependencies and standard libraries before adding new packages.
- Do not introduce duplicate libraries for the same concern.
- Keep dependency additions explicit and justified.

## Formatting

- Let the configured formatter own whitespace, wrapping, and import ordering.
- Do not hand-format against the formatter.
- Keep files in UTF-8.
- Use ASCII unless the file or domain already requires non-ASCII text.

## Security

- Treat all external input as untrusted.
- Never commit secrets, credentials, private keys, access tokens, or real customer data.
- Avoid logging sensitive data.
- Keep authorization checks close to the protected operation.
- Prefer allowlists over blocklists for validation when practical.
