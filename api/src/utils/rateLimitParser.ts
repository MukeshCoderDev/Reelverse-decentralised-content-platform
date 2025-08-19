interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export function parseRateLimit(rateLimitString: string): RateLimitConfig {
  const parts = rateLimitString.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid rate limit string format: ${rateLimitString}. Expected "N/unit"`);
  }

  const limit = parseInt(parts[0], 10);
  if (isNaN(limit) || limit < 0) {
    throw new Error(`Invalid rate limit number: ${parts[0]}`);
  }

  const unit = parts[1].toLowerCase().trim();
  let windowMs: number;

  switch (unit) {
    case 'sec':
    case 'second':
    case 'seconds':
      windowMs = 1000;
      break;
    case 'min':
    case 'minute':
    case 'minutes':
      windowMs = 60 * 1000;
      break;
    case 'hour':
    case 'hours':
      windowMs = 60 * 60 * 1000;
      break;
    case 'day':
    case 'days':
      windowMs = 24 * 60 * 60 * 1000;
      break;
    default:
      throw new Error(`Invalid rate limit unit: ${unit}. Supported units: sec, min, hour, day`);
  }

  return { limit, windowMs };
}