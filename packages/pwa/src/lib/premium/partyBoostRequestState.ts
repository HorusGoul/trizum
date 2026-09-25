export class PartyBoostRequestGate {
  #latestRequest = 0;

  beginRead() {
    this.#latestRequest += 1;
    return this.#latestRequest;
  }

  invalidateReads() {
    this.#latestRequest += 1;
  }

  isCurrent(request: number) {
    return request === this.#latestRequest;
  }
}

export function shouldInvalidatePartyBoostCache(errorCode: string) {
  return errorCode !== "unavailable";
}
