import { Router, json, Request, Response } from 'express';
import pool from '../config/database';
import { RowDataPacket, OkPacket } from 'mysql2';
import { userSchema } from '../validators/authValidator';
import authMiddleware from '../middlewares/authMiddleware'; // Importar o middleware de autenticação

const router = Router();
router.use(json());

const tableName = 'usuarios';

// Obter os dados do usuário autenticado
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const [rows]: [RowDataPacket[], any] = await conn.execute(
      `SELECT * FROM ${tableName} WHERE id=? AND ativo=1`, // Corrigido para ativo=1
      [userId]
    );
    if (rows.length <= 0) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    const user = rows[0];
    delete user.senha; // Remover a senha antes de enviar os dados
    res.json(user);
  } catch (e) {
    console.error('Erro ao obter dados do usuário autenticado:', e);
    res.status(500).json(e);
  } finally {
    if (conn) conn.release();
  }
});

// Obter um usuário específico
router.get('/:id', async (req: Request, res: Response) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows]: [RowDataPacket[], any] = await conn.execute(
      `SELECT * FROM ${tableName} WHERE id=? AND ativo=true`,
      [req.params.id]
    );
    if (rows.length <= 0) {
      res.status(404).json({ message: 'Usuário não encontrado' });
      return;
    }
    res.json(rows[0]);
  } catch (e) {
    console.error('Erro ao obter usuário:', e);
    res.status(500).json(e);
  } finally {
    if (conn) conn.release();
  }
});

// Inserir um novo usuário
router.post('/', async (req: Request, res: Response) => {
  try {
    userSchema.parse(req.body);
    const insCols = Object.keys(req.body);
    const values = Object.values(req.body);
    let conn;
    try {
      conn = await pool.getConnection();
      const [result]: [OkPacket, any] = await conn.execute(
        `INSERT INTO ${tableName} (${insCols.join(", ")}) VALUES (${insCols.map(() => "?").join(", ")})`,
        values
      );
      res.status(201).json(result); // Retornar 201 Created
    } catch (e) {
      console.error('Erro ao inserir usuário:', e);
      res.status(500).json(e);
    } finally {
      if (conn) conn.release();
    }
  } catch (e: any) {
    console.error('Erro ao validar dados do usuário:', e);
    return res.status(400).send(e.message);
  }
});

// Excluir (inativar) um usuário específico
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  let conn;
  try {
    conn = await pool.getConnection();

    // Verificar se o usuário autenticado é o mesmo que está sendo excluído ou se é administrador
    if (req.user?.id !== parseInt(req.params.id) && !req.user?.administrador) {
      return res.status(403).json({ message: 'Permissão negada' });
    }

    const [result]: [OkPacket, any] = await conn.execute(
      `UPDATE ${tableName} SET ativo=false WHERE id=?`,
      [req.params.id]
    );
    res.json(result);
  } catch (e) {
    console.error('Erro ao inativar usuário:', e);
    res.status(500).json(e);
  } finally {
    if (conn) conn.release();
  }
});

// Atualizar um usuário específico
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.params.id;

  // Verificar se o usuário autenticado é o mesmo que está sendo atualizado ou se é administrador
  if (req.user?.id !== parseInt(userId) && !req.user?.administrador) {
    return res.status(403).json({ message: 'Permissão negada' });
  }

  const { nome, email, cpf, sexo, data_nascimento, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, rg, telefone } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `UPDATE usuarios SET nome=?, email=?, cpf=?, sexo=?, data_nascimento=?, endereco_logradouro=?, endereco_numero=?, endereco_complemento=?, endereco_cep=?, endereco_cidade=?, endereco_estado=?, endereco_bairro=?, rg=?, telefone=? WHERE id=? AND ativo=true`;
    const values = [nome, email, cpf, sexo, data_nascimento, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, rg, telefone, userId];
    const [result]: [OkPacket, any] = await conn.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado ou inativo.' });
    }
    res.status(200).json({ message: 'Usuário atualizado com sucesso.' });
  } catch (e) {
    console.error('Erro ao atualizar usuário:', e);
    res.status(500).json({ message: 'Erro ao atualizar usuário.' });
  } finally {
    if (conn) conn.release();
  }
});


// Atualizar o perfil do usuário autenticado
// Atualizar o perfil do usuário autenticado
router.put('/me', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.id; // O ID do usuário autenticado, definido no middleware

  if (!userId) {
    return res.status(401).json({ message: 'Usuário não autenticado' });
  }

  const { nome, email, cpf, sexo, data_nascimento, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, rg, telefone } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();

    // Verificar se o usuário ainda está ativo
    const [userRows]: [RowDataPacket[], any] = await conn.query(
      `SELECT * FROM ${tableName} WHERE id=? AND ativo=1`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado ou inativo.' });
    }

    // Atualizar os dados do usuário
    const query = `
      UPDATE ${tableName} 
      SET nome=?, email=?, cpf=?, sexo=?, data_nascimento=?, endereco_logradouro=?, endereco_numero=?, endereco_complemento=?, endereco_cep=?, endereco_cidade=?, endereco_estado=?, endereco_bairro=?, rg=?, telefone=? 
      WHERE id=? AND ativo=true
    `;
    const values = [nome, email, cpf, sexo, data_nascimento, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, rg, telefone, userId];

    const [result]: [OkPacket, any] = await conn.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nenhum dado foi atualizado.' });
    }

    res.status(200).json({ message: 'Perfil atualizado com sucesso.' });
  } catch (e) {
    console.error('Erro ao atualizar perfil:', e);
    res.status(500).json({ message: 'Erro ao atualizar perfil.' });
  } finally {
    if (conn) conn.release();
  }
});



export default router;
