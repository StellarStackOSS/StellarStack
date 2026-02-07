# AI-Enhanced Changelog Setup Guide

This document explains how to configure the AI-Enhanced Changelog system with Ollama integration.

## Overview

The system consists of three main components:

1. **Ollama API Client** (`.github/scripts/ollama-client.sh`) - Connects to your Ollama instance
2. **PR Summary Workflow** (`.github/workflows/ai-pr-summary.yml`) - Generates summaries for pull requests
3. **Enhanced Changelog Workflow** - Modifies `release-please.yml` to use AI-generated changelog entries

## Prerequisites

### Local Setup
- **Ollama** installed and running with the `neural-chat` model
- Access to Ollama instance (local or via tunnel/VPN)

### GitHub Setup
- Repository admin or secrets management access
- GitHub token with appropriate permissions (already available via `github.token`)

## Installation

### Step 1: Deploy Ollama Locally

#### Option A: Using Ollama (Recommended)
```bash
# Download and install Ollama from https://ollama.ai

# Pull the neural-chat model (7B, optimized for summaries)
ollama pull neural-chat

# Start Ollama (it runs on port 11434 by default)
ollama serve
```

#### Option B: Docker
```bash
docker run -d -p 11434:11434 ollama/ollama
docker exec <container-id> ollama pull neural-chat
```

### Step 2: Configure Network Access

If Ollama runs on a local machine and you need GitHub Actions to access it, use one of these options:

#### Option A: ngrok (Recommended for Testing)
```bash
# Install ngrok from https://ngrok.com
ngrok http 11434

# ngrok will provide a public URL like: https://xxxx-xx-xxx-xxx-xx.ngrok.io
# Note: ngrok URLs change on restart, so this is best for testing
```

#### Option B: Cloudflare Tunnel
```bash
# Install cloudflared from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
cloudflared tunnel run

# Configure a tunnel pointing to localhost:11434
# This provides a stable URL for production
```

#### Option C: VPN/Private Network
- Set up a VPN connection between GitHub Actions and your network
- Or run Ollama on a publicly accessible server with firewall rules

### Step 3: Add GitHub Repository Secret

1. Go to your GitHub repository settings
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Create secret named: `OLLAMA_URL`
   - **Value**: Your Ollama instance URL (e.g., `http://192.168.1.100:11434` or `https://xxxx.ngrok.io`)
5. Click **Add secret**

### Step 4: Verify Setup

Test the connection by triggering workflows:

#### Test PR Summary Workflow
1. Create a test pull request
2. The `AI PR Summary` workflow should trigger automatically
3. Check the PR description for the AI-generated summary section
4. If it fails, check GitHub Actions logs for error details

#### Test Changelog Workflow
1. Create a new release (manual or via push to master with proper commits)
2. The `Release Please` workflow will run and trigger the AI changelog step
3. Check the generated CHANGELOG.md for AI-enhanced entries
4. If it fails, check GitHub Actions logs

## Configuration Options

### Environment Variables

The workflows use these environment variables:

