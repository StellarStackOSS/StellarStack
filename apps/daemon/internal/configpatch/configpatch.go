// Package configpatch applies blueprint config-file patches (e.g. patching
// server-port into server.properties) before each server start.
package configpatch

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// Spec describes one file the daemon should patch.
type Spec struct {
	Path    string            `json:"path"`
	Parser  string            `json:"parser"`
	Patches map[string]string `json:"patches"`
}

// Apply patches all config files relative to serverDir, substituting
// {{VARIABLE}} in patch values (and in the path itself) from env first.
func Apply(serverDir string, specs []Spec, env map[string]string) {
	for _, spec := range specs {
		resolvedPath := SubstituteVars(spec.Path, env)
		fullPath := serverDir + "/" + resolvedPath

		targets := make(map[string]string, len(spec.Patches))
		for k, v := range spec.Patches {
			targets[k] = SubstituteVars(v, env)
		}

		switch spec.Parser {
		case "properties":
			applyProperties(fullPath, targets)
		case "yaml", "yml":
			applyYAML(fullPath, targets)
		case "json":
			applyJSON(fullPath, targets)
		}
		// xml, toml, ini — future parsers; silently skip for now
	}
}

// SubstituteVars replaces every {{KEY}} in s with the corresponding value from
// env. Segments wrapped in [[...]] are protected and never substituted.
func SubstituteVars(s string, env map[string]string) string {
	return substituteVars(s, env)
}

var protectedRE = regexp.MustCompile(`\[\[.*?\]\]`)

func substituteVars(s string, env map[string]string) string {
	// Normalise {{VAR}} → ${VAR}
	s = strings.ReplaceAll(s, "{{", "${")
	s = strings.ReplaceAll(s, "}}", "}")

	// Extract protected segments so they survive substitution intact.
	segments := protectedRE.FindAllString(s, -1)
	for i, seg := range segments {
		s = strings.Replace(s, seg, fmt.Sprintf("__PROTECTED_%d__", i), 1)
	}

	for k, v := range env {
		s = strings.ReplaceAll(s, "${"+k+"}", v)
	}

	// Restore protected segments.
	for i, seg := range segments {
		s = strings.Replace(s, fmt.Sprintf("__PROTECTED_%d__", i), seg, 1)
	}

	// Strip the [[...]] delimiters now that substitution is done.
	s = strings.ReplaceAll(s, "[[", "")
	s = strings.ReplaceAll(s, "]]", "")

	return s
}

// ---------------------------------------------------------------------------
// Properties parser
// ---------------------------------------------------------------------------

func applyProperties(fullPath string, targets map[string]string) {
	var lines []string
	if data, err := os.ReadFile(fullPath); err == nil {
		scanner := bufio.NewScanner(strings.NewReader(string(data)))
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
	}

	satisfied := make(map[string]bool)
	out := make([]string, 0, len(lines)+len(targets))

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") || strings.HasPrefix(trimmed, "!") {
			out = append(out, line)
			continue
		}
		sep := strings.IndexAny(trimmed, "=:")
		if sep < 0 {
			out = append(out, line)
			continue
		}
		key := strings.TrimSpace(trimmed[:sep])
		if val, ok := targets[key]; ok {
			out = append(out, key+"="+val)
			satisfied[key] = true
		} else {
			out = append(out, line)
		}
	}

	for k, v := range targets {
		if !satisfied[k] {
			out = append(out, k+"="+v)
		}
	}

	_ = os.WriteFile(fullPath, []byte(strings.Join(out, "\n")+"\n"), 0o644)
}

// ---------------------------------------------------------------------------
// YAML parser
// ---------------------------------------------------------------------------

func applyYAML(fullPath string, targets map[string]string) {
	data, err := os.ReadFile(fullPath)
	if err != nil {
		data = []byte{}
	}

	var root map[string]any
	if err := yaml.Unmarshal(data, &root); err != nil || root == nil {
		root = map[string]any{}
	}

	for dotPath, value := range targets {
		setNested(root, strings.Split(dotPath, "."), coerceValue(value))
	}

	out, err := yaml.Marshal(root)
	if err != nil {
		return
	}
	_ = os.WriteFile(fullPath, out, 0o644)
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

func applyJSON(fullPath string, targets map[string]string) {
	data, err := os.ReadFile(fullPath)
	if err != nil {
		data = []byte("{}")
	}

	var root map[string]any
	if err := json.Unmarshal(data, &root); err != nil || root == nil {
		root = map[string]any{}
	}

	for dotPath, value := range targets {
		setNested(root, strings.Split(dotPath, "."), coerceValue(value))
	}

	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(fullPath, append(out, '\n'), 0o644)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// setNested navigates (and creates) nested maps following the key path, then
// sets the leaf to value.
func setNested(m map[string]any, keys []string, value any) {
	if len(keys) == 0 {
		return
	}
	if len(keys) == 1 {
		m[keys[0]] = value
		return
	}
	child, ok := m[keys[0]].(map[string]any)
	if !ok {
		child = map[string]any{}
		m[keys[0]] = child
	}
	setNested(child, keys[1:], value)
}

// coerceValue tries to parse the string as a bool or number so that JSON/YAML
// files don't get string values where native types are expected.
func coerceValue(s string) any {
	switch strings.ToLower(s) {
	case "true":
		return true
	case "false":
		return false
	}
	// Try integer
	var i int64
	if _, err := fmt.Sscan(s, &i); err == nil && fmt.Sprint(i) == s {
		return i
	}
	// Try float
	var f float64
	if _, err := fmt.Sscan(s, &f); err == nil {
		return f
	}
	return s
}
