package server

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// applyConfigFiles walks the blueprint's configFiles and patches each
// one in place under the bind-mount root. Mirrors the upstream
// daemon's pre-start "config files" step: supports {{ENV_VAR}}
// substitution and per-parser key paths.
//
// Today only the `properties` parser is implemented (covers Minecraft
// server.properties — the most common case). Other parsers no-op
// with a warning so a missing patcher doesn't block a start.
func (s *Server) applyConfigFiles(bindMount string, env map[string]string) {
	cfg := s.Config()
	for _, f := range cfg.ConfigFiles {
		abs := filepath.Join(bindMount, f.Path)
		patched := substituteVars(f.Patches, env)
		switch f.Parser {
		case "properties":
			if err := patchPropertiesFile(abs, patched); err != nil {
				s.publishDaemon(
					fmt.Sprintf("Couldn't patch %s: %v", f.Path, err),
				)
			} else {
				log.Printf("server %s: patched %s (%d keys)", s.uuid, f.Path, len(patched))
			}
		default:
			log.Printf("server %s: configFiles parser %q not implemented yet, skipping %s", s.uuid, f.Parser, f.Path)
		}
	}
}

var varRE = regexp.MustCompile(`\{\{\s*([A-Z0-9_]+)\s*\}\}`)

func substituteVars(in map[string]string, env map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = varRE.ReplaceAllStringFunc(v, func(m string) string {
			name := varRE.FindStringSubmatch(m)[1]
			if val, ok := env[name]; ok {
				return val
			}
			return m
		})
	}
	return out
}

func patchPropertiesFile(path string, patches map[string]string) error {
	if len(patches) == 0 {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	body, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	lines := strings.Split(string(body), "\n")
	seen := map[string]bool{}
	for i, raw := range lines {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		eq := strings.IndexAny(raw, "=:")
		if eq < 0 {
			continue
		}
		key := strings.TrimSpace(raw[:eq])
		if val, ok := patches[key]; ok {
			lines[i] = key + "=" + val
			seen[key] = true
		}
	}
	for k, v := range patches {
		if seen[k] {
			continue
		}
		lines = append(lines, k+"="+v)
	}
	out := strings.Join(lines, "\n")
	if !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	return os.WriteFile(path, []byte(out), 0o644)
}
