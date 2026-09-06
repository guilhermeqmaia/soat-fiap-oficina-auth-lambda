import { Logger } from '../src/shared/logger';

describe('Logger', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  it('emite JSON de uma linha com contexto herdado', () => {
    new Logger('info', { requestId: 'req-1' }).info('ok', { clienteId: 'c1' });

    const entry = JSON.parse(log.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(entry).toMatchObject({
      level: 'INFO',
      message: 'ok',
      service: 'oficina-auth-lambda',
      requestId: 'req-1',
      clienteId: 'c1',
    });
    expect(typeof entry['timestamp']).toBe('string');
  });

  it('child acumula contexto sem alterar o pai', () => {
    const pai = new Logger('info', { a: 1 });
    pai.child({ b: 2 }).info('filho');
    pai.info('pai');

    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toMatchObject({ a: 1, b: 2 });
    expect(JSON.parse(log.mock.calls[1]?.[0] as string)['b']).toBeUndefined();
  });

  it('respeita o nivel configurado', () => {
    const logger = new Logger('warn');
    logger.debug('nao sai');
    logger.info('nao sai');
    logger.warn('sai');
    logger.error('sai');

    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('emite debug quando o nivel permite', () => {
    new Logger('debug').debug('detalhe');
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toMatchObject({ level: 'DEBUG' });
  });
});
