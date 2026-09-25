export function isUniqueConstraintError(error: unknown) {
  const visited = new Set<unknown>();
  let current = error;

  while (current instanceof Error && !visited.has(current)) {
    if (/unique constraint/i.test(current.message)) {
      return true;
    }

    visited.add(current);
    current = current.cause;
  }

  return false;
}
