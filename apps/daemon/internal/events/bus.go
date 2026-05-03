// Package events implements the per-server pub/sub the daemon WebSocket
// handlers subscribe to. One Bus per Server; subscribers receive every
// frame published while they hold their handle.
//
// We don't use channels-of-channels with broadcast — each subscriber gets
// its own buffered channel and slow consumers are dropped (we close their
// handle and let them reconnect) so a wedged browser can't backpressure
// the daemon.
package events

import (
	"sync"
)

// Frame is the unit of broadcast — exactly the bytes the WebSocket
// handler should send to its client. Keeping the marshalling on the
// publisher side means we serialize once per emit, not once per
// subscriber.
type Frame []byte

// Subscriber is a handle for a single WS client. Receive on Recv() in a
// goroutine; call Close() when the client disconnects.
type Subscriber struct {
	ch     chan Frame
	bus    *Bus
	closed bool
}

func (s *Subscriber) Recv() <-chan Frame { return s.ch }
func (s *Subscriber) Close() {
	s.bus.unsubscribe(s)
}

// Bus is the per-server fanout. Goroutine-safe.
type Bus struct {
	mu   sync.Mutex
	subs map[*Subscriber]struct{}
}

func New() *Bus { return &Bus{subs: map[*Subscriber]struct{}{}} }

// Subscribe registers a new subscriber. The returned channel is buffered
// at 64 frames; if the subscriber falls behind, further Publish calls
// drop frames (subscriber gets stale state but never blocks the bus).
func (b *Bus) Subscribe() *Subscriber {
	b.mu.Lock()
	defer b.mu.Unlock()
	s := &Subscriber{ch: make(chan Frame, 64), bus: b}
	b.subs[s] = struct{}{}
	return s
}

func (b *Bus) unsubscribe(s *Subscriber) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if s.closed {
		return
	}
	s.closed = true
	delete(b.subs, s)
	close(s.ch)
}

// Publish delivers the frame to every current subscriber. Non-blocking:
// if a subscriber's buffer is full, the frame is dropped for that
// subscriber.
func (b *Bus) Publish(f Frame) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for s := range b.subs {
		select {
		case s.ch <- f:
		default:
		}
	}
}

// SubscriberCount is exposed for tests + status endpoints.
func (b *Bus) SubscriberCount() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.subs)
}
