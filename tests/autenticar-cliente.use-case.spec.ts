import { AutenticarClienteUseCase } from '../src/application/autenticar-cliente.use-case';
import { Cliente, ClienteRepository, TokenIssuer } from '../src/application/ports';
import {
  ClienteInativoError,
  ClienteNaoEncontradoError,
  InvalidCpfError,
  MissingCpfError,
} from '../src/domain/errors';

const CPF_VALIDO = '52998224725';

const clienteAtivo: Cliente = {
  id: 'c1',
  nome: 'Ana Souza',
  cpf: '529.982.247-25',
  status: 'ATIVO',
  ativo: true,
};

function makeUseCase(cliente: Cliente | null) {
  const clientes: ClienteRepository = { findByCpf: jest.fn().mockResolvedValue(cliente) };
  const tokens: TokenIssuer = {
    issue: jest.fn().mockImplementation(({ role }: { role: string }) =>
      Promise.resolve({
        token: 'jwt-token',
        tokenType: 'Bearer',
        expiresAt: '2030-01-01T00:00:00.000Z',
        claims: { sub: 'c1', cpf: CPF_VALIDO, nome: 'Ana Souza', role, iss: 'i', iat: 1, exp: 2 },
      }),
    ),
    verify: jest.fn(),
  };
  return { useCase: new AutenticarClienteUseCase(clientes, tokens, 'CLIENTE'), clientes, tokens };
}

describe('AutenticarClienteUseCase', () => {
  it('emite token para cliente ativo e consulta a base com o CPF sem mascara', async () => {
    const { useCase, clientes } = makeUseCase(clienteAtivo);

    const result = await useCase.execute({ cpf: '529.982.247-25' });

    expect(clientes.findByCpf).toHaveBeenCalledWith(CPF_VALIDO);
    expect(result.accessToken).toBe('jwt-token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.cliente).toEqual({
      id: 'c1',
      nome: 'Ana Souza',
      cpf: CPF_VALIDO,
      role: 'CLIENTE',
    });
  });

  it('aceita CPF enviado como numero', async () => {
    const { useCase, clientes } = makeUseCase(clienteAtivo);
    await useCase.execute({ cpf: Number(CPF_VALIDO) });
    expect(clientes.findByCpf).toHaveBeenCalledWith(CPF_VALIDO);
  });

  it.each([undefined, null, ''])('exige o campo cpf (%p)', async (cpf) => {
    const { useCase } = makeUseCase(clienteAtivo);
    await expect(useCase.execute({ cpf })).rejects.toBeInstanceOf(MissingCpfError);
  });

  it('rejeita cpf de tipo invalido', async () => {
    const { useCase } = makeUseCase(clienteAtivo);
    await expect(useCase.execute({ cpf: { valor: CPF_VALIDO } })).rejects.toBeInstanceOf(
      InvalidCpfError,
    );
  });

  it('rejeita CPF com digito verificador invalido (422)', async () => {
    const { useCase, clientes } = makeUseCase(clienteAtivo);
    await expect(useCase.execute({ cpf: '52998224724' })).rejects.toMatchObject({ status: 422 });
    expect(clientes.findByCpf).not.toHaveBeenCalled();
  });

  it('404 quando o cliente nao existe', async () => {
    const { useCase } = makeUseCase(null);
    await expect(useCase.execute({ cpf: CPF_VALIDO })).rejects.toBeInstanceOf(
      ClienteNaoEncontradoError,
    );
  });

  it('403 quando o cliente esta inativo', async () => {
    const { useCase } = makeUseCase({ ...clienteAtivo, status: 'BLOQUEADO', ativo: false });
    await expect(useCase.execute({ cpf: CPF_VALIDO })).rejects.toBeInstanceOf(ClienteInativoError);
  });
});
