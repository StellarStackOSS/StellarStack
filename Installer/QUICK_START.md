# Quick Start Guide - StellarStack Installer

## 🎯 Choose Your Platform

### Windows

```powershell
# Download or build
.\installer-windows-x86_64.exe

# Show help
.\installer-windows-x86_64.exe --help

# Run installation
.\installer-windows-x86_64.exe

# Test in debug mode (no actual changes)
.\installer-windows-x86_64.exe --debug
```

**Requirements:**

- Windows 10/11 Pro, Enterprise, or Server 2019+
- Docker Desktop with WSL2 or Hyper-V
- PowerShell 5.1+
- 4GB+ RAM recommended

**Install Location:**

```
C:\ProgramData\StellarStack\
```

---

### macOS

#### Intel Macs (x86_64)

```bash
# Download or build
chmod +x installer-macos-x86_64
./installer-macos-x86_64 --help
./installer-macos-x86_64
./installer-macos-x86_64 --debug
```

#### Apple Silicon (ARM64)

```bash
# Download or build
chmod +x installer-macos-arm64
./installer-macos-arm64 --help
./installer-macos-arm64
./installer-macos-arm64 --debug
```

**Requirements:**

- macOS 11 (Big Sur) or later
- Docker Desktop for macOS
- Homebrew (recommended)
- 4GB+ RAM

**Install Location:**

```
/opt/stellarstack/
```

---

### Linux

#### Standard x86_64 (Intel/AMD)

```bash
# Download or build
chmod +x installer-linux-x86_64
./installer-linux-x86_64 --help
./installer-linux-x86_64
./installer-linux-x86_64 --debug
```

#### ARM64 (Raspberry Pi 4+, AWS Graviton, etc.)

```bash
# Download or build
chmod +x installer-linux-arm64
./installer-linux-arm64 --help
./installer-linux-arm64
./installer-linux-arm64 --debug
```

**Supported Distributions:**

- Ubuntu 20.04+
- Debian 11+
- RHEL 8+
- CentOS 8+
- Any Linux with Docker support

**Requirements:**

- Docker Engine and Docker Compose
- 2GB+ RAM (4GB+ recommended)
- 20GB+ disk space
- Linux kernel 4.15+

**Install Location:**

```
/opt/stellarstack/
```

---

## 🚀 Installation Flow

### Step 1: Welcome Screen

```
╔══════════════════════════════════════════════════╗
║         StellarStack Installer                  ║
║         Version: 1.2.0                          ║
║         Built: 2026-01-17                       ║
║         Platform: macOS (ARM64)                 ║
╚══════════════════════════════════════════════════╝

Welcome to the StellarStack Installer!
This interactive installer will guide you through the setup.

Press [ENTER] to begin...
```

### Step 2: System Requirements Check

- Verifies Docker availability
- Checks for required dependencies
- Shows platform-specific requirements

### Step 3: Installation Type Selection

```
[1] Panel + API      - Complete control panel with backend (recommended)
[2] Panel Only       - Web interface only
[3] API Only         - Backend API server only
[4] Daemon           - Game server management daemon
[5] All-in-One       - Panel + API + Daemon + monitoring
```

### Step 4: Server IP Configuration

```
Enter your server's public IP address
(This is the IP your domains will point to)

Enter server IP: 203.0.113.42
```

### Step 5: Domain Configuration

```
Panel Domain Configuration
Enter your panel domain (e.g., panel.example.com): panel.example.com

API Domain Configuration (if applicable)
Enter your API domain (e.g., api.example.com): api.example.com
```

### Step 6: Admin Credentials

```
Create Admin Account
Enter admin email address: admin@example.com
```

### Step 7: Optional Monitoring Stack

```
Optional: Monitoring Stack
Install Prometheus, Loki, and Grafana for observability?
(Recommended for production deployments)

Install monitoring stack [y/n]: y
```

### Step 8: Configuration Summary

Review all settings and confirm:

```
Configuration Summary
════════════════════════════════════════════════════
Installation Type: panel_and_api
Server IP: 203.0.113.42
Panel Domain: panel.example.com
API Domain: api.example.com

Proceed with installation [y/n]: y
```

### Step 9: Installation Progress

Watch the progress bar as the installer:

- Creates Docker networks
- Pulls container images
- Generates configuration files
- Starts containers
- Runs health checks

### Step 10: Completion

