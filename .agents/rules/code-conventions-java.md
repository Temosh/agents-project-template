# Java Code Conventions

Use this file for modern Java projects. Adjust version-specific guidance to the project's supported Java version, but prefer current LTS Java features when available.

## Baseline

- Target the newest LTS version the project can reasonably support, preferably Java 21 or newer.
- Use the project's build tool consistently: Maven or Gradle, not both unless the repo is intentionally multi-build.
- Enable compiler warnings and static analysis in CI.
- Treat formatter output as authoritative; do not hand-format around the formatter.
- Prefer UTF-8, reproducible builds, and dependency locking or verification where the build tool supports it.

## Design Principles

- Model the domain explicitly with small, cohesive types.
- Keep business logic out of controllers, framework annotations, persistence entities, and transport DTOs.
- Prefer immutability by default.
- Make illegal states unrepresentable where practical.
- Favor constructor injection for required dependencies.
- Avoid static mutable state.
- Keep public APIs small and stable.

## Types And Immutability

- Use `record` for immutable data carriers with value semantics.
- Use classes when invariants, behavior, lifecycle, inheritance constraints, or framework requirements justify them.
- Validate invariants at construction boundaries.
- Prefer unmodifiable collections and defensive copies for stored or returned collections.
- Do not return `null` collections; return empty collections.
- Use `Optional` for possibly absent return values, not for fields, parameters, or collection elements.

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money {
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        if (amount.scale() > currency.getDefaultFractionDigits()) {
            throw new IllegalArgumentException("amount has too many fraction digits");
        }
    }
}
```

## Nullability

- Avoid `null` in domain code.
- Validate external inputs at boundaries.
- Use nullness annotations if the project has standardized on one set.
- Use `Objects.requireNonNull` for required constructor arguments and method parameters at public boundaries.
- Do not use `Optional.get()` without first proving presence; prefer `orElseThrow`, `map`, `flatMap`, or explicit branching.

## Exceptions And Error Handling

- Use unchecked exceptions for programming errors and impossible states.
- Use domain-specific exceptions or result types for expected business failures, according to project style.
- Preserve causes when wrapping exceptions.
- Do not catch broad `Exception` unless you are at a boundary that can translate, log, or recover.
- Never swallow `InterruptedException`; restore interruption with `Thread.currentThread().interrupt()`.
- Include useful context in messages without leaking secrets or personal data.

## Collections And Streams

- Prefer clear loops when stream pipelines become hard to read or debug.
- Avoid side effects inside stream operations.
- Use `List.copyOf`, `Set.copyOf`, and `Map.copyOf` for defensive immutable copies.
- Specify map merge behavior explicitly when duplicate keys are possible.
- Avoid parallel streams in application code unless benchmarked and isolated.

## Concurrency

- Prefer structured concurrency and virtual threads when the project targets Java 21+ and the runtime model supports them.
- Keep shared mutable state synchronized, confined, or replaced with immutable snapshots.
- Use high-level concurrency utilities from `java.util.concurrent`.
- Avoid blocking calls on event-loop threads or framework-managed nonblocking schedulers.
- Timeouts should be explicit for network, database, and external process calls.

## Equality, Ordering, And Time

- Implement `equals` and `hashCode` together, or use records/value objects where appropriate.
- Make comparators total and null handling explicit.
- Use `java.time` types, not legacy `Date`/`Calendar`.
- Store instants in UTC unless the domain requires local date/time semantics.
- Inject `Clock` when testing time-dependent code.

## Numbers

- Use `BigDecimal` for money and exact decimal business values.
- Do not construct `BigDecimal` from `double`; use strings, integers, or `BigDecimal.valueOf`.
- Define rounding mode explicitly.
- Use primitive numeric types for counters and measurements when exact decimal semantics are not needed.

## API And DTO Boundaries

- Keep DTOs separate from domain objects when external contracts can change independently.
- Validate DTOs before converting to domain types.
- Do not expose persistence entities directly through APIs.
- Map at boundaries with explicit code or a project-standard mapper.
- Keep serialization annotations out of domain types unless the project intentionally uses domain types as contracts.

## Persistence

- Keep transaction boundaries in application/service methods, not deep helper methods.
- Avoid lazy-loading surprises in serialization or logging.
- Prefer explicit queries over accidental N+1 access patterns.
- Keep schema migrations small, reversible when practical, and paired with application changes.
- Do not put business rules only in database triggers or ORM callbacks unless documented as architecture.

## Spring Projects

Use this section only for Spring-based projects.

- Use constructor injection; avoid field injection.
- Keep controllers thin: validate, authorize, translate transport models, call application services.
- Keep service methods transactionally meaningful.
- Use configuration properties classes for grouped config, with validation.
- Prefer `@RestControllerAdvice` for consistent error responses.
- Do not put secrets in `application.yml`; use environment or secret management.
- Avoid `@SpringBootTest` for tests that can be narrower slices or plain unit tests.

## Testing

- Use JUnit 5.
- Use AssertJ or the project-standard assertion library consistently.
- Use Mockito sparingly; prefer testing behavior through real objects when setup remains clear.
- Use Testcontainers for integration tests that depend on real databases or brokers when feasible.
- Keep unit tests fast and deterministic.
- Name tests by behavior, not implementation details.
- Cover edge cases around null boundaries, invalid input, transactions, concurrency, and time.

## Logging

- Use the project-standard logging facade, typically SLF4J.
- Use parameterized logging, not string concatenation.
- Log at boundaries and meaningful state transitions; avoid noisy logs inside tight loops.
- Include correlation/request IDs where the platform supports them.
- Never log credentials, tokens, secrets, or sensitive personal data.

## Style

- Follow standard Java naming: `UpperCamelCase` types, `lowerCamelCase` methods/fields/locals, `UPPER_SNAKE_CASE` constants.
- Keep packages lowercase and meaningful.
- Keep methods short enough to scan; extract private methods when they clarify intent.
- Prefer pattern matching, switch expressions, records, and sealed types when supported and clearer.
- Avoid Lombok in new code unless the project explicitly standardizes on it.
- Avoid reflection unless required by a framework or isolated infrastructure concern.

