import { Hono } from "hono";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "../lib/Db";
import { RequireAuth, RequireAdmin } from "../middleware/Auth";
import type { Variables } from "../Types";

const blueprints = new Hono<{ Variables: Variables }>();

// Validation schemas
const blueprintConfigSchema = z.object({
  stdin_open: z.boolean().optional(),
  tty: z.boolean().optional(),
  ports: z
    .array(
      z.object({
        container_port: z.number(),
        host_port: z.number().optional(),
        protocol: z.string().optional(),
      })
    )
    .optional(),
  environment: z.record(z.string()).optional(),
  resources: z
    .object({
      memory: z.number().optional(),
      cpus: z.number().optional(),
      cpuset_cpus: z.string().optional(),
    })
    .optional(),
  mounts: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
        read_only: z.boolean().optional(),
      })
    )
    .optional(),
  volumes: z
    .array(
      z.object({
        name: z.string(),
        target: z.string(),
        read_only: z.boolean().optional(),
      })
    )
    .optional(),
  command: z.array(z.string()).optional(),
  entrypoint: z.array(z.string()).optional(),
  working_dir: z.string().optional(),
  restart_policy: z.enum(["no", "always", "onfailure", "unlessstopped"]).optional(),
});

const createBlueprintSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  category: z.string().optional(),
  author: z.string().optional(),
  dockerImages: z.record(z.string()).default({}),
  startup: z.string().default(""),
  config: z.record(z.unknown()).optional(),
  scripts: z.record(z.unknown()).optional(),
  variables: z.array(z.unknown()).optional(),
  features: z.array(z.string()).optional(),
  fileDenylist: z.array(z.string()).default([]),
  dockerConfig: blueprintConfigSchema.optional(),
  isPublic: z.boolean().default(true),
});

const updateBlueprintSchema = createBlueprintSchema.partial();

// Pterodactyl egg schema
const pterodactylEggSchema = z.object({
  meta: z
    .object({
      version: z.string(),
      update_url: z.string().nullable().optional(),
    })
    .optional(),
  name: z.string(),
  author: z.string().optional(),
  description: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  docker_images: z.record(z.string()).optional(),
  file_denylist: z.array(z.string()).optional(),
  startup: z.string().optional(),
  config: z
    .object({
      files: z.string().optional(),
      startup: z.string().optional(),
      logs: z.string().optional(),
      stop: z.string().optional(),
    })
    .optional(),
  scripts: z
    .object({
      installation: z
        .object({
          script: z.string(),
          container: z.string().optional(),
          entrypoint: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  variables: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        env_variable: z.string(),
        default_value: z.string(),
        user_viewable: z.boolean().optional(),
        user_editable: z.boolean().optional(),
        rules: z.string().optional(),
        field_type: z.string().optional(),
      })
    )
    .optional(),
});

// Helper to parse Pterodactyl docker image string
const parseDockerImage = (
  imageStr: string
): { registry: string | undefined; name: string; tag: string } => {
  // Remove escape sequences
  const cleaned = imageStr.replace(/\\\//g, "/");

  // Parse image parts
  const parts = cleaned.split("/");
  let registry: string | undefined = undefined;
  let nameWithTag: string;

  if (parts.length >= 2 && (parts[0].includes(".") || parts[0].includes(":"))) {
    registry = parts[0];
    nameWithTag = parts.slice(1).join("/");
  } else {
    nameWithTag = cleaned;
  }

  // Split name and tag
  const [name, tag = "latest"] = nameWithTag.split(":");

  return { registry, name, tag };
};

// List all public blueprints (or all if admin)
blueprints.get("/", RequireAuth, async (c) => {
  const user = c.get("user");

  const where = user.role === "admin" ? {} : { isPublic: true };

  const allBlueprints = await db.blueprint.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return c.json(allBlueprints);
});

// Get single blueprint
blueprints.get("/:id", RequireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");

  const blueprint = await db.blueprint.findUnique({
    where: { id },
  });

  if (!blueprint) {
    return c.json({ error: "Blueprint not found" }, 404);
  }

  // Non-admins can only see public blueprints
  if (!blueprint.isPublic && user.role !== "admin") {
    return c.json({ error: "Blueprint not found" }, 404);
  }

  return c.json(blueprint);
});

// Create blueprint (admin only)
blueprints.post("/", RequireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = createBlueprintSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.errors }, 400);
  }

  const blueprint = await db.blueprint.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      author: parsed.data.author || null,
      dockerImages:
        Object.keys(parsed.data.dockerImages).length > 0
          ? parsed.data.dockerImages
          : { Default: "alpine:latest" },
      startup: parsed.data.startup,
      config: (parsed.data.config || {}) as Prisma.InputJsonValue,
      scripts: (parsed.data.scripts || {}) as Prisma.InputJsonValue,
      variables: (parsed.data.variables || []) as Prisma.InputJsonValue,
      features: parsed.data.features || [],
      fileDenylist: parsed.data.fileDenylist,
      dockerConfig: parsed.data.dockerConfig || {
        stdin_open: true,
        tty: true,
        environment: {},
        volumes: [{ name: "data", target: "/home/container" }],
      },
      isPublic: parsed.data.isPublic,
    },
  });

  return c.json(blueprint, 201);
});

