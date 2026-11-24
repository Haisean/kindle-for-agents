import { describe, expect, it } from 'vitest';
import {
  AMAZON_REGION,
  AMAZON_SETTINGS_URL,
  SUPPORTED_AMAZON_REGIONS,
  UnsupportedAmazonRegionError,
  getAmazonSettingsUrl
} from '../src/core/amazon';

describe('Amazon Kindle settings URL', () => {
  it('uses the stable Amazon.com content and devices entry by default', () => {
    expect(AMAZON_REGION).toBe('amazon.com');
    expect(getAmazonSettingsUrl()).toBe('https://www.amazon.com/hz/mycd/myx');
    expect(getAmazonSettingsUrl('AMAZON.COM')).toBe(AMAZON_SETTINGS_URL);
    expect(getAmazonSettingsUrl('  https://www.amazon.com/hz/mycd/myx  ')).toBe(
      AMAZON_SETTINGS_URL
    );
  });

  it('supports active international Amazon Kindle sites', () => {
    expect(SUPPORTED_AMAZON_REGIONS).toEqual([
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
    ]);
    expect(getAmazonSettingsUrl('amazon.co.jp')).toBe(
      'https://www.amazon.co.jp/hz/mycd/myx'
    );
    expect(getAmazonSettingsUrl('AMAZON.CO.UK')).toBe(
      'https://www.amazon.co.uk/hz/mycd/myx'
    );
    expect(getAmazonSettingsUrl('https://www.amazon.de')).toBe(
      'https://www.amazon.de/hz/mycd/myx'
    );
    expect(getAmazonSettingsUrl('www.amazon.com.au')).toBe(
      'https://www.amazon.com.au/hz/mycd/myx'
    );
    expect(getAmazonSettingsUrl('amazon.in')).toBe(
      'https://www.amazon.in/hz/mycd/myx'
    );
  });

  it('rejects the discontinued Amazon.cn Kindle management route', () => {
    expect(() => getAmazonSettingsUrl('amazon.cn')).toThrow(
      UnsupportedAmazonRegionError
    );
    expect(() => getAmazonSettingsUrl('amazon.cn')).toThrow(
      'Amazon.cn Kindle 服务已停运'
    );
    expect(() => getAmazonSettingsUrl('https://www.z.cn')).toThrow(
      'Amazon.cn Kindle 服务已停运'
    );
  });

  it('rejects unknown Amazon domains and lists supported regions', () => {
    expect(() => getAmazonSettingsUrl('amazon.invalid')).toThrow(
      UnsupportedAmazonRegionError
    );
    expect(() => getAmazonSettingsUrl('amazon.invalid')).toThrow(
      'amazon.com, amazon.co.jp, amazon.co.uk'
    );
  });
});
