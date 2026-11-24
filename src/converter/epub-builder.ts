import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import mime from 'mime-types';
import { ParsedDocument } from './parser';

export async function buildEpub(
  doc: ParsedDocument,
  outputPath: string
): Promise<string> {
  const zip = new JSZip();

  // 1. mimetype (Uncompressed, must be first file in ZIP)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file('META-INF/container.xml', containerXml);

  // 3. CSS
  const cssContent = `
body {
  font-family: serif;
  margin: 5%;
  line-height: 1.6;
}
h1, h2, h3 {
  font-family: sans-serif;
  text-align: center;
  margin-top: 1.5em;
  margin-bottom: 0.8em;
}
p {
  text-indent: 2em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}
blockquote {
  margin: 1em 2em;
  font-style: italic;
}
blockquote p {
  text-indent: 0;
}
img {
  max-width: 100%;
  height: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.9em;
}
th, td {
  border: 1px solid #666;
  padding: 0.4em 0.6em;
  text-align: left;
  vertical-align: top;
}
th {
  background-color: #f0f0f0;
  font-weight: bold;
}
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  padding: 0.6em;
  margin: 0.8em 0;
  font-family: monospace;
  font-size: 0.88em;
  text-indent: 0;
}
code {
  font-family: monospace;
  font-size: 0.9em;
}
hr {
  border: none;
  border-top: 1px solid #999;
  margin: 1.5em 0;
}
`;
  zip.file('OEBPS/style.css', cssContent);

  const uuid = `urn:uuid:${generateUUID()}`;
  const modifiedDate = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const safeLang = escapeXml(doc.language);

  // Handle Cover if specified
  const extraManifestItems: string[] = [];
  let coverMetaItem = '';
  if (doc.coverPath && fs.existsSync(doc.coverPath)) {
    const coverExt = path.extname(doc.coverPath);
    const coverMime = mime.lookup(coverExt) || 'image/jpeg';
    const coverData = fs.readFileSync(doc.coverPath);
    zip.file(`OEBPS/cover${coverExt}`, coverData);
    extraManifestItems.push(
      `<item id="cover-image" href="cover${escapeXml(coverExt)}" media-type="${escapeXml(coverMime)}" properties="cover-image"/>`
    );
    coverMetaItem = `<meta name="cover" content="cover-image"/>`;
  }

  // Handle Embedded Images
  if (doc.images && doc.images.length > 0) {
    for (const img of doc.images) {
      zip.file(`OEBPS/${img.href}`, img.data);
      extraManifestItems.push(
        `<item id="${escapeXml(img.id)}" href="${escapeXml(img.href)}" media-type="${escapeXml(img.mediaType)}"/>`
      );
    }
  }

  // Generate XHTML Chapters
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navListItems: string[] = [];
  const ncxNavPoints: string[] = [];

  doc.chapters.forEach((chap, idx) => {
    const filename = `${chap.id}.xhtml`;
    const xhtmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${safeLang}" lang="${safeLang}">
<head>
  <title>${escapeXml(chap.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="chapter" id="${escapeXml(chap.id)}">
    <h2>${escapeXml(chap.title)}</h2>
    ${chap.htmlContent}
  </section>
</body>
</html>`;

    zip.file(`OEBPS/${filename}`, xhtmlContent);

    manifestItems.push(`<item id="${escapeXml(chap.id)}" href="${escapeXml(filename)}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${escapeXml(chap.id)}"/>`);
    navListItems.push(`<li><a href="${escapeXml(filename)}">${escapeXml(chap.title)}</a></li>`);
    ncxNavPoints.push(`
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(chap.title)}</text></navLabel>
      <content src="${escapeXml(filename)}"/>
    </navPoint>`);
  });

  // 4. OEBPS/nav.xhtml (EPUB 3 Navigation)
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${safeLang}" lang="${safeLang}">
<head>
  <title>目录</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
      ${navListItems.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // 5. OEBPS/toc.ncx (EPUB 2 Navigation Compatibility)
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(doc.title)}</text></docTitle>
  <docAuthor><text>${escapeXml(doc.author)}</text></docAuthor>
  <navMap>
    ${ncxNavPoints.join('\n')}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // 6. OEBPS/content.opf
  const allManifestLines = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="style" href="style.css" media-type="text/css"/>',
    ...extraManifestItems,
    ...manifestItems
  ];

  const metadataLines = [
    `<dc:identifier id="pub-id">${uuid}</dc:identifier>`,
    `<dc:title>${escapeXml(doc.title)}</dc:title>`,
    `<dc:creator>${escapeXml(doc.author)}</dc:creator>`,
    `<dc:language>${safeLang}</dc:language>`,
    `<meta property="dcterms:modified">${modifiedDate}</meta>`,
    ...(coverMetaItem ? [coverMetaItem] : [])
  ];

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    ${metadataLines.join('\n    ')}
  </metadata>
  <manifest>
    ${allManifestLines.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  // Generate EPUB file
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
