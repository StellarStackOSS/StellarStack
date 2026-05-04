# StellarStack Planets

Container image definitions ("planets") for the StellarStack panel — the
replacement for Pterodactyl's eggs / yolks. Each subdirectory holds one
runtime environment, with a `Dockerfile` and (where applicable) an
`entrypoint.sh` and any helper files.

## Layout

```
games/      Game-specific images (Hytale, Rust, Source-engine, …)
go/         Go runtime, one tag per minor version
installers/ Base install-stage images
java/       OpenJDK + OpenJ9 variants, one tag per major version
nodejs/     Node.js LTS / current images
oses/       Vanilla OS bases
python/     CPython images
```

## Built images

There's one workflow per category (`java`, `go`, `nodejs`, `python`,
`oses`, `installers`, `games`), each scoped to its own subtree via a
`paths:` filter — so editing a Dockerfile under `python/` only triggers
`python.yml`, etc. Every workflow can also be run manually
(`workflow_dispatch`) and re-runs once a month on a cron. All planets
are built for **`linux/amd64`** and **`linux/arm64`** except
Source/Rust (amd64-only — they need :i386 packages that aren't in the
arm64 Debian archives) and pushed to GitHub Container Registry as a
single package (`planets`) with one tag per planet. The tag is the
directory path with `/` → `_`:

```
ghcr.io/stellarstackoss/planets:<category>_<variant>
ghcr.io/stellarstackoss/planets:<category>_<variant>-<short-sha>
```

Examples:

```
ghcr.io/stellarstackoss/planets:java_25
ghcr.io/stellarstackoss/planets:games_rust
ghcr.io/stellarstackoss/planets:nodejs_20
ghcr.io/stellarstackoss/planets:python_3.10
```

### Cross-planet dependencies

`games/hytale` `FROM`s `planets:java_25`, so it's defined as a
follow-up job inside `java.yml` (`needs: java`). That guarantees
`java_25` is published before hytale's build pulls it as a parent
image, so a cold rebuild always succeeds in a single workflow run.
