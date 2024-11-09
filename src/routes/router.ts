import { Router } from 'express';
import auth from '../controllers/auth';
import usuarios from '../controllers/usuarios';
import instituicoes from '../controllers/instituicoes';
import caesguia from '../controllers/caes-guia';
import validacoes from '../controllers/validacoes';
import administradores from '../controllers/administradores';
import { gerarCarteira, buscarCarteiraPorCao, buscarCarteiraPorCodigo } from '../controllers/carteira'; 
import authMiddleware from '../middlewares/authMiddleware';

const router = Router();

router.use('/auth', auth);
router.use('/usuarios', authMiddleware, usuarios);
router.use('/instituicoes', authMiddleware, instituicoes);
router.use('/caes-guia', authMiddleware, caesguia);
router.use('/validacoes', authMiddleware, validacoes);
router.use('/administradores', authMiddleware, administradores);

router.post('/carteira/gerar-carteira', authMiddleware, gerarCarteira);
router.get('/carteira/:idCao', authMiddleware, buscarCarteiraPorCao);
router.get('/carteira/codigo/:codigo', authMiddleware, buscarCarteiraPorCodigo);

export default router;
