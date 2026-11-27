# Architecture Diagrams

Two diagrams: runtime/deploy flow (rarely changes) and the data model (changes every theme as `bun run gen` adds entities). Both exist for the **"Code and design gap - mapping design to code"** rubric line: every node is labeled with the real file that implements it.

GitHub, VS Code and most slide tools render mermaid directly.

## Runtime / deploy flow

```mermaid
flowchart LR
    subgraph Browser
        UI["Next.js UI<br/>apps/web/src/features/*"]
        Forms["Forms validated by shared Zod<br/>packages/shared/src/resource.ts"]
    end

    subgraph "Vercel (required by competition rules)"
        Next["Next.js 16 app<br/>apps/web/src/app/*"]
        Rewrite["/api/* rewrite (same-origin cookie)<br/>apps/web/next.config.ts"]
    end

    subgraph "Cloudflare Workers (edge)"
        Hono["Hono API + security middleware<br/>apps/api/src/app.ts"]
        Auth["AuthService / UserService<br/>apps/api/src/services/*.service.ts"]
        RBAC["requirePermission (deny by default)<br/>apps/api/src/middleware/auth.ts"]
        CRUD["ResourceService (generic, scoped)<br/>apps/api/src/services/resource.service.ts"]
        Room["RealtimeRoom Durable Object<br/>apps/api/src/realtime/room.ts"]
    end

    D1[("Cloudflare D1 (SQLite)<br/>apps/api/src/db/schema/*")]

    UI --> Next --> Rewrite -- "HTTPS /api/*" --> Hono
    UI -- "wss /ws/topic?ticket" --> Room
    Forms -.same schema.-> Hono
    Hono --> RBAC --> CRUD --> D1
    Hono --> Auth --> D1
    CRUD -- "publish()" --> Room

    subgraph "CI/CD (GitHub)"
        CI["CI: typecheck, workerd tests, build, audit, gitleaks<br/>.github/workflows/ci.yml"]
        DeployAPI["Deploy API: tests -> D1 migrate -> wrangler deploy<br/>.github/workflows/deploy-api.yml"]
        VercelGit["Vercel Git integration<br/>apps/web/vercel.json"]
    end
    CI --> DeployAPI --> Hono
    VercelGit --> Next
```

## Data model (regenerate every theme)

Core tables from `apps/api/src/db/schema/core.ts`. Add one block per generated resource from `apps/api/src/db/schema/<name>.ts`.

```mermaid
erDiagram
    USERS {
        int id PK
        text email UK
        text full_name
        text password_hash "PBKDF2-SHA256"
        bool is_active
        int token_version "session revocation"
        text created_at
    }
    ROLES {
        int id PK
        text name UK
    }
    PERMISSIONS {
        int id PK
        text name UK "resource:action"
    }
    USER_ROLES {
        int user_id FK
        int role_id FK
    }
    ROLE_PERMISSIONS {
        int role_id FK
        int permission_id FK
    }
    AUDIT_LOG {
        int id PK
        int user_id FK
        text action
        text resource
        int resource_id
        text at
    }
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : grants
    ROLES ||--o{ ROLE_PERMISSIONS : includes
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : in
    USERS ||--o{ AUDIT_LOG : performed

    %% Theme entities below. Every generated table also has created_by FK -> USERS, created_at, updated_at.
    %% Practice-run example (remove once replaced by the theme's entities):
    PROJECTS {
        int id PK
        text name
        real budget
        text status "planning|active|done"
        int created_by FK
    }
    TASKS {
        int id PK
        text title
        text status "todo|doing|done"
        text due
        bool done
        int project_id FK
        int created_by FK
    }
    PROJECTS ||--o{ TASKS : contains
    USERS ||--o{ TASKS : created
```

## Checklist before presenting

- [ ] Every node names a real file.
- [ ] The data model shows this theme's entities (drop the practice PROJECTS/TASKS if they were removed with `bun run gen --remove`).
- [ ] Both diagrams render (check in a markdown preview first).
