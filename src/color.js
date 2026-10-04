export function makeColors(enabled) {
  const wrap = (open, close) => (s) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
  return {
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    cyan: wrap(36, 39),
  };
}

export function colorEnabled(stream, flag) {
  if (flag === false || process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(stream.isTTY);
}
