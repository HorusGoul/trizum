interface CoalescedQueueState<Result> {
  promise?: Promise<Result>;
  shouldRunAgain: boolean;
}

interface KeyedCoalescedQueueOptions<Key, Result> {
  run: (key: Key) => Promise<Result>;
  recover?: (error: unknown, key: Key) => Result;
}

export function createKeyedCoalescedQueue<Key, Result>({
  run,
  recover,
}: KeyedCoalescedQueueOptions<Key, Result>) {
  const states = new Map<Key, CoalescedQueueState<Result>>();

  return (key: Key) => {
    const state = getQueueState(states, key);
    state.shouldRunAgain = true;
    state.promise ??= runQueuedWork({ key, states, state, run, recover });

    return state.promise;
  };
}

function getQueueState<Key, Result>(states: Map<Key, CoalescedQueueState<Result>>, key: Key) {
  let state = states.get(key);

  if (!state) {
    state = {
      shouldRunAgain: false,
    };
    states.set(key, state);
  }

  return state;
}

async function runQueuedWork<Key, Result>({
  key,
  states,
  state,
  run,
  recover,
}: {
  key: Key;
  states: Map<Key, CoalescedQueueState<Result>>;
  state: CoalescedQueueState<Result>;
  run: (key: Key) => Promise<Result>;
  recover?: (error: unknown, key: Key) => Result;
}) {
  try {
    return await runRequestedWork({ key, state, run });
  } catch (error) {
    state.shouldRunAgain = false;

    if (recover) {
      return recover(error, key);
    }

    throw error;
  } finally {
    state.promise = undefined;

    if (!state.shouldRunAgain) {
      states.delete(key);
    }
  }
}

function runRequestedWork<Key, Result>({
  key,
  state,
  run,
}: {
  key: Key;
  state: CoalescedQueueState<Result>;
  run: (key: Key) => Promise<Result>;
}): Promise<Result> {
  state.shouldRunAgain = false;

  return run(key).then((result) => {
    if (state.shouldRunAgain) {
      return runRequestedWork({ key, state, run });
    }

    return result;
  });
}
