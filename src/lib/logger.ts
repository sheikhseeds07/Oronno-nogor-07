// Application logging stays silent in every environment, including error paths.
const noop = (..._args: unknown[]): void => {};
export const logger = {
  log: noop, error: noop, warn: noop, info: noop, debug: noop,
  trace: noop, table: noop, group: noop, groupEnd: noop,
};
