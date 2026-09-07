import bcrypt from 'bcryptjs';
import { PasswordVerifier } from '../application/ports';

/**
 * Verificacao de senha do staff. `bcryptjs` (JS puro, sem binario nativo — nao
 * complica o bundle da Lambda) e compativel com os hashes `$2b$` gerados pelo
 * `bcrypt` do monolito, de onde os usuarios migram.
 */
export class BcryptPasswordVerifier implements PasswordVerifier {
  verify(senha: string, hash: string): Promise<boolean> {
    return bcrypt.compare(senha, hash);
  }
}
