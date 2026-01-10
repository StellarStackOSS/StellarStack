#!/bin/bash

# Script to rewrite git history using native git filter-branch
# This approach works without requiring Python/git-filter-repo

set -e

MAPPINGS_FILE="commit-mappings.txt"

if [ ! -f "$MAPPINGS_FILE" ]; then
  echo "❌ Error: $MAPPINGS_FILE not found!"
  exit 1
fi

echo "🔍 Rewriting git history with conventional commit messages..."
echo "⚠️  This will rewrite ALL commit SHAs"
echo ""

# Load all mappings into an associative array for fast lookup
declare -A commit_map

echo "📝 Loading commit mappings..."
while IFS='|' read -r sha new_message; do
  # Skip comments and empty lines
  [[ "$sha" =~ ^#.*$ ]] && continue
  [[ -z "$sha" ]] && continue

  commit_map["$sha"]="$new_message"
done < "$MAPPINGS_FILE"

echo "✅ Loaded ${#commit_map[@]} commit mappings"
echo ""
echo "🚀 Starting history rewrite (this takes 5-10 minutes)..."
echo ""

# Export the mapping for use in filter-branch subshell
export COMMIT_MAP_FILE=$(mktemp)
for sha in "${!commit_map[@]}"; do
  echo "$sha|${commit_map[$sha]}" >> "$COMMIT_MAP_FILE"
done

# Use filter-branch to rewrite commit messages
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter '
  OLD_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")
  if [ -n "$OLD_SHA" ]; then
    NEW_MSG=$(grep "^${OLD_SHA}|" "$COMMIT_MAP_FILE" | cut -d"|" -f2- || echo "")
    if [ -n "$NEW_MSG" ]; then
      echo "$NEW_MSG"
    else
      cat
    fi
  else
    cat
  fi
' -- --all

# Clean up
rm -f "$COMMIT_MAP_FILE"

# Remove backup refs created by filter-branch
git for-each-ref --format="%(refname)" refs/original/ | xargs -r git update-ref -d

echo ""
echo "✅ History rewrite complete!"
echo ""
echo "📊 Sample of rewritten commits:"
git log --oneline --format="%s" | head -20
echo ""
