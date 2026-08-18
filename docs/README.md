# Documentation

Use this page to find the smallest document that covers the task.

## Start here

| Task | Document |
|---|---|
| Understand the system | [Architecture](architecture.md) |
| Set up a development environment | [Contributing](../CONTRIBUTING.md#local-setup) |
| Change backend, database, worker, or app code | [Contributing](../CONTRIBUTING.md#change-requirements) |
| Deploy the API, worker, or mobile app | [Deployment](deployment.md) |
| Rebuild a lost or replaced server | [Droplet recovery](runbooks/droplet-recovery.md) |
| Diagnose a client that contacts the wrong API | [Stale API URL incident](incidents/2026-08-15-stale-api-url.md) |
| Diagnose a deploy that reports success but changes nothing | [Silent deploy no-op incident](incidents/2026-08-17-silent-deploy-no-op.md) |
| Understand the course brain, its schema, or its access rules | [Architecture](architecture.md#course-brain) and [AGENTS.md](../AGENTS.md#security-invariants) |
| Build or debug the native app | [Mobile builds](mobile-builds.md) |
| Navigate the Expo source | [Mobile app README](../learnus-app/README.md) |
| Review repository automation constraints | [Repository operating contract](../AGENTS.md) |

Repository entry points and legal documents:

- [Project overview](../README.md)
- [Privacy policy](legal/privacy-policy.md)
- [Terms of service](legal/terms-of-service.md)
- [License](../LICENSE)

## Document ownership

- `README.md` is the product entry point and high-level repository map.
- `CONTRIBUTING.md` owns local setup, change workflow, and validation requirements.
- `architecture.md` owns runtime boundaries and source navigation.
- `deployment.md` owns the normal release path and deployment configuration.
- `runbooks/` contains recovery procedures that operators execute during an incident.
- `incidents/` records evidence and lessons from a specific event.
- `legal/` contains the user-facing privacy policy and terms of service.
- `AGENTS.md` is the repository operating contract. Update it when architecture, schema, invariants, or required checks change.

Avoid copying the same instructions into several files. Link to the owning document and keep commands next to the system that executes them.
