import { Router, json } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { RowDataPacket, OkPacket } from 'mysql2';
import { userSchema } from '../validators/authValidator'; // Validador para usuários
import { institutionSchema } from '../validators/instituicoesValidator'; // Validador para instituições
import { ZodError } from 'zod';

const router = Router();
router.use(json());

// Função para limpar caracteres não numéricos
const cleanNumberString = (value: string) => value.replace(/[^\d]/g, '');


// Rota de login de usuário (incluindo administrador)
// Login de usuário (incluindo administrador)
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    const [rows]: [RowDataPacket[], any] = await conn.query(
      'SELECT * FROM usuarios WHERE email = ? AND ativo = 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const user = rows[0];

    // Verificar se a senha está correta
    const passwordValid = await bcrypt.compare(senha, user.senha);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Determinar o tipo de usuário
    const userType = user.administrador ? 'ADMIN' : 'PCD';

    // Gerar o token JWT
    const token = jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        administrador: user.administrador,
        tipo: userType,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' } // Token expira em 1 hora
    );

    res.json({ message: 'Login bem-sucedido', token });
  } catch (error: any) {
    console.error('Erro ao fazer login:', error.message);
    res.status(500).json({ message: 'Erro ao fazer login', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});


// Rota de registro de usuário
router.post('/register', async (req, res) => {
  try {
    // Validar os dados do usuário com o Zod
    userSchema.parse(req.body);

    const { nome, email, senha, cpf, sexo, data_nascimento, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, rg, telefone, id_instituicao } = req.body;

    // Criptografar a senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    let conn;
    try {
      conn = await pool.getConnection();

      // Inserir o novo usuário no banco de dados
      const [result] = await conn.query(
        `INSERT INTO usuarios (nome, email, senha, cpf, sexo, data_nascimento, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, rg, telefone, id_instituicao, status_validacao) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
        [nome, email, hashedPassword, cpf, sexo, data_nascimento, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, rg, telefone, id_instituicao]
      );

      res.status(201).json({ message: 'Usuário registrado com sucesso! Cadastro pendente de aprovação.' });
    } catch (error: any) {
      // Tratamento de erros do banco de dados
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('cpf')) {
          return res.status(400).json({ errors: ['O CPF já está cadastrado.'] });
        }
        if (error.sqlMessage.includes('email')) {
          return res.status(400).json({ errors: ['O email já está cadastrado.'] });
        }
        if (error.sqlMessage.includes('rg')) {
          return res.status(400).json({ errors: ['O RG já está cadastrado.'] });
        }
      }

      console.error('Erro ao registrar usuário:', error);
      res.status(500).json({ message: 'Erro ao registrar usuário.' });
    } finally {
      if (conn) conn.release();
    }
  } catch (error: any) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => err.message);
      return res.status(400).json({ errors: formattedErrors });
    }
    console.error('Erro de validação:', error);
    res.status(400).json({ message: 'Erro ao validar dados de registro.', error: error.message });
  }
});



// Rota de registro de instituição
// Rota de registro de instituição
router.post('/register-institution', async (req, res) => {
  try {
    // Validar os dados da instituição com o Zod
    const parsedData = institutionSchema.parse({
      ...req.body,
      cnpj: cleanNumberString(req.body.cnpj),
      endereco_cep: cleanNumberString(req.body.endereco_cep),
    });

    const { razao_social, cnpj, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, email, senha } = parsedData;

    // Criptografar a senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    let conn;
    try {
      conn = await pool.getConnection();

      // Inserir a nova instituição no banco de dados
      const [result] = await conn.query(
        `INSERT INTO instituicoes (razao_social, cnpj, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, email, senha, status_validacao) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
        [razao_social, cnpj, endereco_logradouro, endereco_numero, endereco_complemento, endereco_cep, endereco_cidade, endereco_estado, endereco_bairro, email, hashedPassword]
      );

      res.status(201).json({ message: 'Instituição registrada com sucesso! Cadastro pendente de aprovação.' });
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('cnpj')) {
          return res.status(400).json({ errors: ['O CNPJ já está cadastrado.'] });
        }
        if (error.sqlMessage.includes('email')) {
          return res.status(400).json({ errors: ['O email já está cadastrado.'] });
        }
      }
      console.error('Erro ao registrar instituição:', error);
      res.status(500).json({ message: 'Erro ao registrar instituição.' });
    } finally {
      if (conn) conn.release();
    }
  } catch (error: any) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.map((err) => err.message);
      return res.status(400).json({ errors: formattedErrors });
    }
    console.error('Erro de validação:', error);
    res.status(400).json({ message: 'Erro ao validar dados da instituição.', error: error.message });
  }
});

// Rota de login de instituição
router.post('/login-institution', async (req, res) => {
  const { email, senha } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    const [rows]: [RowDataPacket[], any] = await conn.query(
      'SELECT * FROM instituicoes WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const institution = rows[0];

    // Verifica o status de validação da instituição
    if (institution.status_validacao !== 'aprovado') {
      const statusMessage = institution.status_validacao === 'pendente' ? 'Cadastro em pendência de aprovação.' : 'Cadastro rejeitado.';
      return res.status(403).json({ message: statusMessage });
    }

    const passwordValid = await bcrypt.compare(senha, institution.senha);
    if (!passwordValid) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Gerar o token JWT
    const token = jwt.sign(
      {
        id: institution.id,
        razao_social: institution.razao_social,
        tipo: 'INSTITUICAO',
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login bem-sucedido', token });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro ao fazer login:', errorMessage);
    res.status(500).json({ message: 'Erro ao fazer login', error: errorMessage });
  } finally {
    if (conn) conn.release();
  }
});



export default router;
