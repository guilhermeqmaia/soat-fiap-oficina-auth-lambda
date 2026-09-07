// Invoca o handler localmente (sem Docker/RIE) usando o build de dist/.
// Uso: node scripts/local-invoke.mjs [cpf]
// Requer as variaveis do .env carregadas (o launch.json do VS Code usa envFile).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { auth } = require('../dist/index.js');

const cpf = process.argv[2] ?? '52998224725';

const response = await auth({ body: JSON.stringify({ cpf }) });
console.log(response.statusCode, response.body);
