// Package proto holds the Go mirrors of the worker↔daemon and browser↔daemon
// wire contracts defined in `packages/daemon-proto`. The two side definitions
// are kept by hand for now; once the schema stabilises a small codegen step
// can derive these structs from the TypeScript source.
package proto

// Envelope wraps every WS frame. ID correlates a request with its eventual
// response/error; daemon-initiated events leave it empty.
type Envelope struct {
	ID      string  `json:"id"`
	Message Message `json:"message"`
}

// Message is the discriminated union; consumers read Type and switch.
type Message struct {
	Type string `json:"type"`
	// Payload bytes for the typed body. Daemon code unmarshals it into the
	// concrete struct for the matching Type.
	Payload []byte `json:"-"`
}

// Hello is the first frame sent by the daemon after connecting to the worker.
type Hello struct {
	Type            string   `json:"type"`
	NodeID          string   `json:"nodeId"`
	DaemonVersion  string   `json:"daemonVersion"`
	ProtocolVersion int      `json:"protocolVersion"`
	Capabilities   []string `json:"capabilities"`
}
