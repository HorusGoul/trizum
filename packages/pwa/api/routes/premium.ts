import { $, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import { createAuth } from "../auth";
import { activatePartyBoostRoute, getPartyBoostRoute } from "../contracts/premium";
import { getApiDb, schema } from "../db/client";
import { isUniqueConstraintError } from "../db/errors";
import type { ApiHonoEnv } from "../env";
import { getPartyBoostAssignmentAction, getPartyBoostTransferableAt } from "../premium/partyBoost";
import { PartyMembershipUnavailableError, verifyPartyMembership } from "../premium/partyMembership";
import {
  PremiumVerificationUnavailableError,
  verifyRevenueCatPremium,
} from "../premium/revenueCat";
import type {
  PartyBoostAssignmentStatus,
  PartyBoostErrorCode,
  PartyBoostRevocationReason,
  PartyBoostStatus,
} from "../../src/lib/api/premiumContract";
type ApiDb = ReturnType<typeof getApiDb>;
type PartyBoostRow = typeof schema.partyBoost.$inferSelect;

const premiumApp = $(
  new OpenAPIHono<ApiHonoEnv>().use("*", async (c, next) => {
    const auth = createAuth(c.env, c.executionCtx, c.req.raw);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      return c.json({ error: { code: "unauthorized", message: "Sign in is required." } }, 401);
    }

    c.set("session", session.session);
    c.set("user", session.user);
    await next();
  }),
);

export const premiumRoute = premiumApp
  .openapi(
    getPartyBoostRoute,
    async (c) => {
      const { partyDocumentId } = c.req.valid("query");

      try {
        const status = await getPartyBoostStatus({
          apiKey: c.env.REVENUECAT_SECRET_API_KEY,
          db: getApiDb(c.env.DB),
          env: c.env,
          partyDocumentId,
          projectId: c.env.REVENUECAT_PROJECT_ID,
          request: c.req.raw,
          userId: c.get("user").id,
        });

        if (!status) {
          return partyBoostError(c, "membership_required", "Party membership is required.", 403);
        }

        return c.json(status, 200);
      } catch (error) {
        return handleVerificationError(c, error);
      }
    },
    (result, c) => {
      if (!result.success) {
        return partyBoostError(c, "invalid_party", "Party document ID is invalid.", 400);
      }
    },
  )
  .openapi(
    activatePartyBoostRoute,
    async (c) => {
      const { partyDocumentId } = c.req.valid("json");
      const userId = c.get("user").id;
      const db = getApiDb(c.env.DB);

      try {
        const isMember = await verifyUserPartyMembership({
          db,
          env: c.env,
          partyDocumentId,
          request: c.req.raw,
          userId,
        });

        if (!isMember) {
          return partyBoostError(c, "membership_required", "Party membership is required.", 403);
        }

        const premium = await verifyRevenueCatPremium({
          apiKey: c.env.REVENUECAT_SECRET_API_KEY,
          projectId: c.env.REVENUECAT_PROJECT_ID,
          userId,
        });

        if (!premium.isPremium) {
          await revokeActiveAssignment(db, userId, "premium_inactive", Date.now());
          return partyBoostError(
            c,
            "premium_required",
            "Premium is required for Party Boost.",
            403,
          );
        }

        const existingPartyAssignment = await getActivePartyAssignment(db, partyDocumentId);
        if (existingPartyAssignment && existingPartyAssignment.ownerUserId !== userId) {
          const remainsActive = await validateActiveAssignment({
            apiKey: c.env.REVENUECAT_SECRET_API_KEY,
            assignment: existingPartyAssignment,
            db,
            env: c.env,
            projectId: c.env.REVENUECAT_PROJECT_ID,
            request: c.req.raw,
          });

          if (remainsActive) {
            return partyBoostError(
              c,
              "already_boosted",
              "This party already has an active Party Boost.",
              409,
            );
          }
        }

        const now = Date.now();
        const assignment = await getUserAssignment(db, userId);
        const action = getPartyBoostAssignmentAction({ assignment, now, partyDocumentId });

        if (action.type === "transfer_locked") {
          return partyBoostError(
            c,
            "transfer_locked",
            "Party Boost can only move once every seven days.",
            409,
            action.transferableAt,
          );
        }

        const storedAssignment = await applyAssignmentAction({
          action: action.type,
          assignment,
          db,
          now,
          partyDocumentId,
          userId,
        });

        if (!storedAssignment) {
          return partyBoostError(
            c,
            "already_boosted",
            "Party Boost changed on another device. Refresh and try again.",
            409,
          );
        }

        return c.json(
          createPartyBoostStatus({
            assignment: storedAssignment,
            isPartyBoostActive: true,
            isPremium: true,
            partyDocumentId,
            userId,
          }),
          200,
        );
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return partyBoostError(
            c,
            "already_boosted",
            "This party already has an active Party Boost.",
            409,
          );
        }

        return handleVerificationError(c, error);
      }
    },
    (result, c) => {
      if (!result.success) {
        return partyBoostError(c, "invalid_party", "Party document ID is invalid.", 400);
      }
    },
  );

