import { Request, Response } from 'express';
import pool from '../config/database';
const QRCode: any = require('qrcode'); 
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { RowDataPacket } from 'mysql2';

export const gerarCarteira = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { idCao } = req.body;

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  const codigo = uuidv4().slice(0, 10);
  const qrCodeFileName = `${codigo}.png`;
  const qrCodePath = path.join(__dirname, '../../uploads/qrcodes', qrCodeFileName);

  try {
    await QRCode.toFile(qrCodePath, `http://localhost:5173/carteira/${codigo}`);

    const conn = await pool.getConnection();
    const [existingCarteira]: [RowDataPacket[], any] = await conn.execute(
      'SELECT * FROM carteiras WHERE id_cao = ?',
      [idCao]
    );

    if (existingCarteira.length === 0) {
      await conn.execute(
        'INSERT INTO carteiras (id_usuario, id_cao, codigo, qr_code_path) VALUES (?, ?, ?, ?)',
        [userId, idCao, codigo, qrCodeFileName]
      );
    } else {
      conn.release();
      return res.status(400).json({ message: 'Carteira já existe para este cão.' });
    }

    conn.release();
    res.status(201).json({ codigo, qr_code_path: `uploads/qrcodes/${qrCodeFileName}` });
  } catch (error) {
    console.error('Erro ao gerar a carteira:', error);
    res.status(500).json({ message: 'Erro ao gerar a carteira.' });
  }
};

export const buscarCarteiraPorCao = async (req: Request, res: Response) => {
  const { idCao } = req.params;

  try {
    const conn = await pool.getConnection();
    const [carteira]: [RowDataPacket[], any] = await conn.execute(
      'SELECT * FROM carteiras WHERE id_cao = ?',
      [idCao]
    );
    conn.release();

    if (carteira.length === 0) {
      return res.status(404).json({ message: 'Carteira não encontrada.' });
    }

    res.json(carteira[0]);
  } catch (error) {
    console.error('Erro ao buscar carteira:', error);
    res.status(500).json({ message: 'Erro ao buscar a carteira.' });
  }
};

export const buscarCarteiraPorCodigo = async (req: Request, res: Response) => {
  const { codigo } = req.params;

  try {
    const conn = await pool.getConnection();
    const [carteira]: [RowDataPacket[], any] = await conn.execute(
      `SELECT 
         carteiras.*, 
         usuarios.nome AS usuario_nome, 
         usuarios.cpf AS usuario_cpf, 
         caes_guia.nome AS cao_nome, 
         caes_guia.numero_registro 
       FROM carteiras 
       JOIN usuarios ON carteiras.id_usuario = usuarios.id 
       JOIN caes_guia ON carteiras.id_cao = caes_guia.id 
       WHERE carteiras.codigo = ?`,
      [codigo]
    );
    conn.release();

    if (carteira.length === 0) {
      return res.status(404).json({ message: 'Carteira não encontrada.' });
    }

    res.json(carteira[0]); 
  } catch (error) {
    console.error('Erro ao buscar carteira:', error);
    res.status(500).json({ message: 'Erro ao buscar a carteira.' });
  }
};
