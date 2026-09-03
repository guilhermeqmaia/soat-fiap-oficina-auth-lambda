import { isValidCpf, maskCpf, normalizeCpf } from './cpf';

describe('normalizeCpf', () => {
  it('remove pontuação e mantém apenas dígitos', () => {
    expect(normalizeCpf('111.444.777-35')).toBe('11144477735');
  });
});

describe('isValidCpf', () => {
  it.each(['11144477735', '111.444.777-35', '529.982.247-25'])(
    'aceita CPF válido %s',
    (cpf) => expect(isValidCpf(cpf)).toBe(true),
  );

  it.each([
    ['11144477734', 'segundo dígito verificador errado'],
    ['11144477745', 'primeiro dígito verificador errado'],
    ['11111111111', 'todos os dígitos iguais'],
    ['00000000000', 'zeros'],
    ['123', 'curto demais'],
    ['123456789012', 'longo demais'],
    ['', 'vazio'],
    ['abcdefghijk', 'não numérico'],
  ])('rejeita %s (%s)', (cpf) => expect(isValidCpf(cpf)).toBe(false));
});

describe('maskCpf', () => {
  it('mantém apenas os dígitos verificadores', () => {
    expect(maskCpf('111.444.777-35')).toBe('***.***.***-35');
  });

  it('não vaza nada de entradas malformadas', () => {
    expect(maskCpf('123')).toBe('***');
  });
});
