// src/@types/express/index.d.ts

import 'express';

declare module 'express-serve-static-core' {
  interface User {
    id: number;
    nome: string;
    administrador: boolean;
    tipo: 'INSTITUICAO' | 'PCD' | 'ADMIN'; // Inclui 'ADMIN'
  }

  interface Request {
    user?: User;
  }
}

export {};
