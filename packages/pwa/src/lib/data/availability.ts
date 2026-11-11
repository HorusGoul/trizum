export function requireAvailable<Value extends { available: boolean }>(value: Value): Value {
  if (!value.available) throw new Error("Record unavailable");

  return value;
}

export function requireAvailableList<Values extends readonly { available: boolean }[]>(
  values: Values,
): Values {
  for (const value of values) requireAvailable(value);

  return values;
}
