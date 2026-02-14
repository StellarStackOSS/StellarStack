import { Hono } from "hono";
import { z } from "zod";
import { db } from "../lib/Db";
import { RequireServerAccess, RequirePermission, CheckPermission } from "../middleware/Auth";
import { PERMISSIONS, PERMISSION_DEFINITIONS, CATEGORY_DEFINITIONS, GetAllCategories, GetPermissionsByCategory } from "../lib/Permissions";
import type { Variables } from "../Types";
import { SendEmail } from "../lib/Email";

const members = new Hono<{ Variables: Variables }>();

// Validation schemas
const inviteMemberSchema = z.object({
  email: z.string().email(),
  permissions: z.array(z.string()).min(1),
});

const updateMemberSchema = z.object({
  permissions: z.array(z.string()).min(1),
});

// Get permission definitions (public endpoint for UI)
members.get("/permissions", async (c) => {
  const categories = GetAllCategories().map((category) => ({
    ...CATEGORY_DEFINITIONS[category],
    id: category,
    permissions: GetPermissionsByCategory(category),
  }));

  return c.json({ categories });
});

// List members (subusers) of a server
members.get(
  "/:serverId/members",
  RequireServerAccess,
  RequirePermission(PERMISSIONS.USERS_READ),
  async (c) => {
    const server = c.get("server");

    const membersList = await db.serverMember.findMany({
      where: { serverId: server.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json(
      membersList.map((m) => ({
        id: m.id,
        userId: m.userId,
        user: m.user,
        permissions: m.permissions,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }))
    );
  }
);

// Get a specific member's permissions
members.get(
  "/:serverId/members/:memberId",
  RequireServerAccess,
  RequirePermission(PERMISSIONS.USERS_READ),
  async (c) => {
    const server = c.get("server");
    const { memberId } = c.req.param();

    const member = await db.serverMember.findFirst({
      where: {
        id: memberId,
        serverId: server.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!member) {
      return c.json({ error: "Member not found" }, 404);
    }

    return c.json({
      id: member.id,
      userId: member.userId,
      user: member.user,
      permissions: member.permissions,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    });
  }
);

// Update member permissions
members.patch(
  "/:serverId/members/:memberId",
  RequireServerAccess,
  RequirePermission(PERMISSIONS.USERS_UPDATE),
  async (c) => {
    const server = c.get("server");
    const { memberId } = c.req.param();
    const body = await c.req.json();
    const parsed = updateMemberSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.errors }, 400);
    }

    const member = await db.serverMember.findFirst({
      where: {
        id: memberId,
        serverId: server.id,
      },
    });

    if (!member) {
      return c.json({ error: "Member not found" }, 404);
    }

    const updated = await db.serverMember.update({
      where: { id: memberId },
      data: { permissions: parsed.data.permissions },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return c.json({
      id: updated.id,
      userId: updated.userId,
      user: updated.user,
      permissions: updated.permissions,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  }
);

// Remove a member from server
members.delete(
  "/:serverId/members/:memberId",
  RequireServerAccess,
  RequirePermission(PERMISSIONS.USERS_DELETE),
  async (c) => {
    const server = c.get("server");
    const { memberId } = c.req.param();

    const member = await db.serverMember.findFirst({
      where: {
        id: memberId,
        serverId: server.id,
      },
    });

    if (!member) {
      return c.json({ error: "Member not found" }, 404);
    }

    await db.serverMember.delete({ where: { id: memberId } });

    return c.json({ success: true });
  }
);

// === Invitations ===

// List pending invitations for a server
members.get(
  "/:serverId/invitations",
  RequireServerAccess,
  RequirePermission(PERMISSIONS.USERS_READ),
  async (c) => {
    const server = c.get("server");

    const invitations = await db.serverInvitation.findMany({
      where: {
        serverId: server.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json(
      invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        permissions: inv.permissions,
        inviter: inv.inviter,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      }))
    );
  }
);

// Send an invitation
members.post(
  "/:serverId/invitations",
  RequireServerAccess,
  RequirePermission(PERMISSIONS.USERS_CREATE),
  async (c) => {
    const server = c.get("server");
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = inviteMemberSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.errors }, 400);
    }

    const { email, permissions } = parsed.data;

    // Check if user is already a member
    const existingMember = await db.serverMember.findFirst({
      where: {
        serverId: server.id,
        user: { email },
      },
    });

    if (existingMember) {
      return c.json({ error: "User is already a member of this server" }, 400);
    }

    // Check for existing pending invitation
    const existingInvitation = await db.serverInvitation.findFirst({
      where: {
        serverId: server.id,
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return c.json({ error: "An invitation has already been sent to this email" }, 400);
    }

    // Check if the invitee already has an account
    const invitee = await db.user.findUnique({
      where: { email },
    });

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await db.serverInvitation.create({
      data: {
        serverId: server.id,
        inviterId: user.id,
        email,
        inviteeId: invitee?.id,
        permissions,
        expiresAt,
      },
      include: {
        server: { select: { name: true } },
      },
    });

    // Send invitation email
    const acceptUrl = `${process.env.FRONTEND_URL}/servers/invitation/${invitation.token}`;

    try {
      await SendEmail({
        to: email,
        subject: `You've been invited to ${invitation.server.name} on StellarStack`,
        html: `
          <h2>Server Invitation</h2>
          <p>${user.name} has invited you to access their server "${invitation.server.name}" on StellarStack.</p>
          <p>Click the link below to accept the invitation:</p>
          <p><a href="${acceptUrl}">${acceptUrl}</a></p>
          <p>This invitation expires in 7 days.</p>
        `,
        text: `
Server Invitation

${user.name} has invited you to access their server "${invitation.server.name}" on StellarStack.

Click the link below to accept the invitation:
${acceptUrl}

This invitation expires in 7 days.
        `,
      });
    } catch (error) {
      console.error("Failed to send invitation email:", error);
      // Continue - invitation is created, user can share the link manually
    }

    return c.json({
      id: invitation.id,
      email: invitation.email,
      permissions: invitation.permissions,
      token: invitation.token,
      acceptUrl,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    });
  }
);

// Cancel/delete an invitation
members.delete(
  "/:serverId/invitations/:invitationId",
  RequireServerAccess,
  RequirePermission(PERMISSIONS.USERS_DELETE),
  async (c) => {
    const server = c.get("server");
    const { invitationId } = c.req.param();

    const invitation = await db.serverInvitation.findFirst({
      where: {
        id: invitationId,
        serverId: server.id,
      },
    });

    if (!invitation) {
      return c.json({ error: "Invitation not found" }, 404);
    }

    await db.serverInvitation.delete({ where: { id: invitationId } });

    return c.json({ success: true });
  }
);

// === User invitation handling (not server-scoped) ===

// Get invitation details by token (for acceptance page)
members.get("/invitation/:token", async (c) => {
  const { token } = c.req.param();

  const invitation = await db.serverInvitation.findUnique({
    where: { token },
    include: {
      server: { select: { id: true, name: true } },
      inviter: { select: { name: true, email: true } },
    },
  });

  if (!invitation) {
    return c.json({ error: "Invitation not found" }, 404);
  }

  if (invitation.status !== "PENDING") {
    return c.json({ error: "Invitation has already been used or declined" }, 400);
  }

  if (invitation.expiresAt < new Date()) {
    return c.json({ error: "Invitation has expired" }, 400);
  }

  return c.json({
    id: invitation.id,
    server: invitation.server,
    inviter: invitation.inviter,
    permissions: invitation.permissions,
    expiresAt: invitation.expiresAt,
  });
});

// Accept invitation
members.post("/invitation/:token/accept", async (c) => {
  const { token } = c.req.param();

  // Get current user from session
  const session = await (await import("../lib/Auth")).auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "You must be logged in to accept an invitation" }, 401);
  }

  const user = session.user;

  const invitation = await db.serverInvitation.findUnique({
    where: { token },
    include: {
      server: { select: { id: true, name: true } },
    },
  });

  if (!invitation) {
    return c.json({ error: "Invitation not found" }, 404);
  }

  if (invitation.status !== "PENDING") {
    return c.json({ error: "Invitation has already been used or declined" }, 400);
  }

  if (invitation.expiresAt < new Date()) {
    await db.serverInvitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return c.json({ error: "Invitation has expired" }, 400);
  }

  // Check if user is already a member
  const existingMember = await db.serverMember.findUnique({
    where: {
      serverId_userId: {
        serverId: invitation.serverId,
        userId: user.id,
      },
    },
  });

  if (existingMember) {
    return c.json({ error: "You are already a member of this server" }, 400);
  }

  // Check if user is the owner
  const server = await db.server.findUnique({
    where: { id: invitation.serverId },
    select: { ownerId: true },
  });

  if (server?.ownerId === user.id) {
    return c.json({ error: "You own this server" }, 400);
  }

  // Create membership and update invitation
  await db.$transaction([
    db.serverMember.create({
      data: {
        serverId: invitation.serverId,
        userId: user.id,
        permissions: invitation.permissions,
      },
    }),
    db.serverInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        inviteeId: user.id,
      },
    }),
  ]);

  return c.json({
    success: true,
    server: invitation.server,
  });
});

