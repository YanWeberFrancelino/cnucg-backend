// src/middlewares/upload.ts

import multer, { FileFilterCallback, StorageEngine } from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Verificar se a pasta 'uploads' existe e criar se não existir
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do armazenamento
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    cb(null, filename);
  }
});

// Filtro de arquivos
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error('Formato de arquivo inválido. Apenas JPEG, JPG e PNG são permitidos.');
    cb(error);
  } else {
    cb(null, true);
  }
};

// Limites de tamanho
const limits = {
  fileSize: 5 * 1024 * 1024 // 5MB
};

// Configuração do multer
const upload = multer({
  storage,
  fileFilter,
  limits
});

export default upload;