import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Função para gerar um segredo seguro
const generateSecret = (length: number = 64): string => {
  return crypto.randomBytes(length).toString('base64');
};

// Função para garantir que o segredo exista no arquivo .env
const ensureSecretInEnv = (key: string, defaultValue: string): void => {
  if (!process.env[key]) {
    fs.appendFileSync('.env', `\n${key}=${defaultValue}`);
  }
};

// Gera e assegura que os segredos estejam definidos
const jwtSecret = generateSecret();
const salt = generateSecret(16);

ensureSecretInEnv('JWT_SECRET', jwtSecret);
ensureSecretInEnv('SALT', salt);

console.log('Segredos garantidos no arquivo .env');