| Variable | Source | Default | Description |
|----------|--------|---------|-------------|
| `OLLAMA_URL` | GitHub Secret | `http://localhost:11434` | URL to Ollama instance |
| `OLLAMA_MODEL` | Hardcoded | `neural-chat` | Model to use (don't change without testing) |

### Workflow Controls

#### PR Summary Workflow (`ai-pr-summary.yml`)
- **Trigger**: On PR open, synchronize, or reopen
- **Disabled for**: Draft PRs
- **Disabled if**: `OLLAMA_URL` secret not configured
- **Runs on**: `ubuntu-latest`

#### Changelog Workflow (in `release-please.yml`)
- **Trigger**: When `release_created` output is true
- **Disabled if**: `OLLAMA_URL` secret not configured
- **Max entries processed**: 20 (to avoid timeouts)
- **Timeout per request**: 2 minutes
- **Retries**: 3 attempts with exponential backoff

### Customization

#### Modify Model
To use a different Ollama model, edit the workflows:

```yaml
# In ai-pr-summary.yml
.github/scripts/ollama-client.sh "$PROMPT" "your-model-name"

# In release-please.yml (AI changelog step)
.github/scripts/ollama-client.sh "$PROMPT" "your-model-name"
```

Available models: `ollama pull <model-name>`
- `neural-chat` - Recommended (7B, chat optimized)
- `mistral` - Larger, more capable (7B)
- `llama2` - Larger context (7B)

#### Adjust AI Parameters

In `.github/scripts/ollama-client.sh`, modify the Ollama API request:

```bash
{
  "model": "$MODEL",
  "prompt": "$prompt",
  "stream": false,
  "options": {
    "temperature": 0.7,    # Lower = more focused, Higher = more creative
    "top_p": 0.9,          # Nucleus sampling, controls diversity
    "top_k": 40,           # Top-k sampling
    "num_predict": 500     # Max tokens in response
  }
}
```

## Troubleshooting

### Ollama Connection Fails

**Error**: `Cannot connect to Ollama at [URL]`

**Solutions**:
1. Verify Ollama is running: `curl http://your-ollama-url:11434/api/tags`
2. Check OLLAMA_URL secret is set correctly
3. Verify firewall/network rules allow access
4. If using ngrok, URL expires on restart - update the secret
5. Check Ollama logs for errors

### AI Summaries Not Appearing

**Issue**: Workflows complete but no AI summaries in PR/changelog

**Solutions**:
1. Check GitHub Actions logs for the specific step
2. Verify `OLLAMA_URL` secret is configured
3. Confirm Ollama instance is accessible from Actions
4. Check if neural-chat model is installed: `ollama list`
5. Look for warning messages in workflow output

### Timeout Issues

**Error**: `curl: (28) Operation timed out`

**Solutions**:
1. Ollama is slow - ensure sufficient system resources
2. Model may be too large for your system
3. Network latency - use local Ollama or closer VPN tunnel
4. Try increasing timeout in `.github/scripts/ollama-client.sh`

### Empty or Garbled AI Responses

**Issue**: AI returns empty strings or corrupted text

**Solutions**:
1. Check Ollama model is loaded: `ollama list`
2. Try loading model manually: `ollama pull neural-chat`
3. Check Ollama logs: `ollama serve` (in foreground)
4. Verify jq is available: `jq --version`
5. Try manual test: `.github/scripts/ollama-client.sh "Hello, world"`

## Fallback Behavior

When Ollama is unavailable, the system gracefully degrades:

### PR Summary Workflow
- Workflow runs but skips AI generation
- Step logs warning: "Ollama instance may be unavailable"
- No AI summary is added to PR
- PR still works normally without summary

### Changelog Workflow
- AI step is skipped if `OLLAMA_URL` is not configured
- Release-Please creates changelog as normal
- Previous commit messages are used instead of AI summaries
- System is fully functional without Ollama

## Performance Notes

### Expected Timing

- **PR Summary Generation**: 10-30 seconds per PR
- **Changelog Entry Generation**: 5-15 seconds per entry
- **Full Release Process**: 2-5 minutes (depends on commit count)

### Optimization Tips

1. **Limit Diff Size**: Currently capped at 5000 lines
2. **Limit Entries**: Changelog processing limited to 20 entries
3. **Use Local Ollama**: Network latency significantly impacts speed
4. **Monitor System Resources**: Ensure Ollama has sufficient CPU/RAM

## Security Considerations

### No Authentication Required
- Ollama API has no built-in authentication
- Security relies on network isolation:
  - Local network access only
  - VPN/tunnel for remote access
  - Firewall rules to restrict IP ranges

### Data Privacy
- Prompts are sent to Ollama instance (local or tunneled)
- Only commit messages and PR content are sent (no secrets in diffs)
- Ensure sensitive info is not in commit messages

### Best Practices
1. Run Ollama on a private network
2. Use VPN/tunnel for GitHub Actions access
3. Don't expose Ollama port directly to internet
4. Regularly update Ollama and models
5. Monitor GitHub Actions logs for suspicious activity

## Advanced Usage

### Manual Testing

Test the Ollama client script directly:

```bash
# Set Ollama URL
export OLLAMA_URL="http://localhost:11434"

# Test connection
.github/scripts/ollama-client.sh "test" neural-chat

# Test with custom prompt
PROMPT="Generate a changelog entry for: Added dark mode support"
.github/scripts/ollama-client.sh "$PROMPT" neural-chat
```

### Debugging Workflow Steps

Add debug output to workflows:

```yaml
- name: Debug AI Changelog
  run: |
    set -x  # Enable debug output
    # ... rest of step
```

### Local Development

To test locally before committing:

1. Copy `.github/scripts/ollama-client.sh` to local machine
2. Set `OLLAMA_URL` environment variable
3. Run script with test prompts
4. Verify responses are as expected

## Support and Contributions

### Issues

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review GitHub Actions logs
3. Test Ollama connection manually
4. Check Ollama logs and documentation

### Future Enhancements

Potential improvements (not currently implemented):
- Multi-model support (configurable via secret)
- Custom prompt templates
- Linear ticket integration
- Human review before publishing
- Quality scoring for AI responses
- Metrics and analytics

## References

- [Ollama Documentation](https://github.com/ollama/ollama)
- [neural-chat Model](https://ollama.ai/library/neural-chat)
- [GitHub Actions Workflows](https://docs.github.com/en/actions)
- [Release Please Action](https://github.com/googleapis/release-please)
- [ngrok Documentation](https://ngrok.com/docs)
