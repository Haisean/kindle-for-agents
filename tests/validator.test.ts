import fs from 'fs';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';
import { validateEpub } from '../src/converter/validator';

describe('EPUB Validator', () => {
  it('should return error for non-existent file', async () => {
    const res = await validateEpub(path.join(__dirname, 'non_existent.epub'));
    expect(res.valid).toBe(false);
    expect(res.issues[0].message).toContain('不存在');
  });

  it('should resolve OPF from container.xml rootfile outside OEBPS/', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-validator-test-'));
    const epubPath = path.join(tempDir, 'custom-rootfile.epub');
    try {
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file(
        'META-INF/container.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
      );
      zip.file(
        'EPUB/package.opf',
        `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Custom Rootfile Book</dc:title>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="c1"/></spine>
</package>`
      );
      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(epubPath, buf);

      const res = await validateEpub(epubPath);
      expect(res.valid).toBe(true);
      expect(res.issues).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
