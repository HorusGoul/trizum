export function isPromiseLike<Type>(value: PromiseLike<Type> | Type): value is PromiseLike<Type> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}
