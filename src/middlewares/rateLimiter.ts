import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limita cada IP a 100 requisições por windowMs
  message: 'Muitas requisições deste IP, por favor tente novamente mais tarde.'
});

export default limiter;