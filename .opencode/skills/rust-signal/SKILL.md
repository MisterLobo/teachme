---
name: rust-signal
description: Use when working on apps/signal — the Rust media & real-time service powered by mediasoup, socketioxide, and WebRTC. Covers transport management, producer/consumer lifecycle, room state, and WebRTC signaling.
---

# Rust Signal Service

## Architecture

The signal service (`apps/signal/src/initializers/initialize_chat.rs`) manages WebRTC peer connections through mediasoup. Key abstractions:

- **Room** — A container for a media session. Holds producers, consumers, and participant connections. Uses interior mutability (`Mutex<HashMap<...>>`) for thread-safe access.
- **Producer** — Outgoing media (audio/video) from a participant. Created via `transport.produce()`. Each producer has a `HandlerId` from `producer.on_close()` that MUST be kept alive or the callback is immediately dropped.
- **Consumer** — Incoming media delivered to a participant. Created via `transport.consume()`. The consumer MUST be saved in the `conn.consumers` map **before** sending `Consumed` to the client, to avoid race conditions with `ConsumerResume`.

## Message Flow (socket.io)

Three independent channels:

1. **Server channel** (`server_channel`) — `UnboundedSender<ServerMessage>` for sending messages to the socket's own message handler (relayed to the client)
2. **Internal channel** (`internal_channel`) — `UnboundedSender<InternalMessage>` for the `init_internal_handlers` loop that stores Producer/Consumer + HandlerId pairs
3. **Room channel** (`room_channel`) — `UnboundedSender<RoomMessage>` for room-level broadcasts

## Key Patterns

### Producer lifecycle

```
Client sends Produce → transport.produce() → store in room.clients
→ register on_close(|| room.remove_producer())
→ SaveProducer(producer, handler_id) via internal channel
```

`producer.close()` on the client sends through mediasoup's internal Channel, **not** through our socket.io handler. The Rust-side `on_close` callback does NOT fire for client-initiated closes. Use the explicit `CloseProducer` socket.io message when the server needs to know a producer was closed.

### Consumer lifecycle

```
Client sends Consume → transport.consume() → save in conn.consumers BEFORE sending Consumed
→ ConsumerResume finds consumer in map → consumer.resume()
```

Always save the consumer in the `consumers` map synchronously before responding to the client. Never rely on the async internal channel (`SaveConsumer`) for this — it introduces a race with `ConsumerResume`.

### Room methods

- `add_producer(participant_id, producer)` — stores in `clients` map, fires `on_producer_add` handlers
- `remove_producer(participant_id, producer_id)` — removes from `clients`, fires `on_producer_remove` handlers, then cleans up `producer_sources` (sources must be read BEFORE removal)
- `pause_producer(participant_id, kind)` / `resume_producer(...)` — finds producer by kind, pauses/resumes, returns bool
- `set_producer_source(producer_id, source)` / `get_producer_source(producer_id)` — marks a producer as "screen" or "camera"

## Common Bugs & Gotchas

- `producer_sources.remove()` must happen **after** `call_simple()` in `remove_producer`, otherwise `get_producer_source` returns `None` during handler execution
- `HandlerId` from `producer.on_close()` must be stored or the callback is immediately unregistered — store via `InternalMessage::SaveProducer`
- `producer.close()` on the client does NOT trigger Rust-side `on_close` — always send `CloseProducer` socket.io message for client-initiated closes
- Consumer must be in `conn.consumers` map before `ConsumerResume` arrives, or resume is silently skipped → consumer stays paused → blank video tile

## Run Commands

```sh
cargo loco watch --server-and-worker  # dev server from apps/signal
cargo check                             # type-check only
cargo clippy                            # lint
cargo test                              # run tests
```
