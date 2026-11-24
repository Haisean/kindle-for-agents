import path from 'path';
import fs from 'fs';
import { logger } from '../core/logger';
import { AMAZON_REGION, getAmazonSettingsUrl } from '../core/amazon';
import { getProductStateDir } from '../core/paths';
import { openInSystemBrowser } from './external-browser';

export function getBrowserProfileDir(): string {
  // Keep the historical storage key so the dedicated browser profile path stays stable if needed.
  const profileDir = path.join(getProductStateDir(), 'browser-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  return profileDir;
}

export function launchAmazonWizard(region: string = AMAZON_REGION): string {
  const amazonUrl = getAmazonSettingsUrl(region);
  logger.info('🌐 正在使用系统默认浏览器打开 Amazon Send-to-Kindle 设置页...');
  logger.info(`  目标网址: ${amazonUrl}`);
  openInSystemBrowser(amazonUrl);
  return amazonUrl;
}
