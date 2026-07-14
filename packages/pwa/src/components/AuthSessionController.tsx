import { authClient } from "#src/lib/auth-client.ts";

export function AuthSessionController() {
  authClient.useSession();
  return null;
}
