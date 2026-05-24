---
name: web-frontend
description: Use when working on apps/web — the Next.js frontend with mediasoup-client, WebRTC media rendering, Shadcn UI components, Tanstack Query data fetching, Zustand state management, and socket.io signaling.
---

# Web Frontend

## Tech Stack

- **Next.js** (v16) — App Router, React 19
- **Shadcn** — UI component library (Radix primitives + Tailwind CSS v4)
- **Tailwind CSS** (v4) — Utility-first styling
- **Tanstack Query** — Server state, caching, refetching
- **Zustand** — Client state management
- **React Hook Form** (v7.72) — Form handling with `useWatch` and `Controller`
- **Zod** (v4) — Schema validation
- **Framer Motion** — Animations
- **Lucide React** — Icons
- **Sonner** — Toast notifications

## mediasoup-client Patterns

### Producer lifecycle (client-side)

```typescript
const producer = await producerTransport.produce({ track })
producer.id          // ProducerId (string)
producer.close()     // sends through mediasoup Channel, NOT socket.io
```

When stopping a producer (e.g., screen share), always send `CloseProducer` via socket.io **before** calling `producer.close()`:

```typescript
sendMessage({ action: 'CloseProducer', producerId: producer.id as ProducerId })
producer.close()
```

### Consumer lifecycle

```typescript
// Server sends ProducerAdded → client queues consume request
// sendMessage({ action: 'Consume', producerId })
// wait for Consumed response
// consumerTransport.consume() with rtpParameters
// add track to participant's MediaStream

// On ProducerRemoved: clean up consumer, remove track from MediaStream
```

### Video element rendering

```tsx
<video
  key={'remote-video-' + p.id}
  ref={el => {
    if (el && el.srcObject !== p.mediaStream) el.srcObject = p.mediaStream
  }}
  muted
  autoPlay
  playsInline
  className="absolute inset-0 h-full w-full object-cover"
  onLoadedMetadata={e => console.log('video dims:', e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
/>
```

- Use stable key to prevent remount on layout changes
- Use `ref` callback with reference comparison, not `!el.srcObject` guard
- Always include `muted` for autoplay compliance

## State Patterns

- `ref` for mutable values that shouldn't trigger re-renders (`producerTransportRef`, `screenShareProducersRef`)
- `useRef<FormSchema | null>(null)` for submitted form data (survives unmount)
- `useReducer(x => x + 1, 0)` for force-update when refs change
- `useWatch` can return `undefined` after `Controller` unmounts — use `joinPayloadRef.current?.username` instead for persistence

## Socket.io Message Types

Defined in `apps/web/src/lib/types.ts`:

- **ServerMessage**: `Init`, `ProducerAdded`, `ProducerRemoved`, `ProducerPaused`, `ProducerResumed`, `ConnectedProducerTransport`, `Produced`, `ConnectedConsumerTransport`, `Consumed`
- **ClientMessage**: `Init`, `ConnectProducerTransport`, `Produce`, `ConnectConsumerTransport`, `Consume`, `ConsumerResume`, `PauseProducer`, `ResumeProducer`, `CloseProducer`

All messages use `{ action: 'ActionName', ...fields }` format with `camelCase` field names.

## Run Commands

```sh
bun web:dev           # dev server on port 3005
nx build web          # production build
npx tsc --noEmit      # type check
npx eslint apps/web   # lint
```