// Decline invitation
members.post("/invitation/:token/decline", async (c) => {
  const { token } = c.req.param();

  const invitation = await db.serverInvitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return c.json({ error: "Invitation not found" }, 404);
  }

  if (invitation.status !== "PENDING") {
    return c.json({ error: "Invitation has already been used or declined" }, 400);
  }

  await db.serverInvitation.update({
    where: { id: invitation.id },
    data: { status: "DECLINED" },
  });

  return c.json({ success: true });
});

// Get user's server memberships
members.get("/my-memberships", async (c) => {
  const session = await (await import("../lib/Auth")).auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const memberships = await db.serverMember.findMany({
    where: { userId: session.user.id },
    include: {
      server: {
        select: {
          id: true,
          name: true,
          status: true,
          node: {
            select: {
              displayName: true,
              location: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json(
    memberships.map((m) => ({
      id: m.id,
      server: m.server,
      permissions: m.permissions,
      createdAt: m.createdAt,
    }))
  );
});

// Get user's pending invitations
members.get("/my-invitations", async (c) => {
  const session = await (await import("../lib/Auth")).auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const invitations = await db.serverInvitation.findMany({
    where: {
      OR: [
        { inviteeId: session.user.id },
        { email: session.user.email },
      ],
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: {
      server: { select: { id: true, name: true } },
      inviter: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json(
    invitations.map((inv) => ({
      id: inv.id,
      token: inv.token,
      server: inv.server,
      inviter: inv.inviter,
      permissions: inv.permissions,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }))
  );
});

export { members };
