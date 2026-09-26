export type AuthSessionStatus = "pending" | "unavailable" | "signed-in" | "signed-out";

/** Missing session data only confirms sign-out after a successful session check. */
export function getAuthSessionStatus(session: {
  data: { user: { id: string } } | null;
  error: unknown;
  isPending: boolean;
}): AuthSessionStatus {
  if (session.isPending) {
    return "pending";
  }
  if (session.error) {
    return "unavailable";
  }
  return session.data?.user ? "signed-in" : "signed-out";
}
