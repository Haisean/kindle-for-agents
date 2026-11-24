import os from 'os';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { parseInputFile } from '../src/converter/parser';
import { buildEpub } from '../src/converter/epub-builder';
import { validateEpub } from '../src/converter/validator';

describe('Converter & EPUB Pipeline', () => {
  const sampleMdPath = path.resolve(__dirname, '../test-fixtures/sample.md');
  const tempEpubPath = path.resolve(__dirname, '../test-fixtures/output_test.epub');
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kindle-for-agents-test-'));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempEpubPath)) {
      fs.unlinkSync(tempEpubPath);
    }
  });

  it('should parse markdown file into structured document and chapters', async () => {
    const doc = await parseInputFile(sampleMdPath, {
      title: 'Kindle for Agents 测试样本',
      author: '测试作者',
      language: 'zh-CN'
    });

    expect(doc.title).toBe('Kindle for Agents 测试样本');
    expect(doc.author).toBe('测试作者');
    expect(doc.language).toBe('zh-CN');
    expect(doc.chapters.length).toBeGreaterThan(0);
  });

  it('should build a valid EPUB file and pass structure validation', async () => {
    const doc = await parseInputFile(sampleMdPath, {
      title: 'Kindle for Agents 测试样本',
      author: '测试作者',
      language: 'zh-CN'
    });

    await buildEpub(doc, tempEpubPath);
    expect(fs.existsSync(tempEpubPath)).toBe(true);

    const valResult = await validateEpub(tempEpubPath);
    expect(valResult.valid).toBe(true);
    expect(valResult.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('should preserve GFM table, horizontal rule, code block, and blockquote without duplicating nested <p> or chapter heading', async () => {
    const tmpDir = createTempDir();
    const richMdPath = path.join(tmpDir, 'rich.md');
    const richEpubPath = path.join(tmpDir, 'rich.epub');

    const markdownContent = [
      '# Rich Chapter Heading',
      '',
      '| ColA | ColB |',
      '| :--- | ---: |',
      '| Alpha | Beta |',
      '',
      '```ts',
      'const greet = (name: string): string => `Hello, ${name}`;',
      '```',
      '',
      '---',
      '',
      '> Unique blockquote paragraph line.'
    ].join('\n');

    fs.writeFileSync(richMdPath, markdownContent, 'utf-8');

    const doc = await parseInputFile(richMdPath, {
      title: 'Rich Book',
      author: 'Tester',
      language: 'en'
    });

    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].title).toBe('Rich Chapter Heading');

    const chapHtml = doc.chapters[0].htmlContent;
    expect(chapHtml).toContain('<table>');
    expect(chapHtml).toMatch(/<th[^>]*>ColA<\/th>/);
    expect(chapHtml).toMatch(/<td[^>]*>Alpha<\/td>/);
    expect(chapHtml).toContain('<pre>');
    expect(chapHtml).toContain('<hr/>');
    expect(chapHtml).toContain('<blockquote>');

    // Nested <p> inside <blockquote> must not be duplicated
    const quoteOccurrences = chapHtml.split('Unique blockquote paragraph line.').length - 1;
    expect(quoteOccurrences).toBe(1);

    // Top-level heading must not be duplicated inside chapter htmlContent
    expect(chapHtml).not.toContain('<h1>');
    expect(chapHtml).not.toContain('Rich Chapter Heading');

    await buildEpub(doc, richEpubPath);
    const valResult = await validateEpub(richEpubPath);
    expect(valResult.valid).toBe(true);
    expect(valResult.issues.filter(i => i.severity === 'error')).toHaveLength(0);

    const zip = await JSZip.loadAsync(fs.readFileSync(richEpubPath));
    const chapXhtml = await zip.file('OEBPS/chap_1.xhtml')!.async('string');
    const bodyMatch = chapXhtml.match(/<body>([\s\S]*?)<\/body>/);
    expect(bodyMatch).not.toBeNull();
    const bodyContent = bodyMatch![1];
    expect(bodyContent.split('Rich Chapter Heading').length - 1).toBe(1);
  });

  it('should embed local PNG image into EPUB, register in content.opf, rewrite img src, and pass validateEpub', async () => {
    const tmpDir = createTempDir();
    const pngPath = path.join(tmpDir, 'sample image.png');
    const mdPath = path.join(tmpDir, 'image-doc.md');
    const epubPath = path.join(tmpDir, 'image-doc.epub');

    // Valid 1x1 transparent PNG
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    fs.writeFileSync(pngPath, pngBuffer);

    const markdownContent = [
      '# Chapter With Image',
      '',
      'Here is a local diagram:',
      '',
      '![Local Diagram](./sample%20image.png)',
      '',
      'Same image referenced a second time for deduplication:',
      '',
      '![Local Diagram Duplicate](./sample%20image.png)',
      '',
      'Remote image should not break EPUB:',
      '',
      '![Remote Chart](https://example.com/chart.png)'
    ].join('\n');

    fs.writeFileSync(mdPath, markdownContent, 'utf-8');

    const doc = await parseInputFile(mdPath, {
      title: 'Image EPUB Test',
      author: 'Tester',
      language: 'zh-CN'
    });

    expect(doc.images).toBeDefined();
    expect(doc.images).toHaveLength(1);
    expect(doc.images![0].id).toBe('img_1');
    expect(doc.images![0].href).toBe('images/img_1.png');
    expect(doc.images![0].mediaType).toBe('image/png');

    await buildEpub(doc, epubPath);
    expect(fs.existsSync(epubPath)).toBe(true);

    const zip = await JSZip.loadAsync(fs.readFileSync(epubPath));

    const embeddedImgFile = zip.file('OEBPS/images/img_1.png');
    expect(embeddedImgFile).not.toBeNull();
    const embeddedBuffer = await embeddedImgFile!.async('nodebuffer');
    expect(embeddedBuffer.equals(pngBuffer)).toBe(true);

    const opfContent = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opfContent).toContain('<item id="img_1" href="images/img_1.png" media-type="image/png"/>');

    const chapXhtml = await zip.file('OEBPS/chap_1.xhtml')!.async('string');
    expect(chapXhtml).toContain('<img src="images/img_1.png"');
    expect(chapXhtml).not.toContain('https://example.com/chart.png');
    expect(chapXhtml).toContain('[图片: Remote Chart]');

    const valResult = await validateEpub(epubPath);
    expect(valResult.valid).toBe(true);
    expect(valResult.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });
});
