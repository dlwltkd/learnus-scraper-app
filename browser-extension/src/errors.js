const PUBLIC_ERROR_CODES = new Set([
  'NO_SESSION',
  'SESSION_REJECTED',
  'RATE_LIMITED',
  'NETWORK',
  'TIMEOUT',
  'SERVER',
  'BAD_RESPONSE',
  'COOKIE_UNAVAILABLE',
]);

export class BridgeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'BridgeError';
    this.code = code;
  }
}

export function publicErrorCode(error) {
  if (error instanceof BridgeError && PUBLIC_ERROR_CODES.has(error.code)) {
    return error.code;
  }
  return 'INTERNAL';
}
