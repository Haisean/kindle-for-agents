import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearJobs, createJob, getJob, listRecentJobs, updateJobStatus } from '../src/core/tracker';

describe('Job tracker output lifecycle', () => {
  const originalStateDir = process.env.KINDLE_BRIDGE_STATE_DIR;
  let tempStateDir = '';

  beforeEach(() => {
    tempStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-bridge-jobs-'));
    process.env.KINDLE_BRIDGE_STATE_DIR = tempStateDir;
  });

  afterEach(() => {
    if (originalStateDir === undefined) delete process.env.KINDLE_BRIDGE_STATE_DIR;
    else process.env.KINDLE_BRIDGE_STATE_DIR = originalStateDir;
    fs.rmSync(tempStateDir, { recursive: true, force: true });
  });

  it('removes a stale output path after a temporary EPUB is cleaned up', () => {
    const job = createJob('sample.md', undefined, undefined, 'dry_run');
    expect(job.kind).toBe('dry_run');
    updateJobStatus(job.jobId, 'validated', 'validated', { outputPath: 'temporary.epub' });
    updateJobStatus(job.jobId, 'validated', 'cleaned', { outputPath: null });

    expect(getJob(job.jobId)?.outputPath).toBeUndefined();
  });

  it('records setup tests separately from daily deliveries', () => {
    const setup = createJob('test.epub', 'Setup test', undefined, 'setup_test');
    const delivery = createJob('article.md');

    expect(getJob(setup.jobId)?.kind).toBe('setup_test');
    expect(getJob(delivery.jobId)?.kind).toBe('delivery');
  });

  it('clears local job history for a fresh onboarding test', () => {
    createJob('first.md');
    createJob('second.md');

    expect(clearJobs()).toBe(2);
    expect(listRecentJobs()).toEqual([]);
  });
});
