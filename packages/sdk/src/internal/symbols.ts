/**
 * Internal symbols used by the SDK.
 * This file is separate to avoid exposing internal implementation types.
 *
 * @internal
 */

/**
 * Symbol used to access the internal repository from TrizumClient.
 * This keeps the Repo access internal to the SDK without exposing it in types.
 *
 * @internal
 */
export const INTERNAL_REPO_SYMBOL: unique symbol = Symbol("INTERNAL_REPO");
