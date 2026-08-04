# Step 11: Environment and Hosting Architecture

Decision date: August 3, 2026

## Platform Decision

The Prologue Project Dashboard will use:

- Render for staging and production application hosting.

- Neon for hosted PostgreSQL.

- GitHub for source control and deployment branch management.

- The Virginia region whenever available.

The existing Dockerfile will be used for the Render web services.

## Environment Model

| Environment | Git branch | Application | Database |

| --- | --- | --- | --- |

| Local development | Feature branch | Local Next.js application | Local Docker PostgreSQL |

| Staging | `develop` | Render staging web service | Neon staging database branch |

| Production | `main` | Render production web service | Neon production database branch |

Feature branches merge into `develop`.

After staging verification, `develop` merges into `main` through a pull request.

Production deployments must originate only from `main`.

## Application URLs

### Local

```text

APP_BASE_URL=http://localhost:3000

APP_ENV=development

TEAMWORK_REDIRECT_URI=http://localhost:3000/api/teamwork/oauth/callback

```
