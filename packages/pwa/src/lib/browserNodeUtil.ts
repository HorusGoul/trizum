export const inspect = Object.assign((value: unknown) => String(value), {
  custom: Symbol.for("nodejs.util.inspect.custom"),
});

export default { inspect };
