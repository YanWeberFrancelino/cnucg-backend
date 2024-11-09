import { Router, json, Request, Response } from 'express';
import pool from '../config/database';
import { caesGuiaSchema } from '../validators/caesGuiaValidator';
import authMiddleware from '../middlewares/authMiddleware';
import upload from '../middlewares/upload';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { RowDataPacket, OkPacket } from 'mysql2';

const router = Router();
router.use(json());
router.use(authMiddleware);

const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const processImage = async (file: Express.Multer.File): Promise<string | null> => {
  try {
    const originalPath = path.join(uploadsDir, file.filename);
    const processedFilename = `processed-${file.filename}`;
    const processedPath = path.join(uploadsDir, processedFilename);

    const image = sharp(originalPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      fs.unlinkSync(originalPath);
      throw new Error('A imagem fornecida é inválida.');
    }

    if (metadata.width < 300 || metadata.height < 400) {
      fs.unlinkSync(originalPath);
      throw new Error('A resolução mínima da imagem é 300x400.');
    }

    if (metadata.width > 3000 || metadata.height > 4000) {
      fs.unlinkSync(originalPath);
      throw new Error('A resolução máxima da imagem é 3000x4000.');
    }

    await image
      .resize({ width: 600, height: 800, fit: 'cover' })
      .toFile(processedPath);

    fs.unlinkSync(originalPath);
    return processedFilename;
  } catch (error) {
    console.error('Erro ao processar imagem:', error);
    return null;
  }
};

