# StellarStack Scripts

Helper scripts for managing and validating StellarStack configurations.

## validate-startup-patterns.js

Validates Pterodactyl egg startup patterns through the StellarStack transformation pipeline. This script helps verify that startup detection patterns will work correctly when imported.

### Usage

```bash
# From the root of the repository
pnpm validate-egg <path-to-egg.json>

# Or directly with node
node scripts/validate-startup-patterns.js <path-to-egg.json>
```

### Examples

```bash
# Validate a test egg
pnpm validate-egg test-eggs/minecraft-vanilla.json

# Validate a Pterodactyl egg from another location
pnpm validate-egg ~/pterodactyl-eggs/minecraft-vanilla.json

# Validate all eggs in a directory
for egg in eggs/*.json; do
  pnpm validate-egg "$egg"
done
```

### What It Shows

The script shows the complete transformation pipeline of startup patterns:

1. **Pterodactyl Input Format**: How the pattern appears in the original Pterodactyl egg
   - Format: `{ "done": ["pattern1", "pattern2"] }`

2. **StellarStack Blueprint Storage**: How the pattern is stored in the StellarStack database
   - Format: `["pattern1", "pattern2"]`

3. **Daemon Request Format**: What the daemon receives when a server is created
   - Format: `["pattern1", "pattern2"]` (array of strings)

4. **Daemon Processing**: How the daemon handles the patterns
   - Attempts to compile as regex
   - Falls back to literal string matching if regex fails
   - Watches console output for matches

5. **Export Back to Pterodactyl**: How the pattern would be exported if you re-export the blueprint as an egg
   - Format: `{ "done": ["pattern1", "pattern2"], "user_interaction": [] }`

### Validation Checks

The script performs several validations:

- ✓ Has valid JSON format
- ✓ Has startup config section
- ✓ Has "done" patterns defined
- ✓ Patterns are non-empty strings
- ✓ Patterns are valid as regex (or notes which ones will use literal matching)

### Examples Output

#### ✅ Successful Import

```
✅ All checks passed - egg should import correctly
```

#### ⚠️ With Issues

```
⚠️  No 'done' patterns found - server will be marked as RUNNING immediately
```

This means the egg doesn't have startup detection patterns defined. When the server starts, it will be marked as "RUNNING" immediately without waiting for any specific output.

### Real-World Example

For a Minecraft server egg with pattern `)! For help, type`:

```
1️⃣  Pterodactyl Input Format
   { "done": [")! For help, type"] }

2️⃣  StellarStack Blueprint Storage
   [")! For help, type"]

3️⃣  Daemon Request Format
   [")! For help, type"]

4️⃣  Pattern Compilation
   ⚠️  Falls back to literal match: )! For help, type

5️⃣  Export Back to Pterodactyl
   { "done": [")! For help, type"], "user_interaction": [] }
```

The pattern `")! For help, type"` contains special regex characters (`)`), so the daemon will use literal string matching instead of regex. It will look for exactly that string in the console output.

## File Structure

```
scripts/
├── validate-startup-patterns.js    # Main validation script
├── validate-startup-patterns.ts    # TypeScript version (for development)
├── validate-startup-patterns.sh    # Bash version (requires jq)
└── README.md                       # This file
```

### Platform Support

- **JavaScript version** (recommended): Works on Windows, macOS, and Linux with Node.js
- **TypeScript version**: Requires `tsx` to be installed
- **Bash version**: Requires `jq` for JSON parsing (Linux/macOS)
