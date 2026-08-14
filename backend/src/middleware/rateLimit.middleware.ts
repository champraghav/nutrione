import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * "Try again later" is not actionable. Reading the window off the request lets
 * the message say how long the wait actually is, which is the difference
 * between a user retrying sensibly and hammering the button.
 */
function limitMessage(prefix: string) {
  return (req: Request, res: Response) => {
    const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
    const seconds = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : null;

    const wait =
      seconds === null
        ? 'Please try again later.'
        : seconds >= 60
          ? `Please try again in about ${Math.ceil(seconds / 60)} minute${Math.ceil(seconds / 60) === 1 ? '' : 's'}.`
          : `Please try again in ${seconds} seconds.`;

    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: `${prefix} ${wait}`, retryAfterSeconds: seconds },
    });
  };
}

const shared: Partial<Options> = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
};

export const apiRateLimit = rateLimit({
  ...shared,
  limit: 300,
  handler: limitMessage('Too many requests.'),
});

export const authRateLimit = rateLimit({
  ...shared,
  limit: 20,
  handler: limitMessage('Too many sign-in attempts.'),
});
