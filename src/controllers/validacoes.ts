import { Router } from 'express';
import pool from '../config/database';
import adminMiddleware from '../middlewares/adminMiddleware';
import { RowDataPacket } from 'mysql2';

const router = Router();
router.use(adminMiddleware);

router.get('/listar/:tipo/:status', async (req, res) => {
  const { tipo, status } = req.params;
  let tableName;

  if (tipo === 'usuarios') {
    tableName = 'usuarios';
  } else if (tipo === 'instituicoes') {
    tableName = 'instituicoes';
  } else {
    return res.status(400).json({ message: 'Tipo inválido. Use "usuarios" ou "instituicoes".' });
  }

  try {
    const [rows]: [RowDataPacket[], any] = await pool.query(
      `SELECT * FROM ${tableName} WHERE status_validacao = ?`,
      [status]
    );
    res.json(rows);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    res.status(500).json({ message: 'Erro ao listar registros', error: errorMessage });
  }
});

router.post('/validar-usuario/:id', async (req, res) => {
  const { id } = req.params;
  const { status, motivo_rejeicao } = req.body;

  if (!['aprovado', 'rejeitado', 'pendente'].includes(status)) {
    return res.status(400).json({ message: 'Status inválido.' });
  }

  try {
    await pool.query('UPDATE usuarios SET status_validacao = ?, motivo_rejeicao = ? WHERE id = ?', [
      status,
      motivo_rejeicao,
      id,
    ]);
    res.json({ message: 'Status do usuário atualizado com sucesso.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    res.status(500).json({ message: 'Erro ao atualizar status do usuário', error: errorMessage });
  }
});

router.post('/validar-instituicao/:id', async (req, res) => {
  const { id } = req.params;
  const { status, motivo_rejeicao } = req.body;

  if (!['aprovado', 'rejeitado', 'pendente'].includes(status)) {
    return res.status(400).json({ message: 'Status inválido.' });
  }

  try {
    await pool.query('UPDATE instituicoes SET status_validacao = ?, motivo_rejeicao = ? WHERE id = ?', [
      status,
      motivo_rejeicao,
      id,
    ]);
    res.json({ message: 'Status da instituição atualizado com sucesso.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    res.status(500).json({ message: 'Erro ao atualizar status da instituição', error: errorMessage });
  }
});

export default router;
