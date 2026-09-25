export class PartyBoostRequestGate {
  #context: string | null = null;
  #latestRequest = 0;

  enterContext(context: string) {
    if (this.#context === context) {
      return;
    }

    this.#context = context;
    this.#latestRequest += 1;
  }

  beginRead(context: string) {
    this.enterContext(context);
    this.#latestRequest += 1;
    return { context, request: this.#latestRequest };
  }

  beginMutation(context: string) {
    this.enterContext(context);
    this.#latestRequest += 1;
  }

  finishMutation(context: string) {
    if (this.#context !== context) {
      return false;
    }

    this.#latestRequest += 1;
    return true;
  }

  invalidateReads(context: string) {
    if (this.#context === context) {
      this.#latestRequest += 1;
    }
  }

  isCurrent(candidate: { context: string; request: number }) {
    return candidate.context === this.#context && candidate.request === this.#latestRequest;
  }
}

export function shouldInvalidatePartyBoostCache(errorCode: string) {
  return errorCode !== "unavailable";
}