export type PremiumRoute = typeof premiumRoute;

async function getPartyBoostStatus({
  apiKey,
  db,
  env,
  partyDocumentId,
  projectId,
  request,
  userId,
}: {
  apiKey: string | undefined;
  db: ApiDb;
  env: ApiHonoEnv["Bindings"];
  partyDocumentId: string;
  projectId: string | undefined;
  request: Request;
  userId: string;
}): Promise<PartyBoostStatus | null> {
  const isMember = await verifyUserPartyMembership({
    db,
    env,
    partyDocumentId,
    request,
    userId,
  });

  if (!isMember) {
    return null;
  }

  let assignment = await getUserAssignment(db, userId);
  const premium = assignment
    ? await verifyRevenueCatPremium({ apiKey, projectId, userId })
    : { isPremium: false };

  if (assignment?.revokedAt === null) {
    if (!premium.isPremium) {
      assignment = await revokeAssignment(db, assignment, "premium_inactive", Date.now());
    } else if (assignment.partyDocumentId !== partyDocumentId) {
      const ownsAssignedParty = await verifyUserPartyMembership({
        db,
        env,
        partyDocumentId: assignment.partyDocumentId,
        request,
        userId,
      });

      if (!ownsAssignedParty) {
        assignment = await revokeAssignment(db, assignment, "owner_not_member", Date.now());
      }
    }
  }

  let partyAssignment: PartyBoostRow | null = await getActivePartyAssignment(db, partyDocumentId);
  if (partyAssignment && partyAssignment.ownerUserId !== userId) {
    const remainsActive = await validateActiveAssignment({
      apiKey,
      assignment: partyAssignment,
      db,
      env,
      projectId,
      request,
    });

    if (!remainsActive) {
      partyAssignment = null;
    }
  } else if (partyAssignment && assignment?.revokedAt !== null) {
    partyAssignment = null;
  }

  return createPartyBoostStatus({
    assignment,
    isPartyBoostActive: Boolean(partyAssignment),
    isPremium: premium.isPremium,
    partyDocumentId,
    userId,
  });
}

async function validateActiveAssignment({
  apiKey,
  assignment,
  db,
  env,
  projectId,
  request,
}: {
  apiKey: string | undefined;
  assignment: PartyBoostRow;
  db: ApiDb;
  env: ApiHonoEnv["Bindings"];
  projectId: string | undefined;
  request: Request;
}) {
  const premium = await verifyRevenueCatPremium({
    apiKey,
    projectId,
    userId: assignment.ownerUserId,
  });
  if (!premium.isPremium) {
    await revokeAssignment(db, assignment, "premium_inactive", Date.now());
    return false;
  }

  const isMember = await verifyUserPartyMembership({
    db,
    env,
    partyDocumentId: assignment.partyDocumentId,
    request,
    userId: assignment.ownerUserId,
  });

  if (!isMember) {
    await revokeAssignment(db, assignment, "owner_not_member", Date.now());
    return false;
  }

  return true;
}

async function verifyUserPartyMembership({
  db,
  env,
  partyDocumentId,
  request,
  userId,
}: {
  db: ApiDb;
  env: ApiHonoEnv["Bindings"];
  partyDocumentId: string;
  request: Request;
  userId: string;
}) {
  const [settings] = await db
    .select({ partyListDocumentId: schema.cloudUserSettings.partyListDocumentId })
    .from(schema.cloudUserSettings)
    .where(eq(schema.cloudUserSettings.userId, userId))
    .limit(1);

  if (!settings) {
    return false;
  }

  return verifyPartyMembership({
    env,
    partyDocumentId,
    partyListDocumentId: settings.partyListDocumentId,
    request,
  });
}

async function getUserAssignment(db: ApiDb, userId: string) {
  const [assignment] = await db
    .select()
    .from(schema.partyBoost)
    .where(eq(schema.partyBoost.ownerUserId, userId))
    .limit(1);
  return assignment ?? null;
}

