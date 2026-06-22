const WORKERS_DEV_HOST_PATTERN = "*.horusdev.workers.dev";

const DEFAULT_ALLOWED_HOSTS = [
  "trizum.app",
  WORKERS_DEV_HOST_PATTERN,
  "localhost:5173",
  "localhost:8787",
  "127.0.0.1:5173",
  "127.0.0.1:8787",
] as const;

const DEFAULT_TRUSTED_ORIGINS = [
  "https://trizum.app",
  `https://${WORKERS_DEV_HOST_PATTERN}`,
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
  "http://localhost:5173",
  "http://localhost:8787",
] as const;

interface AuthOriginEnv {
  BETTER_AUTH_ALLOWED_HOSTS?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
}

export function getAllowedHosts(env: AuthOriginEnv) {
  return [...DEFAULT_ALLOWED_HOSTS, ...splitList(env.BETTER_AUTH_ALLOWED_HOSTS)];
}

export function getTrustedOrigins(env: AuthOriginEnv) {
  return [
    ...new Set([
      ...DEFAULT_TRUSTED_ORIGINS,
      ...getAllowedHosts(env).flatMap(getTrustedOriginsForAllowedHost),
      ...splitList(env.BETTER_AUTH_TRUSTED_ORIGINS),
    ]),
  ];
}

export function isTrustedOrigin(origin: string, env: AuthOriginEnv) {
  return getTrustedOrigins(env).some((trustedOrigin) => matchesPattern(origin, trustedOrigin));
}

export function splitList(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0) ?? []
  );
}

export function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getTrustedOriginsForAllowedHost(host: string) {
  if (host.includes("://")) {
    return [host];
  }

  const hostname = host.split(":")[0];
  const isLocalAllowedHost = hostname ? isLocalhost(hostname) : false;

  return [`${isLocalAllowedHost ? "http" : "https"}://${host}`];
}

function matchesPattern(value: string, pattern: string) {
  if (value === pattern) {
    return true;
  }

  if (!pattern.includes("*")) {
    return false;
  }

  const escapedPattern = pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*");

  return new RegExp(`^${escapedPattern}$`).test(value);
}
