export function createStore(initialState) {
  /** @type {any} */
  let state = initialState;
  /** @type {Set<() => void>} */
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(updater) {
    const next = typeof updater === "function" ? updater(state) : updater;
    state = next;
    for (const l of listeners) l();
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
