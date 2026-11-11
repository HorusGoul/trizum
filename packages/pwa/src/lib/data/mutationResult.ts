/** Preserve the existing throwing save contract when handling a Fate mutation response. */
export async function mutationResult<Result>(
  pending: Promise<{ error: undefined; result: Result } | { error: Error; result: undefined }>,
): Promise<Result> {
  const response = await pending;

  if (response.error) throw response.error;

  return response.result;
}
