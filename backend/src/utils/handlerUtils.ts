import { Request, Response, NextFunction } from 'express';

/**
 * Higher-order function to wrap controller methods with a standardized try-catch block.
 * This simplifies error handling and ensures consistent error responses.
 */
export const safeHandler = (fn: Function) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error: any) {
      console.error(`[Handler Error] ${req.method} ${req.originalUrl}:`, error);
      
      // Standardize error responses
      const statusCode = error.statusCode || 500;
      const message = error.message || 'An unexpected error occurred';
      
      // SRE: Add retryable hint for transient errors
      const isRetryable = statusCode === 503 || statusCode === 504 || statusCode === 429;

      // Prevent internal stack trace leakage in production
      res.status(statusCode).json({
        message,
        retryable: isRetryable,
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };
};
