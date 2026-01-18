package checks

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/MarquesCoding/StellarStack/installer/config"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    NETWORK CONNECTIVITY CHECK FUNCTIONS                    ║
║                                                                            ║
║  These functions handle DNS resolution, IP address detection, and        ║
║  network connectivity verification.                                       ║
║                                                                            ║
║  Special care is taken to handle timeouts gracefully and provide          ║
║  detailed error messages when network operations fail.                    ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
DetectServerIP automatically detects the server's public IP address.
Uses multiple services to ensure reliability in different network environments.

The function tries these services in order:
1. ipify.org - Simple and reliable
2. icanhazip.com - Cloudflare-backed
3. ifconfig.me - User-agent friendly

If all external services fail, returns error. Manual IP entry is then required.

Parameters:
  ctx - Context for cancellation and timeout

Returns:
  string - Detected IP address
  error - Error if detection failed
*/
func DetectServerIP(ctx context.Context) (string, error) {
	/*
	Create a timeout specifically for IP detection.
	Network calls can be slow, so we give it a reasonable timeout.
	*/
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	/*
	List of IP detection services in priority order.
	Each service is tried with a specific timeout.
	*/
	ipServices := []struct {
		name string
		url  string
	}{
		{
			name: "ipify.org",
			url:  "https://api.ipify.org?format=text",
		},
		{
			name: "icanhazip.com",
			url:  "https://icanhazip.com/",
		},
		{
			name: "ifconfig.me",
			url:  "https://ifconfig.me/",
		},
	}

	/*
	Try each service until one succeeds.
	This ensures we get the IP even if one service is down.
	*/
	var lastErr error

	for _, service := range ipServices {
		ip, err := getIPFromService(ctx, service.url)
		if err != nil {
			/*
			Service failed, but we'll try the next one
			*/
			lastErr = err
			continue
		}

		/*
		Validate the returned IP format
		*/
		if !isValidIPFormat(ip) {
			lastErr = fmt.Errorf("invalid IP from %s: %s", service.name, ip)
			continue
		}

		/*
		Success! Return the first valid IP we get
		*/
		return ip, nil
	}

	/*
	All services failed. Return the last error.
	*/
	if lastErr != nil {
		return "", fmt.Errorf(
			"could not detect server IP automatically: %w\n"+
				"Please check your internet connection or enter the IP manually",
			lastErr,
		)
	}

	return "", fmt.Errorf("all IP detection services failed")
}

/*
getIPFromService fetches the server IP from a single IP detection service.
Used internally by DetectServerIP.

Parameters:
  ctx - Context for request cancellation
  url - URL of the IP detection service

Returns:
  string - Detected IP address
  error - Error if request failed
*/
func getIPFromService(ctx context.Context, url string) (string, error) {
	/*
	Create HTTP request with context
	*/
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}

	/*
	Set User-Agent to avoid being blocked by some services
	*/
	req.Header.Set("User-Agent", "StellarStack Installer/1.2.0")

	/*
	Execute request with timeout
	*/
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	/*
	Read and parse response
	*/
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("service returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	ip := strings.TrimSpace(string(body))
	return ip, nil
}

/*
VerifyDomain checks if a domain resolves to the expected IP address.
DNS propagation can take time, so this function has retry capability.

Parameters:
  ctx - Context for cancellation
  domain - Domain to verify
  expectedIP - The IP address the domain should resolve to

Returns:
  *config.DNSVerifyResult - Verification result with details
*/
func VerifyDomain(ctx context.Context, domain, expectedIP string) *config.DNSVerifyResult {
	result := &config.DNSVerifyResult{
		Domain:       domain,
		ExpectedIP:   expectedIP,
		ResolvAttempts: 0,
	}

	/*
	Create a DNS resolver with custom timeout
	*/
	resolver := &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			d := net.Dialer{
				Timeout: config.DNSCheckTimeout,
			}
			return d.DialContext(ctx, network, address)
		},
	}

	/*
	Attempt DNS resolution
	*/
	ctx, cancel := context.WithTimeout(ctx, config.DNSCheckTimeout)
	defer cancel()

	ips, err := resolver.LookupHost(ctx, domain)
	result.ResolvAttempts = 1

	if err != nil {
		/*
		DNS resolution failed.
		This is common when DNS hasn't propagated yet.
		*/
		result.Error = fmt.Errorf("could not resolve domain: %w", err)
		return result
	}

	if len(ips) == 0 {
		result.Error = fmt.Errorf("domain resolved but returned no IP addresses")
		return result
	}

	/*
	Get the first resolved IP
	*/
	result.ResolvedIP = ips[0]

	/*
	Check if resolved IP matches expected IP
	*/
	if result.ResolvedIP == expectedIP {
		result.IsVerified = true
		return result
	}

	/*
	IP mismatch - domain resolves but to wrong IP
	This usually means wrong DNS record or old one hasn't expired
	*/
	result.Error = fmt.Errorf(
		"domain resolved to %s, expected %s",
		result.ResolvedIP,
		expectedIP,
	)

	return result
}

/*
isValidIPFormat does basic validation that a string looks like an IP address.
This is a quick sanity check before deeper validation.

Parameters:
  ip - String to validate

Returns:
  bool - True if looks like valid IP
*/
func isValidIPFormat(ip string) bool {
	/*
	Reject obviously invalid formats
	*/
	if ip == "" {
		return false
	}

	if strings.Count(ip, ".") != 3 && !strings.Contains(ip, ":") {
		return false
	}

	/*
	Try to parse as actual IP address
	*/
	return net.ParseIP(ip) != nil
}

/*
CheckConnectivity verifies basic internet connectivity by making
a request to a reliable external service.

Used to detect if user is offline before attempting network operations.

Parameters:
  ctx - Context for cancellation

Returns:
  bool - True if internet connectivity verified
  error - Error if check failed
*/
func CheckConnectivity(ctx context.Context) (bool, error) {
	/*
	Try to reach a highly reliable service
	*/
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "HEAD", "https://www.google.com", nil)
	if err != nil {
		return false, err
	}

	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			/*
			Don't follow redirects for this check
			*/
			return http.ErrUseLastResponse
		},
	}

	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	resp.Body.Close()

	/*
	Success if we got any response (even redirect)
	*/
	return true, nil
}

/*
GetPublicDNSServers returns a list of reliable public DNS servers
that can be used for custom DNS resolution.

Used as fallback when system DNS isn't working.

Returns:
  []string - List of public DNS server addresses
*/
func GetPublicDNSServers() []string {
	return []string{
		"8.8.8.8",           // Google
		"1.1.1.1",           // Cloudflare
		"208.67.222.222",    // OpenDNS
		"9.9.9.9",           // Quad9
	}
}
