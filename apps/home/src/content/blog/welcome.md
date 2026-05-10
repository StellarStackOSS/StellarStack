---
title: Introducing StellarStack V2
description: A complete rewrite of the daemon, a brand new schedule editor, and a panel that's finally fast on mobile. Free to self-host today; hosted later.
date: 2026-05-10
author: Marques
tags: announcement
---

It's been an exciting couple of months since migrating our stack over from rust over to Go,
with the intentions of never returning 🥳. The feedback from our community has been incredible, and your requests for new features have not gone unnoticed.

The team has been working hard on improving the stability and performance of StellarStack. So what's new with StellarStack V2?

# New Schedule Flows

![Schedule flow editor](/blog/schedule.gif)

The schedule flow have been worked from the ground up to be more intuitive and easier to use. We've also added support for custom schedules, allowing you to create your own schedule that fits your needs.

Instead of a flat list of "tasks with delays", every schedule is now a typed graph. There are three node kinds:

- **Triggers** — the cron entry point.
- **Actions** — start, stop, restart, kill, take a backup, send a console command.
- **Waits** — block until the server is online, until a backup completes, or for a fixed delay.

The big win is real wait gates. The classic "back up the server every night" used to be a sequence of guesses — *stop, sleep 90 seconds, backup, sleep 30 minutes, start.* Now you say what you actually mean:

```
Stop → Wait until offline → Create backup → Wait until backup complete → Start → Wait until online → "say backup complete"
```

The runner blocks on real signals — the daemon's lifecycle state, the backup's row state — with a per-step timeout that the editor exposes in the inspector. No more racing the wall clock.

# A new daemon, in Go

The bit you don't see, but feel. The daemon — the agent that runs on every node and owns Docker — is a clean-room rewrite in Go. It owns the synchronous power chain (`Stop` blocks on `WaitForStop`, `Restart` is one locked sequence end-to-end), and your browser dials it **directly** for console, stats, and SFTP. No panel middleman to bottleneck.

That last point matters more than it sounds. Typing in a Minecraft console is single-RTT now. SFTP uploads of a 4 GB world don't hit the panel at all. Multi-region nodes have local-feeling latency for the people connected to them.

# Self-host first

StellarStack V2 is **free to self-host today** — the panel and the daemon are MIT-licensed, you own the boxes, you own the data.

That's where all our energy is right now. We want the self-host experience to feel finished — installer, blueprints, backups, schedules, audit log, all of it — before we even think about charging anyone for hosting.

So to be straight: **we are not hosting servers right now.** A managed Cloud option (and a fully-managed Cloud + Hardware tier in five regions, with EPYC / 7950X bare-metal, 128 GB DDR5, NVMe SSD, 10 Gbit uplink, L3–L7 DDoS) is on the [pricing](#pricing) section as the roadmap, but it's not open. When it is, we'll email the waitlist first.

# A panel that works on your phone

Half of the requests we got last quarter were "please fix mobile". Done. The whole panel — console, file manager, schedules, backups — now works from a phone browser without zooming or scrolling sideways.

The marketing site got the same pass: hamburger nav, full layout reflow, the waitlist form is a single tap away from any page.

# What's next

A lot. The [public roadmap](#/roadmap) is the source of truth, but the headline items in flight:

- **Database hosting** — spin up Postgres, MySQL, or Mongo containers per node and attach them to game servers in one click.
- **Plugin marketplace** — community-curated blueprints, plugins, and config bundles.
- **Crash fingerprinting** — hash + anonymise stack traces, cross-reference fixes that worked for other operators.

We'll write more here as those land. In the meantime, grab the panel + daemon and run it yourself — and [join the waitlist](#waitlist) so we can email you the day hosted signups open.

— Marques


