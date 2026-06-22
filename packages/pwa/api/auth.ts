import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, magicLink } from "better-auth/plugins";
import { EmailMessage } from "cloudflare:email";
import { eq } from "drizzle-orm";
import { importPKCS8, SignJWT } from "jose";
import { getApiDb, schema } from "./db/client";
import type { ApiEnv } from "./env";
import { authLogger, createBetterAuthLogger } from "./log";
import { getAllowedHosts, getTrustedOrigins, isLocalhost, splitList } from "./auth-origins";
import { AUTH_PROVIDER_CONFIG } from "../src/lib/authConfig.js";

const LOCAL_DEVELOPMENT_SECRET = "local-development-only-secret-change-before-production";

export { isTrustedOrigin } from "./auth-origins";

interface BackgroundTaskContext {
  waitUntil(promise: Promise<unknown>): void;
}

export function createAuth(env: ApiEnv, ctx: BackgroundTaskContext, request: Request) {
  const requestUrl = new URL(request.url);
  const isLocalRequest = isLocalhost(requestUrl.hostname);
  const secret = env.BETTER_AUTH_SECRET ?? (isLocalRequest ? LOCAL_DEVELOPMENT_SECRET : undefined);

  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET must be configured for deployed auth routes.");
  }

  const socialProviders = createSocialProviders(env);
  const trustedOrigins = getTrustedOrigins(env);
  const requireEmailVerification = shouldRequireEmailVerification(env);
  const db = getApiDb(env.DB);

  if (socialProviders.apple) {
    trustedOrigins.push("https://appleid.apple.com");
  }

  return betterAuth({
    appName: "trizum",
    database: drizzleAdapter(db, {
      camelCase: true,
      provider: "sqlite",
      schema,
    }),
    secret,
    baseURL: {
      allowedHosts: getAllowedHosts(env),
      fallback: env.BETTER_AUTH_URL ?? "https://trizum.app",
      protocol: "auto",
    },
    trustedOrigins,
    account: {
      accountLinking: {
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
        enabled: true,
        trustedProviders: ["google", "apple"],
      },
      encryptOAuthTokens: true,
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: !requireEmailVerification,
      requireEmailVerification,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail(env, {
          subject: "Reset your trizum password",
          text: `Use this link to reset your trizum password: ${url}`,
          html: `<p>Use this link to reset your trizum password:</p><p><a href="${escapeHtml(
            url,
          )}">Reset password</a></p>`,
          to: user.email,
        });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: true,
      sendOnSignIn: requireEmailVerification,
      sendOnSignUp: requireEmailVerification,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail(env, {
          subject: "Verify your trizum email",
          text: `Use this link to verify your trizum email address: ${url}`,
          html: `<p>Use this link to verify your trizum email address:</p><p><a href="${escapeHtml(
            url,
          )}">Verify email</a></p>`,
          to: user.email,
        });
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          authLogger.info("Deleting user account", { userId: user.id });

          await db
            .delete(schema.cloudUserSettings)
            .where(eq(schema.cloudUserSettings.userId, user.id));
        },
        afterDelete: async (user) => {
          authLogger.info("Deleted user account", { userId: user.id });
        },
      },
    },
    plugins: [
      bearer(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendAuthEmail(env, {
            subject: "Sign in to trizum",
            text: `Use this link to sign in to trizum: ${url}`,
            html: `<p>Use this link to sign in to trizum:</p><p><a href="${escapeHtml(
              url,
            )}">Sign in to trizum</a></p>`,
            to: email,
          });
        },
      }),
    ],
    logger: createBetterAuthLogger(),
    socialProviders,
    advanced: {
      backgroundTasks: {
        handler: (promise) => ctx.waitUntil(promise),
      },
      defaultCookieAttributes: isLocalRequest
        ? {
            sameSite: "lax",
            secure: false,
          }
        : {
            sameSite: "none",
            secure: true,
          },
    },
  });
}

function createSocialProviders(env: ApiEnv): NonNullable<BetterAuthOptions["socialProviders"]> {
  const providers: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  const googleClientId = getGoogleClientId(env);

  if (googleClientId && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: googleClientId,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    };
  }

  const appleClientId = getAppleClientId(env);
  const appleAppBundleIdentifier =
    env.APPLE_APP_BUNDLE_IDENTIFIER ?? AUTH_PROVIDER_CONFIG.apple.appBundleIdentifier;

  if (appleClientId && hasAppleClientSecretConfig(env)) {
    providers.apple = async () => ({
      clientId: appleClientId,
      clientSecret: env.APPLE_CLIENT_SECRET ?? (await generateAppleClientSecret(env)),
      appBundleIdentifier: appleAppBundleIdentifier,
      audience: [appleClientId, appleAppBundleIdentifier],
    });
  }

  return providers;
}

function getGoogleClientId(env: ApiEnv) {
  const clientIds = [
    env.GOOGLE_WEB_CLIENT_ID,
    AUTH_PROVIDER_CONFIG.google.webClientId,
    env.GOOGLE_IOS_CLIENT_ID,
    AUTH_PROVIDER_CONFIG.google.iosClientId,
    env.GOOGLE_ANDROID_APK_CLIENT_ID,
    AUTH_PROVIDER_CONFIG.google.androidApkClientId,
    env.GOOGLE_ANDROID_GOOGLE_PLAY_CLIENT_ID,
    AUTH_PROVIDER_CONFIG.google.androidGooglePlayClientId,
    env.GOOGLE_ANDROID_CLIENT_ID,
    ...splitList(env.GOOGLE_CLIENT_IDS),
  ].filter((clientId): clientId is string => Boolean(clientId));
  const uniqueClientIds = [...new Set(clientIds)];

  if (uniqueClientIds.length === 0) {
    return undefined;
  }

  if (uniqueClientIds.length === 1) {
    return uniqueClientIds[0];
  }

  return uniqueClientIds;
}

function getAppleClientId(env: ApiEnv) {
  return env.APPLE_SERVICE_ID ?? AUTH_PROVIDER_CONFIG.apple.serviceId;
}

function hasAppleClientSecretConfig(env: ApiEnv) {
  return Boolean(
    env.APPLE_CLIENT_SECRET || (env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY),
  );
}

async function generateAppleClientSecret(env: ApiEnv) {
  const clientId = getAppleClientId(env);
  const keyId = env.APPLE_KEY_ID;
  const privateKey = env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const teamId = env.APPLE_TEAM_ID;

  if (!clientId || !keyId || !privateKey || !teamId) {
    throw new Error("Apple Sign In requires APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY.");
  }

  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
}

async function sendAuthEmail(
  env: ApiEnv,
  message: {
    html: string;
    subject: string;
    text: string;
    to: string;
  },
) {
  const from = env.AUTH_EMAIL_FROM ?? "trizum <noreply@trizum.app>";

  await env.EMAIL.send(
    new EmailMessage(
      getEmailAddress(from),
      message.to,
      createRawEmail({
        ...message,
        from,
      }),
    ),
  );
}

function getEmailAddress(value: string) {
  return /<(?<email>[^>]+)>$/.exec(value.trim())?.groups?.email ?? value;
}

function createRawEmail(message: {
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}) {
  const boundary = `trizum-${crypto.randomUUID()}`;

  return [
    `From: ${sanitizeHeaderValue(message.from)}`,
    `To: ${sanitizeHeaderValue(message.to)}`,
    `Subject: ${sanitizeHeaderValue(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message.html,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function shouldRequireEmailVerification(env: ApiEnv) {
  return env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
