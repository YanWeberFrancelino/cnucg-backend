import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { RowDataPacket } from 'mysql2';


const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1]; 

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload & {
      id: number;
      nome: string;
      administrador: boolean;
      tipo: 'INSTITUICAO' | 'PCD' | 'ADMIN';
    };

    let user;

    if (decoded.tipo === 'ADMIN' || decoded.tipo === 'PCD') {
      const [userRows]: [RowDataPacket[], any] = await pool.query('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [decoded.id]);
      if (userRows.length > 0) {
        user = userRows[0];
        req.user = {
          id: user.id,
          nome: user.nome,
          administrador: user.administrador,
          tipo: decoded.tipo,
        };
        return next();
      }
    }
    else if (decoded.tipo === 'INSTITUICAO') {
      const [instRows]: [RowDataPacket[], any] = await pool.query('SELECT * FROM instituicoes WHERE id = ? AND ativo = 1', [decoded.id]);
      if (instRows.length > 0) {
        user = instRows[0];
        req.user = {
          id: user.id,
          nome: user.razao_social,
          administrador: false,
          tipo: 'INSTITUICAO',
        };
        return next();
      }
    }

    return res.status(401).json({ message: 'Usuário não encontrado' });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ message: 'Token inválido' });
  }
};



export default authMiddleware;
