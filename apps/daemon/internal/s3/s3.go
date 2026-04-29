// Package s3 is a tiny SigV4-signing PUT/DELETE client. Used by the
// daemon to push backup archives directly to an S3-compatible bucket
// (S3, R2, B2, MinIO) without pulling in the full AWS SDK.
//
// Only PutObject (streaming a file) and DeleteObject are implemented —
// that's the entire backup-side surface.
package s3

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// Config describes the S3-compatible target.
type Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	ForcePathStyle  bool
}

// PutObject streams `body` to s3://bucket/key. `body` must satisfy
// io.Reader and `size` must be the exact content-length (S3 requires it
// for unsigned-payload requests). `sha256Hex` is the lower-case hex
// SHA256 of the bytes; pass `UNSIGNED-PAYLOAD` to skip the integrity
// check (handy for very large streams where computing the hash twice is
// painful — caller has already hashed once during archive creation).
func PutObject(
	ctx context.Context,
	cfg Config,
	key string,
	body io.Reader,
	size int64,
	sha256Hex string,
) error {
	endpoint := buildURL(cfg, key)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, body)
	if err != nil {
		return err
	}
	req.ContentLength = size
	req.Header.Set("Host", req.URL.Host)
	if sha256Hex == "" {
		sha256Hex = "UNSIGNED-PAYLOAD"
	}
	req.Header.Set("X-Amz-Content-Sha256", sha256Hex)
	if err := signV4(req, cfg, sha256Hex); err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("PutObject: HTTP %d %s", resp.StatusCode, string(body))
	}
	return nil
}

// DeleteObject removes s3://bucket/key. Returns nil for 404.
func DeleteObject(ctx context.Context, cfg Config, key string) error {
	endpoint := buildURL(cfg, key)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Host", req.URL.Host)
	req.Header.Set("X-Amz-Content-Sha256", emptyPayloadHash)
	if err := signV4(req, cfg, emptyPayloadHash); err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode/100 != 2 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("DeleteObject: HTTP %d %s", resp.StatusCode, string(body))
	}
	return nil
}

const emptyPayloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

func buildURL(cfg Config, key string) string {
	endpoint := strings.TrimRight(cfg.Endpoint, "/")
	if cfg.ForcePathStyle {
		return fmt.Sprintf("%s/%s/%s", endpoint, cfg.Bucket, escapeKey(key))
	}
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Host == "" {
		return fmt.Sprintf("%s/%s/%s", endpoint, cfg.Bucket, escapeKey(key))
	}
	return fmt.Sprintf("%s://%s.%s/%s", parsed.Scheme, cfg.Bucket, parsed.Host, escapeKey(key))
}

func escapeKey(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

// signV4 attaches the SigV4 Authorization header to req. Adapted from the
// official spec (https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html);
// sufficient for our PUT/DELETE.
func signV4(req *http.Request, cfg Config, payloadHash string) error {
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	req.Header.Set("X-Amz-Date", amzDate)

	canonicalHeaders, signedHeaders := canonicalHeaders(req)
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalPath(req.URL.Path),
		canonicalQuery(req.URL),
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	algorithm := "AWS4-HMAC-SHA256"
	credentialScope := strings.Join([]string{
		dateStamp, cfg.Region, "s3", "aws4_request",
	}, "/")
	stringToSign := strings.Join([]string{
		algorithm,
		amzDate,
		credentialScope,
		hashHex(canonicalRequest),
	}, "\n")

	kDate := hmacSHA256([]byte("AWS4"+cfg.SecretAccessKey), dateStamp)
	kRegion := hmacSHA256(kDate, cfg.Region)
	kService := hmacSHA256(kRegion, "s3")
	kSigning := hmacSHA256(kService, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))

	authorization := fmt.Sprintf(
		"%s Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		algorithm,
		cfg.AccessKeyID,
		credentialScope,
		signedHeaders,
		signature,
	)
	req.Header.Set("Authorization", authorization)
	return nil
}

func canonicalHeaders(req *http.Request) (string, string) {
	type pair struct {
		key   string
		value string
	}
	pairs := []pair{}
	for k, vs := range req.Header {
		key := strings.ToLower(k)
		pairs = append(pairs, pair{key: key, value: strings.TrimSpace(strings.Join(vs, ","))})
	}
	if req.Header.Get("Host") == "" {
		pairs = append(pairs, pair{key: "host", value: req.URL.Host})
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].key < pairs[j].key })
	var canonical strings.Builder
	signed := []string{}
	for _, p := range pairs {
		canonical.WriteString(p.key)
		canonical.WriteString(":")
		canonical.WriteString(p.value)
		canonical.WriteString("\n")
		signed = append(signed, p.key)
	}
	return canonical.String(), strings.Join(signed, ";")
}

func canonicalPath(path string) string {
	if path == "" {
		return "/"
	}
	parts := strings.Split(path, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

func canonicalQuery(u *url.URL) string {
	values := u.Query()
	if len(values) == 0 {
		return ""
	}
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for i, k := range keys {
		vs := values[k]
		sort.Strings(vs)
		for j, v := range vs {
			if i > 0 || j > 0 {
				b.WriteString("&")
			}
			b.WriteString(url.QueryEscape(k))
			b.WriteString("=")
			b.WriteString(url.QueryEscape(v))
		}
	}
	return b.String()
}

func hashHex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

// _silence is just to keep `bytes` imported on builds where it's
// otherwise unused in this file (used in tests).
var _silence = bytes.NewReader(nil)
