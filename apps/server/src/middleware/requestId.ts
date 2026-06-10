import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const existing = req.header('x-request-id');
  const id = existing && existing.length > 0 ? existing : crypto.randomUUID();
  res.setHeader('x-request-id', id);
  req.headers['x-request-id'] = id;
  next();
}