router.post('/', upload.single('imagem'), async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    let id_usuario: number | null = null;
    let id_instituicao: number | null = null;

    if (user.tipo === 'PCD') {
      id_usuario = user.id;

      if (req.body.cnpj_instituicao) {
        const cnpj = req.body.cnpj_instituicao.replace(/[^\d]/g, '');
        const [rows]: any = await pool.query('SELECT id FROM instituicoes WHERE cnpj = ?', [cnpj]);
        if (rows.length > 0) {
          id_instituicao = rows[0].id;
        } else {
          console.warn('Instituição não encontrada para o CNPJ fornecido');
        }
      }
    } else if (user.tipo === 'INSTITUICAO') {
      id_instituicao = user.id;
    } else {
      return res.status(403).json({ message: 'Permissão negada' });
    }

    const validation = caesGuiaSchema.safeParse({ ...req.body, id_instituicao, id_usuario });
    if (!validation.success) {
      const errorMessages = validation.error.errors.map(err => err.message).join(', ');
      return res.status(400).json({ message: `Erro de validação: ${errorMessages}` });
    }

    const data = validation.data;
    const values = [
      data.nome,
      data.sexo,
      data.cor,
      data.data_nascimento,
      data.raca,
      data.numero_registro,
      id_instituicao,
      id_usuario
    ];

    let imagemPath: string | null = null;
    if (req.file) {
      const processedImage = await processImage(req.file);
      if (processedImage) {
        imagemPath = processedImage;
      } else {
        return res.status(400).json({ message: 'Erro ao processar a imagem.' });
      }
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const [result]: any = await conn.execute(
        `INSERT INTO caes_guia (nome, sexo, cor, data_nascimento, raca, numero_registro, id_instituicao, id_usuario, imagem, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
        [...values, imagemPath]
      );
      res.status(201).json({ message: 'Cão-guia registrado com sucesso', id: result.insertId });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') {
        if (imagemPath) fs.unlinkSync(path.join(uploadsDir, imagemPath));
        res.status(409).json({ message: 'Número de registro duplicado' });
      } else {
        if (imagemPath) fs.unlinkSync(path.join(uploadsDir, imagemPath));
        res.status(500).json({ message: 'Erro ao adicionar cão-guia', error: e.message });
      }
    } finally {
      if (conn) conn.release();
    }
  } catch (e: unknown) {
    const error = e as Error;
    return res.status(400).json({ message: `Erro ao validar dados do cão-guia: ${error.message}` });
  }
});

router.get('/meus', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const [rows]: [RowDataPacket[], any] = await conn.execute(
        'SELECT * FROM caes_guia WHERE (id_usuario = ? OR id_instituicao = ?) AND ativo = true',
        [user.id, user.id]
      );
      res.json(rows);
    } catch (e: unknown) {
      const error = e as Error;
      res.status(500).json({ message: 'Erro ao obter cães-guia', error: error.message });
    } finally {
      if (conn) conn.release();
    }
  } catch (e: unknown) {
    const error = e as Error;
    res.status(400).json({ message: `Erro ao validar usuário: ${error.message}` });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const caoId = parseInt(req.params.id, 10);

    if (!user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const [rows]: [RowDataPacket[], any] = await conn.execute(
        'SELECT * FROM caes_guia WHERE id = ? AND ativo = true AND (id_usuario = ? OR id_instituicao = ?)',
        [caoId, user.id, user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Cão-guia não encontrado' });
      }

      res.json(rows[0]);
    } catch (e: unknown) {
      const error = e as Error;
      res.status(500).json({ message: 'Erro ao obter cão-guia', error: error.message });
    } finally {
      if (conn) conn.release();
    }
  } catch (e: unknown) {
    const error = e as Error;
    res.status(400).json({ message: `Erro ao validar solicitação: ${error.message}` });
  }
});

router.put('/:id', upload.single('imagem'), async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const caoId = parseInt(req.params.id, 10);

    if (!user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const [rows]: [RowDataPacket[], any] = await conn.execute(
        'SELECT * FROM caes_guia WHERE id = ? AND ativo = true AND (id_usuario = ? OR id_instituicao = ?)',
        [caoId, user.id, user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Cão-guia não encontrado ou inativo.' });
      }

      const caoExistente = rows[0];
      conn.release();

      const validation = caesGuiaSchema.safeParse({ ...req.body, id_instituicao: caoExistente.id_instituicao, id_usuario: caoExistente.id_usuario });
      if (!validation.success) {
        const errorMessages = validation.error.errors.map(err => err.message).join(', ');
        return res.status(400).json({ message: `Erro de validação: ${errorMessages}` });
      }

      const data = validation.data;
      const values = [
        data.nome,
        data.sexo,
        data.cor,
        data.data_nascimento,
        data.raca,
        data.numero_registro
      ];

      let imagemPath: string | null = caoExistente.imagem;

      if (req.file) {
        const processedImage = await processImage(req.file);
        if (processedImage) {
          if (imagemPath) {
            const oldImagePath = path.join(uploadsDir, imagemPath);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }
          imagemPath = processedImage;
        } else {
          return res.status(400).json({ message: 'Erro ao processar a imagem.' });
        }
      }

      conn = await pool.getConnection();
      const [result]: [OkPacket, any] = await conn.execute(
        `UPDATE caes_guia SET nome = ?, sexo = ?, cor = ?, data_nascimento = ?, raca = ?, numero_registro = ?, imagem = ? WHERE id = ? AND ativo = true AND (id_usuario = ? OR id_instituicao = ?)`,
        [...values, imagemPath, caoId, user.id, user.id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Cão-guia não encontrado ou inativo.' });
      }

      res.status(200).json({ message: 'Cão-guia atualizado com sucesso.' });
    } catch (e: any) {
      if (conn) conn.release();
      console.error('Erro ao atualizar cão-guia:', e);
      res.status(500).json({ message: 'Erro ao atualizar cão-guia.', error: e.message });
    }
  } catch (e: unknown) {
    const error = e as Error;
    res.status(400).json({ message: `Erro ao validar solicitação: ${error.message}` });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const caoId = parseInt(req.params.id, 10);

    if (!user) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const [rows]: [RowDataPacket[], any] = await conn.execute(
        'SELECT imagem FROM caes_guia WHERE id = ? AND ativo = true AND (id_usuario = ? OR id_instituicao = ?)',
        [caoId, user.id, user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: 'Cão-guia não encontrado ou já inativo.' });
      }

      const imagemPath = rows[0].imagem;

      const [result]: [OkPacket, any] = await conn.execute(
        'UPDATE caes_guia SET ativo = false WHERE id = ?',
        [caoId]
      );

      
      if (imagemPath) {
        const fullImagePath = path.join(uploadsDir, imagemPath);
        if (fs.existsSync(fullImagePath)) {
          fs.unlinkSync(fullImagePath);
        }
      }

      res.status(200).json({ message: 'Cão-guia inativado com sucesso.' });
    } catch (e: unknown) {
      const error = e as Error;
      res.status(500).json({ message: 'Erro ao inativar cão-guia.', error: error.message });
    } finally {
      if (conn) conn.release();
    }
  } catch (e: unknown) {
    const error = e as Error;
    res.status(400).json({ message: `Erro ao validar solicitação: ${error.message}` });
  }
});

export default router;