async function getActivePartyAssignment(db: ApiDb, partyDocumentId: string) {
  const [assignment] = await db
    .select()
    .from(schema.partyBoost)
    .where(
      and(
        eq(schema.partyBoost.partyDocumentId, partyDocumentId),
        isNull(schema.partyBoost.revokedAt),
      ),
    )
    .limit(1);
  return assignment ?? null;
}

async function revokeActiveAssignment(
  db: ApiDb,
  userId: string,
  reason: PartyBoostRevocationReason,
  now: number,
) {
  const assignment = await getUserAssignment(db, userId);
  if (assignment?.revokedAt === null) {
    await revokeAssignment(db, assignment, reason, now);
  }
}

async function revokeAssignment(
  db: ApiDb,
  assignment: PartyBoostRow,
  reason: PartyBoostRevocationReason,
  now: number,
) {
  const [updated] = await db
    .update(schema.partyBoost)
    .set({
      revocationReason: reason,
      revokedAt: now,
      updatedAt: now,
      version: assignment.version + 1,
    })
    .where(
      and(
        eq(schema.partyBoost.ownerUserId, assignment.ownerUserId),
        eq(schema.partyBoost.version, assignment.version),
        isNull(schema.partyBoost.revokedAt),
      ),
    )
    .returning();

  return updated ?? (await getUserAssignment(db, assignment.ownerUserId));
}

async function applyAssignmentAction({
  action,
  assignment,
  db,
  now,
  partyDocumentId,
  userId,
}: {
  action: "create" | "keep" | "reactivate" | "transfer";
  assignment: PartyBoostRow | null;
  db: ApiDb;
  now: number;
  partyDocumentId: string;
  userId: string;
}) {
  if (action === "create") {
    const [created] = await db
      .insert(schema.partyBoost)
      .values({
        assignedAt: now,
        ownerUserId: userId,
        partyDocumentId,
        transferableAt: getPartyBoostTransferableAt(now),
        updatedAt: now,
      })
      .returning();
    return created ?? null;
  }

  if (!assignment) {
    return null;
  }

  if (action === "keep") {
    return assignment;
  }

  const isTransfer = action === "transfer";
  const [updated] = await db
    .update(schema.partyBoost)
    .set({
      assignedAt: isTransfer ? now : assignment.assignedAt,
      partyDocumentId,
      revocationReason: null,
      revokedAt: null,
      transferableAt: isTransfer ? getPartyBoostTransferableAt(now) : assignment.transferableAt,
      updatedAt: now,
      version: assignment.version + 1,
    })
    .where(
      and(
        eq(schema.partyBoost.ownerUserId, userId),
        eq(schema.partyBoost.version, assignment.version),
      ),
    )
    .returning();

  return updated ?? null;
}

function createPartyBoostStatus({
  assignment,
  isPartyBoostActive,
  isPremium,
  partyDocumentId,
  userId,
}: {
  assignment: PartyBoostRow | null;
  isPartyBoostActive: boolean;
  isPremium: boolean;
  partyDocumentId: string;
  userId: string;
}): PartyBoostStatus {
  return {
    currentUser: {
      assignment: assignment ? toPublicAssignment(assignment) : null,
      isPremium,
    },
    party: {
      isBoosted: isPartyBoostActive,
      isBoostedByCurrentUser:
        isPartyBoostActive &&
        assignment?.ownerUserId === userId &&
        assignment.partyDocumentId === partyDocumentId &&
        assignment.revokedAt === null,
    },
  };
}

function toPublicAssignment(assignment: PartyBoostRow): PartyBoostAssignmentStatus {
  return {
    active: assignment.revokedAt === null,
    assignedAt: assignment.assignedAt,
    partyDocumentId: assignment.partyDocumentId,
    revocationReason: assignment.revocationReason,
    revokedAt: assignment.revokedAt,
    transferableAt: assignment.transferableAt,
  };
}

function handleVerificationError(c: Context<ApiHonoEnv>, error: unknown) {
  if (
    error instanceof PremiumVerificationUnavailableError ||
    error instanceof PartyMembershipUnavailableError
  ) {
    return partyBoostError(
      c,
      "unavailable",
      "Party Boost could not be verified. Try again when you are online.",
      503,
    );
  }

  throw error;
}

function partyBoostError<Status extends 400 | 403 | 409 | 503>(
  c: Context<ApiHonoEnv>,
  code: PartyBoostErrorCode,
  message: string,
  status: Status,
  transferableAt?: number,
) {
  return c.json(
    {
      error: {
        code,
        message,
        ...(transferableAt === undefined ? {} : { transferableAt }),
      },
    },
    status,
  );
}
