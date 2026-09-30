// Production is deliberately silent, including error paths and render loops.
const noop = (..._args: unknown[]): void => {};
export const logger = import.meta.env.DEV ? console : {
  log: noop, error: noop, warn: noop, info: noop, debug: noop,
  trace: noop, table: noop, group: noop, groupEnd: noop,
};