// Update blueprint (admin only)
blueprints.patch("/:id", RequireAdmin, async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const parsed = updateBlueprintSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.errors }, 400);
  }

  try {
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.config) {
      updateData.config = parsed.data.config;
    }

    const blueprint = await db.blueprint.update({
      where: { id },
      data: updateData as Prisma.BlueprintUpdateInput,
    });

    return c.json(blueprint);
  } catch {
    return c.json({ error: "Blueprint not found" }, 404);
  }
});

// Delete blueprint (admin only)
blueprints.delete("/:id", RequireAdmin, async (c) => {
  const { id } = c.req.param();

  try {
    await db.blueprint.delete({
      where: { id },
    });

    return c.json({ success: true });
  } catch {
    return c.json({ error: "Blueprint not found or in use by servers" }, 400);
  }
});

// Import Pterodactyl egg (admin only)
blueprints.post("/import/egg", RequireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = pterodactylEggSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid Pterodactyl egg format", details: parsed.error.errors }, 400);
  }

  const egg = parsed.data;

  // Clean up docker images (escape sequence removal)
  const cleanedDockerImages: Record<string, string> = {};
  if (egg.docker_images) {
    for (const [label, image] of Object.entries(egg.docker_images)) {
      cleanedDockerImages[label] = image.replace(/\\\//g, "/");
    }
  }

  // Build default environment from variables
  const environment: Record<string, string> = {};
  if (egg.variables) {
    for (const variable of egg.variables) {
      environment[variable.env_variable] = variable.default_value;
    }
  }

  // Build docker config (default container configuration)
  const dockerConfig = {
    stdin_open: true,
    tty: true,
    environment,
    // Default volume for server data (used by Pterodactyl eggs)
    volumes: [
      {
        name: "data",
        target: "/home/container", // Pterodactyl's default working directory
      },
    ],
    // Note: Resources (memory, cpu) are set per-server, not in the blueprint
  };

  // Store Pterodactyl format natively (no decomposition)
  const blueprint = await db.blueprint.create({
    data: {
      name: egg.name,
      description: egg.description || null,
      author: egg.author || null,
      category: "imported",

      // Pterodactyl metadata
      metaVersion: egg.meta?.version || "PTDL_v2",
      updateUrl: egg.meta?.update_url || null,

      // Store complete Pterodactyl structures as-is
      fileDenylist: egg.file_denylist || [],
      dockerImages:
        Object.keys(cleanedDockerImages).length > 0
          ? cleanedDockerImages
          : { Default: "alpine:latest" },
      startup: egg.startup || "",
      config: egg.config || {},
      scripts: egg.scripts || {},
      variables: egg.variables || [],
      features: egg.features || [],
      dockerConfig,
      isPublic: true,
    },
  });

  return c.json(
    {
      success: true,
      blueprint,
      message: `Successfully imported "${egg.name}" from Pterodactyl egg`,
    },
    201
  );
});

// Export blueprint as Pterodactyl egg format (admin only)
blueprints.get("/:id/export/egg", RequireAdmin, async (c) => {
  const { id } = c.req.param();

  const blueprint = await db.blueprint.findUnique({
    where: { id },
  });

  if (!blueprint) {
    return c.json({ error: "Blueprint not found" }, 404);
  }

  // Minimal conversion - already in native Pterodactyl format
  const egg = {
    _comment: "EXPORTED FROM STELLARSTACK",
    meta: {
      version: blueprint.metaVersion,
      update_url: blueprint.updateUrl,
    },
    exported_at: new Date().toISOString(),

    // Direct field mapping (already native format)
    name: blueprint.name,
    author: blueprint.author,
    description: blueprint.description,
    features: blueprint.features,
    docker_images: (blueprint.dockerImages as Record<string, string>) || {},
    file_denylist: blueprint.fileDenylist,
    startup: blueprint.startup,
    config: blueprint.config,
    scripts: blueprint.scripts,
    variables: blueprint.variables,
  };

  return c.json(egg);
});

export { blueprints };
