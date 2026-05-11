---
title: A desktop client that runs the whole stack
description: The full StellarStack panel, API, and daemon in a single download. Click install, click a button, you're hosting. No Docker tutorials, no docker-compose, no Postgres setup.
date: 2026-05-11
author: Marques
tags: announcement
---

![StellarStack desktop](/blog/desktop.png)

Self-hosting is great if you already know what a reverse proxy is. If you don't, the gap between "I want to run a Minecraft server for me and my friends" and "I have a panel I can actually use" is huge — install Docker, learn `docker-compose`, set up Postgres, point a Caddy at it, pull the daemon, pair it, hope nothing in your `/etc/hosts` got weird.

That's not a fair ask for someone who just wants a server.

So we built a desktop client.

# One download. The whole stack.

The StellarStack desktop app is a single installer for macOS, Windows, and Linux. Inside it ships the panel UI, the API, and the daemon — the same code we ship to operators running clusters of nodes — bundled together and pointed at each other so they Just Work.

On first launch the app:

1. Detects every Docker runtime on your system (Docker Desktop, Colima, OrbStack, Rancher Desktop, Podman) and lets you pick one — same dropdown style as JetBrains IDEs, so if you've got multiple installed we figure it out and you click which one to use.
2. Spins up two managed containers — Postgres and Redis — on isolated ports so they don't fight whatever else you've got running locally.
3. Migrates the schema, seeds the full blueprint catalog, and asks you for an email + password.
4. Drops you into the panel, already signed in.

Total time from "downloaded the installer" to "Minecraft server installing" is under two minutes on a fresh machine. There is no docker-compose file. There is no .env. There is no Caddy.

# It survives a reboot

The containers we start are `restart unless-stopped`. The daemon and API are sidecar processes the desktop app launches and supervises. When you close the app the game servers keep running; when you reopen it, it reconciles state from Docker — if the JVM is still up, the panel comes up showing "running" with the existing console history. Nothing to babysit.

If Docker isn't running, you get a clear setup screen with a "Start Docker" button and live logs. If Docker is fine, the setup screen never appears — second-and-onward launches go straight to the panel.

# The same panel, native

The panel that ships in the desktop app is the *exact* same React app we ship to hosted operators. Same schedules, same file manager, same crash reports, same SFTP. The browser dials the local daemon directly over a single WebSocket per server, so console input is single-RTT and stats are real-time even on a 100ms-CPU laptop. The traffic lights sit inside the window chrome — no extra menu bar, no decorative title strip eating vertical space.

We have to ship a desktop app sometimes. We're aware of the irony.

# Who this is for

This isn't a replacement for the server build. If you're running multiple nodes, hosting players, or want public access, you should still install the daemon on a Linux box behind a reverse proxy and point the panel at it.

The desktop app is for the case where:

- You and a handful of friends want a Minecraft (or any other game we support) server, on the spare laptop, without learning DevOps.
- You're testing blueprints locally before pushing them to production nodes.
- You want a panel that runs on your work machine for prototyping schedules.

If that's you, grab the latest build from the [downloads page](#/downloads). It's free, MIT-licensed, exactly the same code as the open-source self-host path — just packaged so you don't have to think about how it fits together.

— Marques
