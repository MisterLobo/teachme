# Workspace

- /apps/web - Web Frontend
- /apps/api - API gateway
- /apps/signal - Media and Realtime service
- /apps/assistance_ranking - AI service
- /apps/wasm_worker - WASM worker

# TECH STACK:

## Frontend

### Web Client
- NextJS
- Shadcn
- TailwindCSS
- Tanstack Query
- Zustand

## Backend Services

### Edge Layer/API Gateway:
- NestJS
- gRPC clients
- WebSockets

### Core Backend
- Go
- Fiber
- PostgreSQL
- Redis
- Asynq
- Zap Logger
- Gobreaker
- RetryableHTTP

## AI Services
- FastAPI
- LangGraph
- Ollama
- NATS Jetstream
- Redis
- Fastembed

## Media & Real-Time Services

- Rust
- Axum
- Loco
- mediasoup
- socketioxide
- GStreamer
- WebRTC

# Authentication Stack

## Cryptography

## Browser-Side
- WebCrypto API
- WASM cryptographic modules

## Protocols
- OPAQUE
- Webauthn
- HKDF
- PBKDF2
- X25519
- Diffie-Hellman Key Exchange (DHKE)
- Argon2id

# Infrastructure

## Messaging & Communication
- gRPC
- NATS JetStream
- WebSockets

## Databases
- PostgreSQL
- MongoDB
- Redis
- Qdrant
- Neo4j

## Secrets & Security
- HashiCorp Vault
- PKI Infrastructure
- TLS / mTLS

## Observabilitiy (Planned)
- OpenTelemetry
- Prometheus
- Grafana
- ELK Stack

## Reliability Features
- Idempotent mutations
- Automatic retries
- Circuit breakers
- Backoff strategies
- Distributed event processing
- Queue-based background jobs
- Rate limiting
- Fault-tolerant workflows

## Planned Features
- Flutter mobile clients
- Full observability stack
- Distributed tracing
- Enhanced AI workflows
- Advanced moderation tooling
- Session recording pipeline
- Secure encrypted media archival

## Payments Processing
- Stripe Subscriptions, Connect, Elements, Webhooks

## Development Goals

The platform is designed to provide:
- secure digital learning
- scalable real-time communication
- modern cryptographic identity
- intelligent tutor discovery
- resilient distributed infrastructure
- privacy-preserving AI-assisted workflows

# TECHNICAL FEATURES:
- Zero-Trust Architecture
- End-to-End Encryption (E2EE)
- Client-Side Key Ownership
- Multi-layer Key Hierarchy
- Passkey + OPAQUE Authentication
- Recovery Code-based key recovery
- Secure WebRTC Media encryption
- Ephemeral Session Key derivation
- Mutual TLS (mTLS)
- Role-based and Row-level Security: PostgreSQL Row-Level Security (RLS) ensures strict access control at the database layer.
- Event-driven distributed architecture: Services communicate through gRPC, NATS Jetstream and async event pipelines
- Idempotent mutations: Critical operations such as bookings and payments are protected against duplicate execution and replay errors.
- Circuit Breakers & Retry Protection: Built-in resilience mechanisms prevent cascading failures and improve service reliability.
- AI Agent Workflow System: Specialized AI agents handle intelligent search, discovery, moderation, transcript analysis and scheduling recommendations using orchestrated multi-agent workflows.
- Service Authority Separation: Business logic, authentication, AI orchestration, signaling, and media handling are isolated into independently secured service domains.

# KEY FEATURES:
- Flexible Scheduling: Book sessions based on tutor availability with automated scheduling, reminders, and timezone handling.
- Smart Search Assistant: Describe what you want in plain language and instantly discover tutors, subjects, schedules and learning styles that match your needs.
- Zero Trust: services authenticate and verify each other
- Zero Knowledge: database server never learns or decrypts private session data
- Passkey & Passwordless Login
- Secure 1-on-1 Live Sessions
- Built-in Conferencing powered by mediasoup
- Cross-Device Access: Access your account securely from multiple devices while keeping your encrypted data protected.
- Multi-tenancy: data isolated per tenant
- Subscription & Free Trial: Try all platform features free for one month before choosing subscription plan that fits your needs.

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
bun api:dev
```

To run media service:

```sh
cd apps/signal
cargo loco watch --server-and-worker
```

To run AI service:

```sh
cd apps/assistance_ranking
./start.sh
```

- SSL Certificates are required to run TLS-enabled services.
- Suggested to use Vault PKI to issue certificates

To run backend services:

run `docker-compose up` at the root of the project

## System Specifications
- OS: EndeavourOS running cachyos-bore kernel version 7.0
- CPU: 8-core AMD Ryzen 7 5700X
- Video: 12GiB dedicated video memory
- RAM: 64 GiB system memory
