#!/bin/bash

# Script to categorize commit messages into conventional commit format
# Reads commit-analysis.csv and generates commit-mappings.txt

set -e

INPUT_FILE="commit-analysis.csv"
OUTPUT_FILE="commit-mappings.txt"

echo "# Commit Mappings for Conventional Commits Rewrite" > "$OUTPUT_FILE"
echo "# Format: SHA|new_message" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

while IFS='|' read -r sha message author email date; do
  # Skip empty lines
  [[ -z "$sha" ]] && continue

  new_message=""

  # Categorization logic based on message patterns
  case "$message" in
    "init")
      new_message="chore: initialize project structure"
      ;;
    *"Added Docker build action"*)
      new_message="ci: add Docker build GitHub Actions workflow"
      ;;
    *"SFTP implementation"*)
      new_message="feat: implement SFTP file transfer support"
      ;;
    *"Added a new script for creating and setting up stack"*)
      new_message="feat: add Ubuntu installation and setup script"
      ;;
    *"Added support for upload providers"*)
      new_message="feat: add support for file upload providers"
      ;;
    *"minor fixes to the daemon"*)
      new_message="fix: resolve daemon issues and improve stability"
      ;;
    *"Implemented other pages"*)
      new_message="feat: implement additional web panel pages"
      ;;
    *"migrated to prisma v7"*)
      new_message="build: migrate to Prisma v7"
      ;;
    *"downgraded to v6 prisma"*)
      new_message="build: downgrade to Prisma v6 for stability"
      ;;
    *"fixes made to Dockerfile"*)
      new_message="ci: fix Dockerfile configuration"
      ;;
    *"minor tweaks"*)
      new_message="chore: minor adjustments and improvements"
      ;;
    *"Fix compiling"* | *"fix compilation"*)
      new_message="fix: resolve compilation errors"
      ;;
    *"Removed unneeded pipelines"*)
      new_message="ci: remove unused pipeline configurations"
      ;;
    *"setup all docker init items"*)
      new_message="ci: setup Docker deployment infrastructure"
      ;;
    *"Added Server Transfer"*)
      new_message="feat: add server transfer functionality"
      ;;
    *"Added Server Split"*)
      new_message="feat: add server split/partition feature"
      ;;
    *"Added Server Schedules"*)
      new_message="feat: add server scheduling system"
      ;;
    *"Added firewall"*)
      new_message="feat: add firewall rules management"
      ;;
    *"Added custom startup commands"*)
      new_message="feat: add custom startup command support"
      ;;
    *"Added Cloudflare DNS"*)
      new_message="feat: add Cloudflare DNS integration"
      ;;
    *"Added ip/port allocation"*)
      new_message="feat: add IP and port allocation management"
      ;;
    *"Updated README"* | *"Update README"*)
      new_message="docs: update README documentation"
      ;;
    *"Update"* | *"update"*)
      new_message="chore: general updates and improvements"
      ;;
    *"Remove"* | *"remove"* | *"Removed"*)
      new_message="chore: remove unused code and configurations"
      ;;
    *"Added"* | *"added"* | *"Add"* | *"add"*)
      # Generic "added" messages - mark for manual review
      new_message="feat: add new features and functionality"
      ;;
    *"Fix"* | *"fix"*)
      new_message="fix: resolve bugs and issues"
      ;;
    *"Refactor"* | *"refactor"*)
      new_message="refactor: code restructuring and cleanup"
      ;;
    *)
      # Unknown pattern - use chore as default
      new_message="chore: ${message:0:60}"
      ;;
  esac

  echo "$sha|$new_message" >> "$OUTPUT_FILE"

done < "$INPUT_FILE"

echo "✅ Commit mappings generated in $OUTPUT_FILE"
echo "📝 Please review and adjust before running rebase"
echo ""
echo "Total commits to rewrite: $(wc -l < "$OUTPUT_FILE" | tr -d ' ')"
