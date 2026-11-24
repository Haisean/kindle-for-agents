export const AMAZON_REGION = 'amazon.com';
export const AMAZON_SETTINGS_URL = 'https://www.amazon.com/hz/mycd/myx';

export const SUPPORTED_AMAZON_REGIONS = [
  'amazon.com',
  'amazon.co.jp',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.it',
  'amazon.es',
  'amazon.ca',
  'amazon.com.au',
  'amazon.in'
] as const;

export type AmazonRegion = (typeof SUPPORTED_AMAZON_REGIONS)[number];

const AMAZON_SETTINGS_URLS: Record<AmazonRegion, string> = {
  'amazon.com': AMAZON_SETTINGS_URL,
  'amazon.co.jp': 'https://www.amazon.co.jp/hz/mycd/myx',
  'amazon.co.uk': 'https://www.amazon.co.uk/hz/mycd/myx',
  'amazon.de': 'https://www.amazon.de/hz/mycd/myx',
  'amazon.fr': 'https://www.amazon.fr/hz/mycd/myx',
  'amazon.it': 'https://www.amazon.it/hz/mycd/myx',
  'amazon.es': 'https://www.amazon.es/hz/mycd/myx',
  'amazon.ca': 'https://www.amazon.ca/hz/mycd/myx',
  'amazon.com.au': 'https://www.amazon.com.au/hz/mycd/myx',
  'amazon.in': 'https://www.amazon.in/hz/mycd/myx'
};

const DISCONTINUED_CN_DOMAINS = new Set(['amazon.cn', 'z.cn']);

function normalizeAmazonRegion(region: string): string {
  return region
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function formatUnsupportedAmazonRegionMessage(region: string): string {
  const normalized = normalizeAmazonRegion(region);
  const supportedList = SUPPORTED_AMAZON_REGIONS.join(', ');

  if (DISCONTINUED_CN_DOMAINS.has(normalized)) {
    return `Amazon.cn Kindle 服务已停运（${region}），不再支持中国区 Kindle 管理地址；请改用支持的 Amazon 区域：${supportedList}`;
  }

  return `不支持的 Amazon 区域：${region}。当前支持的区域包括：${supportedList}`;
}

export class UnsupportedAmazonRegionError extends Error {
  constructor(region: string) {
    super(formatUnsupportedAmazonRegionMessage(region));
    this.name = 'UnsupportedAmazonRegionError';
  }
}

export function getAmazonSettingsUrl(region: string = AMAZON_REGION): string {
  const normalizedRegion = normalizeAmazonRegion(region);
  if (Object.prototype.hasOwnProperty.call(AMAZON_SETTINGS_URLS, normalizedRegion)) {
    return AMAZON_SETTINGS_URLS[normalizedRegion as AmazonRegion];
  }
  throw new UnsupportedAmazonRegionError(region);
}
