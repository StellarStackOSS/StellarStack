// Package sftp embeds an SFTP server (pkg/sftp over golang.org/x/crypto/ssh)
// that authenticates clients against JWTs minted by the API. Real
// implementation lands in the "File manager + SFTP" milestone.
package sftp

// Server holds the configuration and listener state for the SFTP service.
type Server struct{}

// New returns a default SFTP server. Implementation pending.
func New() *Server {
	return &Server{}
}
