/**
 * A localizable string in a blueprint — either a literal string for trusted
 * authors, or a translation-key reference resolved by the consumer.
 */
export type BlueprintLocalizableText =
  | string
  | { key: string; params?: Record<string, string | number | boolean> }

/**
 * One configurable variable a blueprint exposes to operators. Validation
 * `rules` use a Laravel-style pipe DSL (`required|string|max:32`) so the
 * panel and the daemon can share parser logic.
 */
export type BlueprintVariable = {
  key: string
  name: BlueprintLocalizableText
  description?: BlueprintLocalizableText
  default: string
  userViewable: boolean
  userEditable: boolean
  rules: string
}

/**
 * A configuration file the daemon should patch on each start. `patches` is a
 * map of dotted paths (interpretation depends on `parser`) to interpolated
 * values.
 */
export type BlueprintConfigFile = {
  path: string
  parser: "properties" | "json" | "yaml" | "ini" | "toml" | "xml"
  patches: Record<string, string>
}

/**
 * Install step run inside a one-shot container before the server is marked
 * `installed_stopped`.
 */
export type BlueprintInstall = {
  image: string
  entrypoint: string
  script: string
}

/**
 * A regex/substring match descriptor used by `console` lifecycle probes.
 */
export type BlueprintMatch =
  | { type: "regex"; pattern: string; flags?: string }
  | { type: "substring"; value: string }

/**
 * Lifecycle probe strategies. The daemon ships these implementations;
 * blueprints compose them.
 */
export type BlueprintProbe =
  | { strategy: "console"; match: BlueprintMatch }
  | {
      strategy: "tcp"
      host?: string
      port: string
    }
  | {
      strategy: "udp_packet"
      host?: string
      port: string
      payload: string
      payloadEncoding: "utf8" | "hex" | "base64"
    }
  | {
      strategy: "http"
      host?: string
      port: string
      path: string
      method?: "GET" | "POST" | "HEAD"
      expectStatus?: number
    }
  | {
      strategy: "exec"
      command: string[]
      expectExitCode?: number
    }
  | {
      strategy: "container_exit"
      ifNotInState?: Array<
        "installing" | "starting" | "running" | "stopping" | "stopped"
      >
    }

/**
 * Probe set armed during the `starting` transition. `onTimeout` controls what
 * the daemon does when no probe matches before `timeoutMs`.
 */
export type BlueprintStartingLifecycle = {
  probes: BlueprintProbe[]
  intervalMs: number
  timeoutMs: number
  onTimeout: "mark_crashed" | "mark_stopped" | "keep_starting"
}

/**
 * Probe set armed during the `stopping` transition. After `graceTimeoutMs`
 * the daemon SIGKILLs the container.
 */
export type BlueprintStoppingLifecycle = {
  probes: BlueprintProbe[]
  graceTimeoutMs: number
  onTimeout: "force_kill"
}

/**
 * Probe set evaluated continuously while the server is in `running` state to
 * detect crashes.
 */
export type BlueprintCrashLifecycle = {
  probes: BlueprintProbe[]
}

/**
 * Aggregate lifecycle declaration for a blueprint.
 */
export type BlueprintLifecycle = {
  starting: BlueprintStartingLifecycle
  stopping: BlueprintStoppingLifecycle
  crashDetection: BlueprintCrashLifecycle
}

/**
 * A blueprint is an admin-authored JSON document describing how to provision
 * and run one class of server (a Minecraft server, an FTP daemon, etc.).
 */
export type Blueprint = {
  schemaVersion: 1
  name: BlueprintLocalizableText
  description?: BlueprintLocalizableText
  author?: string
  dockerImages: Record<string, string>
  stopSignal: string
  startupCommand: string
  configFiles?: BlueprintConfigFile[]
  variables: BlueprintVariable[]
  install: BlueprintInstall
  lifecycle: BlueprintLifecycle
  features?: string[]
}
