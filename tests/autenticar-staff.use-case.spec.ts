import { AutenticarStaffUseCase } from '../src/application/autenticar-staff.use-case';
import {
  PasswordVerifier,
  TokenIssuer,
  Usuario,
  UsuarioRepository,
} from '../src/application/ports';
import {
  CredenciaisInvalidasError,
  InvalidCpfError,
  MissingCpfError,
  MissingSenhaError,
  UsuarioInativoError,
  UsuarioNaoEncontradoError,
} from '../src/domain/errors';

const CPF_VALIDO = '52998224725';

const usuarioAtivo: Usuario = {
  id: 'u1',
  nome: 'Joao Mecanico',
  cpf: CPF_VALIDO,
  role: 'MECANICO',
  ativo: true,
  senhaHash: '$2b$10$hash-qualquer',
};

function makeUseCase(usuario: Usuario | null, senhaConfere = true) {
  const usuarios: UsuarioRepository = { findByCpf: jest.fn().mockResolvedValue(usuario) };
  const senhas: PasswordVerifier = { verify: jest.fn().mockResolvedValue(senhaConfere) };
  const tokens: TokenIssuer = {
    issue: jest.fn().mockImplementation(({ role }: { role: string }) =>
      Promise.resolve({
        token: 'jwt-token',
        tokenType: 'Bearer',
        expiresAt: '2030-01-01T00:00:00.000Z',
        claims: {
          sub: 'u1',
          cpf: CPF_VALIDO,
          nome: 'Joao Mecanico',
          role,
          iss: 'i',
          iat: 1,
          exp: 2,
        },
      }),
    ),
    verify: jest.fn(),
  };
  return {
    useCase: new AutenticarStaffUseCase(usuarios, senhas, tokens),
    usuarios,
    senhas,
    tokens,
  };
}

describe('AutenticarStaffUseCase', () => {
  it('emite token com a role do usuario para staff ativo com senha correta', async () => {
    const { useCase, usuarios, tokens } = makeUseCase(usuarioAtivo);

    const result = await useCase.execute({ cpf: '529.982.247-25', senha: 's3nh4' });

    expect(usuarios.findByCpf).toHaveBeenCalledWith(CPF_VALIDO);
    expect(tokens.issue).toHaveBeenCalledWith({
      cliente: { id: 'u1', nome: 'Joao Mecanico', cpf: CPF_VALIDO },
      role: 'MECANICO',
    });
    expect(result.usuario).toEqual({
      id: 'u1',
      nome: 'Joao Mecanico',
      cpf: CPF_VALIDO,
      role: 'MECANICO',
    });
  });

  it.each([undefined, null, ''])('exige o campo cpf (%p)', async (cpf) => {
    const { useCase } = makeUseCase(usuarioAtivo);
    await expect(useCase.execute({ cpf, senha: 's3nh4' })).rejects.toBeInstanceOf(MissingCpfError);
  });

  it('rejeita CPF com digitos verificadores invalidos antes de consultar a base', async () => {
    const { useCase, usuarios } = makeUseCase(usuarioAtivo);
    await expect(useCase.execute({ cpf: '52998224724', senha: 's3nh4' })).rejects.toBeInstanceOf(
      InvalidCpfError,
    );
    expect(usuarios.findByCpf).not.toHaveBeenCalled();
  });

  it.each(['', 123, null])('exige senha nao vazia em string (%p)', async (senha) => {
    const { useCase } = makeUseCase(usuarioAtivo);
    await expect(useCase.execute({ cpf: CPF_VALIDO, senha })).rejects.toBeInstanceOf(
      MissingSenhaError,
    );
  });

  it('404 quando nao ha usuario associado ao CPF', async () => {
    const { useCase } = makeUseCase(null);
    await expect(useCase.execute({ cpf: CPF_VALIDO, senha: 's3nh4' })).rejects.toBeInstanceOf(
      UsuarioNaoEncontradoError,
    );
  });

  it('403 para usuario inativo — sem verificar a senha', async () => {
    const { useCase, senhas } = makeUseCase({ ...usuarioAtivo, ativo: false });
    await expect(useCase.execute({ cpf: CPF_VALIDO, senha: 's3nh4' })).rejects.toBeInstanceOf(
      UsuarioInativoError,
    );
    expect(senhas.verify).not.toHaveBeenCalled();
  });

  it('403 CREDENCIAIS_INVALIDAS para senha incorreta, sem revelar qual credencial falhou', async () => {
    const { useCase } = makeUseCase(usuarioAtivo, false);
    const rejeicao = useCase.execute({ cpf: CPF_VALIDO, senha: 'errada' });
    await expect(rejeicao).rejects.toBeInstanceOf(CredenciaisInvalidasError);
    await expect(rejeicao).rejects.toMatchObject({ status: 403, code: 'CREDENCIAIS_INVALIDAS' });
  });
});
