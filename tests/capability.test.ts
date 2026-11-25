import type * as ChildProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const keychainMock = vi.hoisted(() => ({
  value: ''
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcess>();
  return {
    ...actual,
    spawnSync: ((
      executable: string,
      args?: readonly string[],
      options?: ChildProcess.SpawnSyncOptions
    ) => {
      if (process.platform === 'darwin' && executable === 'security') {
        const op = args?.[0];
        if (op === '-i') {
          const inputStr = typeof options?.input === 'string' ? options.input : '';
          const m = inputStr.match(/(?:^|\s)-w\s+(\S+)/);
          if (!m) {
            return { status: 1, stdout: '', stderr: 'missing password' };
          }
          keychainMock.value = m[1];
          return { status: 0, stdout: '', stderr: '' };
        }
        if (op === 'find-generic-password') {
          return keychainMock.value
            ? { status: 0, stdout: keychainMock.value, stderr: '' }
            : { status: 44, stdout: '', stderr: 'could not be found' };
        }
        if (op === 'delete-generic-password') {
          keychainMock.value = '';
          return { status: 0, stdout: '', stderr: '' };
        }
      }
      return actual.spawnSync(executable, args as string[], options ?? {});
    }) as typeof actual.spawnSync
  };
});

import { getCapabilityStatus } from '../src/core/capability';
import { clearConfig, saveConfig } from '../src/core/config';
import { clearCredentials, saveCredentials } from '../src/core/credentials';

describe('Kindle capability state', () => {
  const originalConfigDir = process.env.KINDLE_BRIDGE_CONFIG_DIR;
  let tempConfigDir = '';

  beforeEach(() => {
    tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-capability-'));
    process.env.KINDLE_BRIDGE_CONFIG_DIR = tempConfigDir;
    keychainMock.value = '';
  });

  afterEach(() => {
    clearCredentials();
    clearConfig();
    if (originalConfigDir === undefined) delete process.env.KINDLE_BRIDGE_CONFIG_DIR;
    else process.env.KINDLE_BRIDGE_CONFIG_DIR = originalConfigDir;
    fs.rmSync(tempConfigDir, { recursive: true, force: true });
  });

  it('starts in needs_setup without state or credentials', () => {
    expect(getCapabilityStatus()).toMatchObject({
      state: 'needs_setup',
      ready: false,
      credentialsAvailable: false,
      deviceVerified: false
    });
  });

  it('does not become ready until the setup test is device-confirmed', () => {
    saveCredentials({
      smtpHost: 'smtp.example.com',
      smtpPort: 465,
      smtpUser: 'reader@example.com',
      smtpPass: 'secret-auth-code',
      kindleEmail: 'reader@kindle.com'
    });
    saveConfig({
      connectedAt: new Date().toISOString(),
      capabilityState: 'awaiting_device_confirmation',
      deviceVerified: false,
      transport: 'smtp'
    });

    expect(getCapabilityStatus()).toMatchObject({
      state: 'awaiting_device_confirmation',
      ready: false,
      credentialsAvailable: true
    });

    saveConfig({
      capabilityState: 'ready',
      deviceVerified: true,
      lastVerifiedAt: new Date().toISOString()
    });

    expect(getCapabilityStatus()).toMatchObject({
      state: 'ready',
      ready: true,
      credentialsAvailable: true,
      deviceVerified: true
    });
  }, 15000);
});
