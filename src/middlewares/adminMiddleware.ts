import { Request, Response, NextFunction } from 'express';

const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.administrador && req.user.tipo === 'ADMIN') {
    next();
  } else {
    return res.status(403).json({ message: 'Permissão negada' });
  }
};

export default adminMiddleware;
