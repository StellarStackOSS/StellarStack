#!/bin/bash

# Script to rewrite git history with conventional commit messages
# Uses git-filter-repo for reliable rewriting

set -e

MAPPINGS_FILE="commit-mappings.txt"

if [ ! -f "$MAPPINGS_FILE" ]; then
  echo "❌ Error: $MAPPINGS_FILE not found!"
  echo "Run categorize-commits.sh first"
  exit 1
fi

echo "🔍 Rewriting git history with conventional commit messages..."
echo ""
echo "⚠️  WARNING: This will rewrite ALL commit SHAs"
echo "⚠️  Backup branch 'backup/pre-cleanup-$(date +%Y%m%d)' should exist"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# Check if git-filter-repo is installed
if ! command -v git-filter-repo &> /dev/null; then
  echo "📦 Installing git-filter-repo..."
  pip install git-filter-repo || {
    echo "❌ Failed to install git-filter-repo"
    echo "Please install manually: pip install git-filter-repo"
    exit 1
  }
fi

# Create message replacement file for git-filter-repo
# Format: old message==>new message
echo "📝 Preparing message replacements..."
REPLACEMENTS_FILE=".git-filter-repo-replacements.txt"

while IFS='|' read -r sha new_message; do
  # Skip comments and empty lines
  [[ "$sha" =~ ^#.*$ ]] && continue
  [[ -z "$sha" ]] && continue

  # Get old message for this SHA (before rewrite)
  old_message=$(git log --format=%B -n 1 "$sha" 2>/dev/null | head -1 || echo "")

  if [ -n "$old_message" ]; then
    # Escape special characters
    old_escaped=$(echo "$old_message" | sed 's/[]\/$*.^[]/\\&/g')
    new_escaped=$(echo "$new_message" | sed 's/[]\/$*.^[]/\\&/g')
    echo "literal:${old_message}==>${new_message}" >> "$REPLACEMENTS_FILE"
  fi
done < "$MAPPINGS_FILE"

echo "🚀 Starting history rewrite..."
echo "   This may take several minutes for 125 commits..."

# Use git-filter-repo to rewrite messages
git-filter-repo --replace-message "$REPLACEMENTS_FILE" --force

# Clean up
rm -f "$REPLACEMENTS_FILE"

echo ""
echo "✅ History rewrite complete!"
echo ""
echo "📊 Verification:"
git log --oneline | head -10
echo ""
echo "Next steps:"
echo "1. Review the full history: git log --oneline"
echo "2. Verify commits: git log --format='%s' | grep -vE '^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert):'"
echo "3. Force push to remote: git push origin master --force-with-lease"
echo ""
echo "⚠️  Remember: All team members must fetch and reset after force push!"
