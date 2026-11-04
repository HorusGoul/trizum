export function isUniqueConstraintError(cause: unknown) {
  const visited = new Set<unknown>();
  let current = cause;

  while (current instanceof Error && !visited.has(current)) {
    if (/unique constraint/i.test(current.message)) {
      return true;
    }

    visited.add(current);
    current = current.cause;
  }

  return false;
}
