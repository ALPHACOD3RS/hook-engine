import { Request, Response, NextFunction } from 'express';
import { HookEngine } from '../core/engine';
import { HookEngineConfig } from '../types/config';

/**
 * Express middleware factory for webhook handling
 */
export function createWebhookMiddleware(config: Partial<HookEngineConfig>) {
  const engine = new HookEngine(config);
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await engine.processWebhook(req);
      
      if (result.success) {
        res.status(200).json({ 
          success: true, 
          eventId: result.event?.id,
          message: result.message,
          duration: result.duration
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error,
          message: result.message,
          duration: result.duration
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express middleware factory for webhook handling with custom business logic
 */
export function createWebhookMiddlewareWithRetry(
  config: Partial<HookEngineConfig>,
  businessLogic: (event: any) => Promise<void>
) {
  const engine = new HookEngine(config);
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await engine.processWebhookWithRetry(req, businessLogic);
      
      if (result.success) {
        res.status(200).json({ 
          success: true, 
          eventId: result.event?.id,
          message: result.message,
          duration: result.duration,
          attempts: result.attempts
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error,
          message: result.message,
          duration: result.duration,
          attempts: result.attempts
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express error handler for webhook errors
 */
export function webhookErrorHandler(
  error: any, 
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  console.error('Webhook error:', error);
  
  // Don't expose internal errors to clients
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDevelopment && { details: error.message, stack: error.stack })
  });
}

/**
 * Express route factory for webhook endpoints
 */
export function createWebhookRoute(path: string, config: Partial<HookEngineConfig>) {
  return {
    path,
    method: 'POST',
    middleware: [createWebhookMiddleware(config)],
    errorHandler: webhookErrorHandler
  };
} 