```
═══════════════════════════════════════════════════════
INSTALLATION COMPLETE!
═══════════════════════════════════════════════════════

Type: panel_and_api
Server IP: 203.0.113.42
Panel Domain: panel.example.com

Next steps:
1. Configure your DNS records
2. Access your installation
3. Start managing your servers

Press [q] to exit
```

---

## 🐛 Debug Mode

Test the entire installation flow without making any changes:

```bash
# macOS
./installer-macos-arm64 --debug

# Linux
./installer-linux-x86_64 --debug

# Windows
.\installer-windows-x86_64.exe --debug
```

**What happens in debug mode:**

- Shows all screens and prompts
- Simulates operations (doesn't execute them)
- No files are created
- No Docker containers are started
- No actual installation happens
- Perfect for testing and validation

---

## 📋 System Requirements Checklist

### All Platforms

- [ ] Docker installed and running
- [ ] Docker Compose available
- [ ] 2GB+ RAM (4GB+ recommended)
- [ ] 20GB+ disk space
- [ ] Internet connectivity
- [ ] Valid domain name(s)

### Windows Additional

- [ ] Windows 10/11 Pro or Enterprise
- [ ] WSL2 or Hyper-V enabled
- [ ] Docker Desktop running
- [ ] Administrator privileges

### macOS Additional

- [ ] macOS 11 or later
- [ ] Docker Desktop running
- [ ] Homebrew (recommended)

### Linux Additional

- [ ] Supported distribution (Ubuntu, Debian, RHEL, CentOS)
- [ ] Kernel 4.15+
- [ ] User in `docker` group (or `sudo` access)

---

## ✅ Verification Commands

After installation, verify everything is working:

```bash
# Check if containers are running
docker compose -f /opt/stellarstack/docker-compose.yml ps

# View installation directory
ls -la /opt/stellarstack/

# Check configuration
cat /opt/stellarstack/.env

# View Docker networks
docker network ls | grep stellar
```

---

## 🔗 Important Files

After installation:

- **Configuration:** `/opt/stellarstack/.env` (Windows: `C:\ProgramData\StellarStack\.env`)
- **Compose File:** `/opt/stellarstack/docker-compose.yml`
- **Backups:** `/opt/stellarstack/.backup/YYYY-MM-DD-HH-MM-SS/`
- **Logs:** `docker logs <container-name>`

---

## 🆘 Troubleshooting

### "Docker daemon is not running"

```bash
# Linux
sudo systemctl start docker

# macOS
# Start Docker Desktop application

# Windows
# Start Docker Desktop from Start menu
```

### "DNS verification failed"

- Ensure DNS A record points to server IP
- Wait for DNS propagation (5-15 minutes)
- Retry after creating the DNS record

### "Permission denied" (Linux)

```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Port already in use

- Check for existing installations
- Change ports in `.env` file
- Restart containers with `docker compose restart`

---

## 📚 More Information

For detailed information, see:

- [`CROSS_PLATFORM_BUILD.md`](CROSS_PLATFORM_BUILD.md) - Building from source
- [`CROSS_PLATFORM_COMPLETE.md`](CROSS_PLATFORM_COMPLETE.md) - Full implementation details
- [`README.md`](README.md) - Architecture and features

---

## 🎓 Command Reference

### Common Commands

```bash
# Show version
installer --version

# Show help
installer --help

# Run interactive installation
installer

# Test without making changes
installer --debug
```

### Platform Detection

The installer automatically detects your platform and shows:

- Operating System (Windows, macOS, Linux)
- Architecture (x86_64, ARM64, ARM32)
- Installer Version
- Build Date

---

## 🚀 Getting Started

**1. Download the appropriate binary for your platform**

**2. Make it executable (macOS/Linux)**

```bash
chmod +x installer-linux-x86_64
```

**3. Run the installer**

```bash
./installer-linux-x86_64
```

**4. Follow the interactive prompts**

**5. Wait for installation to complete**

**6. Access your installation**

```
https://panel.example.com
```

---

## 💡 Pro Tips

- Use **debug mode** first to test the flow
- Prepare your **domain names** before installing
- Have your **DNS provider** settings ready
- Consider enabling **monitoring** for production
- **Backup** existing installations before updating
- Use **descriptive names** for domains (e.g., panel.company.com)

---

**Version:** 1.2.0
**Last Updated:** 2026-01-17
**Status:** Production Ready ✅
