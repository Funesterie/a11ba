import { Request, Response, NextFunction } from 'express';
export type NpzMiddlewareOptions = {
    lanes?: any[];
    cookieName?: string;
    cookieMaxAge?: number;
};
export declare function npzMiddleware(opts?: NpzMiddlewareOptions): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export default npzMiddleware;
