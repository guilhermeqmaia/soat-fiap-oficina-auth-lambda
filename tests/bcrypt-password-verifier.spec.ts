import bcrypt from 'bcryptjs';
import { BcryptPasswordVerifier } from '../src/infra/bcrypt-password-verifier';

describe('BcryptPasswordVerifier', () => {
  const verifier = new BcryptPasswordVerifier();

  it('aceita a senha correta contra hash $2b$ (formato do bcrypt do monolito)', async () => {
    const hash = bcrypt.hashSync('s3nh4-f0rte', 10);
    await expect(verifier.verify('s3nh4-f0rte', hash)).resolves.toBe(true);
  });

  it('rejeita senha incorreta', async () => {
    const hash = bcrypt.hashSync('s3nh4-f0rte', 10);
    await expect(verifier.verify('outra-senha', hash)).resolves.toBe(false);
  });
});
