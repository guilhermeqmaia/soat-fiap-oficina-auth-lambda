import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from '../src/domain/cpf';

describe('CPF', () => {
  it('normaliza removendo mascara', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizeCpf(' 529 982 247 25 ')).toBe('52998224725');
  });

  it.each(['52998224725', '529.982.247-25', '11144477735', '01234567890'])(
    'aceita CPF valido %s',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    },
  );

  it.each([
    ['tamanho menor', '123'],
    ['tamanho maior', '529982247250'],
    ['digito verificador errado', '52998224724'],
    ['segundo digito errado', '11144477731'],
    ['sequencia repetida', '11111111111'],
    ['zeros', '00000000000'],
    ['vazio', ''],
    ['nao numerico', 'abcdefghijk'],
  ])('rejeita CPF invalido (%s)', (_caso, cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });

  it('mascara o CPF para log sem expor os digitos do meio', () => {
    expect(maskCpf('52998224725')).toBe('***.***.***-25');
    expect(maskCpf('529.982.247-25')).toBe('***.***.***-25');
    expect(maskCpf('123')).toBe('***');
  });

  it('formata para exibicao', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('123')).toBe('123');
  });
});
