import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 100, 
  message: 'Muitas requisições deste IP, por favor tente novamente mais tarde.'
});

export default limiter;