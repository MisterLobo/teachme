---
name: screen-share-media
description: Use when debugging screen share start/stop, blank remote video feeds, WebRTC media pipeline issues, producer/consumer lifecycle problems, or mediasoup rendering bugs in the web client.
---

# Screen Share & Media Sessions

## Known Issues & Fixes

### Blank remote video feed (camera)
- **Cause**: The participant `<div>` had `position: relative` with an `absolute`-positioned `<video>`, but no explicit height. The div collapsed to 0 because absolute children don't contribute to parent height.
- **Fix**: Add `!screenShareParticipant && 'h-full'` to the participant div. Confirm with `el.videoWidth` / `el.videoHeight` in `onLoadedMetadata`.

### Screen share stop → camera feed frozen (Bob's side)
- **Root cause**: `producer.close()` on the client sends `closeProducer` through mediasoup's internal Channel, **not** through our Rust socket.io handler. The Rust-side `on_close` callback never fires.
- **Fix**: Send `{ action: 'CloseProducer', producerId }` via socket.io **before** calling `producer.close()`. Server calls `room.remove_producer()` which broadcasts `ProducerRemoved`.

### Consumer paused forever (blank tile)
- **Cause**: `ConsumerResume` arrives before the consumer is saved in `conn.consumers` map. The resume is silently skipped, consumer stays paused.
- **Fix**: Save the consumer in `conn.consumers.lock().await.insert(id, consumer.clone())` **before** sending `Consumed`. Never rely on the async internal channel for this.

### `producer_sources` returns `None` on removal
- **Cause**: `remove_producer` removed the source entry from the HashMap before firing `on_producer_remove` handlers.
- **Fix**: Move `producer_sources.lock().remove(producer_id)` to **after** `self.inner.handlers.producer_remove.call_simple(...)`.

### Browser "Stop Sharing" not working
- **Fix**: Use `stream.addEventListener('inactive', stopScreenShare)` as the primary handler. Add `track.addEventListener('ended', stopScreenShare)` as fallback. Guard with `cleaningUp` flag to prevent double execution.

## Rendering Rules

- Video element needs `muted` for autoplay
- Use stable React keys (`'remote-video-' + p.id`) to prevent remount on layout transitions
- Set `srcObject` via ref callback with reference comparison (`el.srcObject !== stream`)
- Track `readyState=4` + `paused=false` + `videoWidth>0` = technically correct but frames not flowing (suggests pipeline issue, not rendering)

## Debugging Checklist

1. Check `server.log` at project root for producer/consumer events
2. Verify `[internal] SaveProducer` log appears (confirms HandlerId stored)
3. Check `ProducerRemoved` is broadcast when screen share stops
4. On Bob's side: log `el.readyState`, `el.paused`, `el.videoWidth/Height`, `el.srcObject.getTracks()`
5. Confirm consumer is in `conn.consumers` map before `ConsumerResume`
6. Verify `producer_sources` entry exists before `remove_producer` fires handlers
