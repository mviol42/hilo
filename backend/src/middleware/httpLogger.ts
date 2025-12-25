/**
 * Express middleware for HTTP request logging
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Log request
  const requestLog = {
    method: req.method,
    route: req.path,
    body: req.body,
    query: req.query,
    timestamp: new Date().toISOString(),
  };

  logger.info(`HTTP Request: ${JSON.stringify(requestLog)}`);

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseLog = {
      method: req.method,
      route: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    logger[logLevel](`HTTP Response: ${JSON.stringify(responseLog)}`);
  });

  next();
}
