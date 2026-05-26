# Audit: web-frontend-dev (browser)
**Task**: Implement browser-side telemetry for Next.js web client
**Delegated by**: supervisor
**Started**: 2026-05-24T18:04:00Z
**Files read**: apps/web/package.json, apps/web/src/app/layout.tsx, apps/web/src/lib/actions.ts

## Log

### 1. Read existing frontend files
- **Action**: read
- **Target**: package.json, layout.tsx, actions.ts
- **Rationale**: Understand frontend structure and how to inject telemetry client component
- **Outcome**: Standard Next.js App Router layout, server actions in actions.ts

### 2. Created src/lib/telemetry.ts
- **Action**: write
- **Target**: src/lib/telemetry.ts
- **Rationale**: Need browser OTel init with WebTracerProvider and instrumentations
- **Outcome**: 136-line module with initBrowserTelemetry() — singleton guard, OTLP HTTP exporter, W3C propagator, ZoneContextManager for async context, FetchInstrumentation + XMLHttpRequestInstrumentation + DocumentLoadInstrumentation + UserInteractionInstrumentation; also exports fetchWithTrace() and withSpan()

### 3. Created src/components/client-telemetry.tsx
- **Action**: write
- **Target**: src/components/client-telemetry.tsx
- **Rationale**: Next.js root layout is server component — need 'use client' wrapper for useEffect call
- **Outcome**: 20-line client component that calls initBrowserTelemetry() on mount, renders nothing

### 4. Updated src/app/layout.tsx
- **Action**: edit
- **Target**: src/app/layout.tsx
- **Rationale**: Register telemetry in root layout so it initializes on every page
- **Outcome**: Added ClientTelemetry component import and render inside <body>

### 5. Created .env.example
- **Action**: write
- **Target**: .env.example
- **Rationale**: Document new NEXT_PUBLIC_* env vars for OTel configuration
- **Outcome**: 32-line template with NEXT_PUBLIC_OTEL_ENDPOINT, NEXT_PUBLIC_ENV, NEXT_PUBLIC_APP_VERSION

### 6. Updated package.json
- **Action**: edit
- **Target**: package.json
- **Rationale**: Add 15 @opentelemetry/* dependencies for browser SDK
- **Outcome**: Added all required Web OTel packages

## Summary
- **Files created**: src/lib/telemetry.ts, src/components/client-telemetry.tsx, .env.example
- **Files modified**: src/app/layout.tsx, package.json
- **Key decisions**: ClientTelemetry as separate render-nothing component for clean separation; singleton guard for StrictMode double-invocation; propagateTraceHeaderCorsUrls: /.*/ for dev (must tighten in prod)
- **Completed**: 2026-05-24
