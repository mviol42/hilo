/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '@hilo/shared';

/**
 * Global error handler middleware
 * Catches any errors that weren't handled in routes
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled error:', err);

  const response: ErrorResponse = {
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred',
  };

  res.status(500).json(response);
}

/**
 * 404 handler for unknown routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const response: ErrorResponse = {
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  };

  res.status(404).json(response);
}
