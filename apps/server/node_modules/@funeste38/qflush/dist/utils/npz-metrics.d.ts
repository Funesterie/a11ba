import { Request, Response, NextFunction } from 'express';
export declare function metricsMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export default metricsMiddleware;
