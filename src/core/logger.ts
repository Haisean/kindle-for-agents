export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  if (local.length <= 1) {
    return `*@${domain}`;
  }
  return `${local[0]}***@${domain}`;
}

export function maskSensitiveText(text: string): string {
  if (!text) return text;
  // Mask email addresses
  let sanitized = text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, p1, p2) => {
    if (p1.length <= 1) return `*@${p2}`;
    return `${p1[0]}***@${p2}`;
  });

  // Mask tokens/passwords if present in string patterns like password=..., token=...
  sanitized = sanitized.replace(/(password|token|secret|auth|bearer)\s*[:=]\s*['"]?([^\s'"]+)['"]?/gi, '$1=[REDACTED]');

  return sanitized;
}

export class Logger {
  private debugMode: boolean = false;
  private jsonMode: boolean = false;

  constructor(debugMode: boolean = false, jsonMode: boolean = false) {
    this.debugMode = debugMode;
    this.jsonMode = jsonMode;
  }

  setDebug(debugMode: boolean): void {
    this.debugMode = debugMode;
  }

  setJsonMode(jsonMode: boolean): void {
    this.jsonMode = jsonMode;
  }

  info(message: string, ...args: unknown[]): void {
    if (this.jsonMode) {
      return;
    }
    console.log(maskSensitiveText(message), ...args.map(a => typeof a === 'string' ? maskSensitiveText(a) : a));
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.jsonMode) {
      return;
    }
    console.warn(`[WARN] ${maskSensitiveText(message)}`, ...args.map(a => typeof a === 'string' ? maskSensitiveText(a) : a));
  }

  error(message: string, ...args: unknown[]): void {
    if (this.jsonMode) {
      return;
    }
    console.error(`[ERROR] ${maskSensitiveText(message)}`, ...args.map(a => typeof a === 'string' ? maskSensitiveText(a) : a));
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.debugMode) {
      const formattedMessage = `[DEBUG] ${maskSensitiveText(message)}`;
      const formattedArgs = args.map(a => typeof a === 'string' ? maskSensitiveText(a) : a);
      if (this.jsonMode) {
        console.error(formattedMessage, ...formattedArgs);
      } else {
        console.log(formattedMessage, ...formattedArgs);
      }
    }
  }
}

export const logger = new Logger();
