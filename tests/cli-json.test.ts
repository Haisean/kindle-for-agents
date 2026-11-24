import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/index';
import { logger } from '../src/core/logger';

describe('CLI --json flag handling and pure stdout JSON output', () => {
  const originalConfigDir = process.env.KINDLE_BRIDGE_CONFIG_DIR;
  const originalStateDir = process.env.KINDLE_BRIDGE_STATE_DIR;
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-cli-json-'));
    process.env.KINDLE_BRIDGE_CONFIG_DIR = path.join(tempDir, 'config');
    process.env.KINDLE_BRIDGE_STATE_DIR = path.join(tempDir, 'state');
  });

  afterEach(() => {
    logger.setJsonMode(false);
    logger.setDebug(false);
    process.exitCode = undefined;
    vi.restoreAllMocks();
    if (originalConfigDir === undefined) delete process.env.KINDLE_BRIDGE_CONFIG_DIR;
    else process.env.KINDLE_BRIDGE_CONFIG_DIR = originalConfigDir;
    if (originalStateDir === undefined) delete process.env.KINDLE_BRIDGE_STATE_DIR;
    else process.env.KINDLE_BRIDGE_STATE_DIR = originalStateDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('emits valid JSON when --json is passed after subcommand (kindle capability --json)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createProgram();

    await program.parseAsync(['node', 'kindle', 'capability', '--json']);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const rawOutput = String(logSpy.mock.calls[0][0]);
    const parsed = JSON.parse(rawOutput) as { ok: boolean; data: { installed: boolean } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.installed).toBe(true);
  });

  it('emits valid JSON when --json is passed before subcommand (kindle --json capability)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createProgram();

    await program.parseAsync(['node', 'kindle', '--json', 'capability']);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const rawOutput = String(logSpy.mock.calls[0][0]);
    const parsed = JSON.parse(rawOutput) as { ok: boolean; data: { installed: boolean } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.installed).toBe(true);
  });

  it('suppresses human stdout logs in jsonMode while routing debug logs to stderr', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.setJsonMode(true);
    logger.setDebug(true);

    logger.info('human progress output');
    logger.warn('human warning output');
    logger.error('human error output');
    logger.debug('debug trace for reader@example.com');

    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain('[DEBUG]');
    expect(String(errorSpy.mock.calls[0][0])).toContain('r***@example.com');

    logger.setJsonMode(false);
    logger.setDebug(false);
    logger.info('restored stdout info');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(String(logSpy.mock.calls[0][0])).toBe('restored stdout info');
  });
});
