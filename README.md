# Workspace

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/nest?utm_source=nx_project&amp;utm_medium=readme&amp;utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

- /apps/web - Web Frontend (NextJS)
- /apps/org-api - API gateway (NestJS)
- /apps/signal - Data API service (Loco)
- /apps/assistance_ranking - AI service (FastAPI)

# TECH STACK:
- Frontend: NextJS, Shadcn, TailwindCSS
- API Layer: NestJS,
- Data Layer: Loco (Rust),
- Search/Ranking: FastAPI (Python), Pydantic, Ollama
- Vector generator: Fastembed (embeddings),
- Caching: Redis
- Database: PostgreSQL with PgVector, Sea-orm
- Calendar/Scheduling: cal.com self-hosted instance
- Conferencing: mediasoup

## Run tasks

To run the dev server for your app, use:

```sh
cd teachme/
bun web:dev
```

To create a production bundle:

```sh
nx build web
```

To run API gateway:
```sh
cd teachme/
bun api:dev
```

To run data service:

```sh
cd apps/signal
cargo loco watch --server-and-worker
```