# Stack Rules

This is a template stub. Replace or extend it with rules for the selected project stack.

## Runtime And Tooling

Placeholder: document exact versions and commands.

Include:

- Language and runtime versions.
- Package manager and lockfile policy.
- Build, test, lint, format, and dev-server commands.
- Required environment variables and local services.
- CI expectations.

## Frameworks

Placeholder: document framework-specific rules.

For each framework, include:

- Required setup and provider/bootstrap patterns.
- Approved state management and data fetching patterns.
- Routing or controller conventions.
- Error handling and validation patterns.
- Styling/theming conventions for UI frameworks.
- Version-specific APIs that agents must use or avoid.

## Dependencies

Placeholder: document dependency policy.

Recommended rules:

- Prefer standard library and existing dependencies before adding new packages.
- Add a dependency only when it reduces meaningful complexity or provides a mature implementation of a hard problem.
- Do not add duplicate libraries for the same concern.
- Document forbidden packages and why they are forbidden.
- Keep dependency changes explicit in the final summary.

## Configuration

Placeholder: document where configuration lives.

Include:

- Environment variable naming and validation.
- Runtime config versus build-time config.
- Secrets handling.
- Feature flag policy.
- Logging and telemetry configuration.

## Database And Persistence

Placeholder: use for backend/data projects.

Include:

- Migration tool and command.
- Transaction boundaries.
- Repository/DAO/query conventions.
- ID generation and timestamp policy.
- Soft delete, audit, and retention rules.

## API And Integration

Placeholder: use for services or apps with external integrations.

Include:

- API style: REST, GraphQL, gRPC, events, CLI, SDK.
- Request/response validation.
- Retry, timeout, and idempotency expectations.
- Authentication and authorization placement.
- Contract testing or schema generation rules.

## Frontend Stack

Placeholder: use for frontend projects.

Include:

- Router setup.
- Data fetching approach.
- State management approach.
- UI component library rules.
- Icon and asset policy.
- Accessibility requirements.
- Browser support.
