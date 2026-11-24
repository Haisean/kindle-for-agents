import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import mime from 'mime-types';

export interface ParsedChapter {
  id: string;
  title: string;
  htmlContent: string;
}

export interface EmbeddedImage {
  id: string;
  href: string;
  mediaType: string;
  data: Buffer;
}

export interface ParsedDocument {
  title: string;
  author: string;
  language: string;
  chapters: ParsedChapter[];
  images?: EmbeddedImage[];
  coverPath?: string;
  isEpubPassthrough?: boolean;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'code',
    'ul', 'ol', 'li', 'b', 'i', 'strong', 'em', 'strike', 'del', 's',
    'hr', 'br', 'div', 'span', 'img', 'figure', 'figcaption', 'sup', 'sub',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'
  ],
  allowedAttributes: {
    'a': ['href', 'title'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'th': ['colspan', 'rowspan', 'align'],
    'td': ['colspan', 'rowspan', 'align'],
    '*': ['id', 'class']
  },
  allowedSchemesByTag: {
    img: ['http', 'https', 'data']
  },
  nonTextTags: ['script', 'style', 'iframe', 'noscript', 'title']
};

export async function parseInputFile(
  filePath: string,
  options?: { title?: string; author?: string; coverPath?: string; language?: string }
): Promise<ParsedDocument> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`输入文件不存在: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();
  const fileBaseName = path.basename(filePath, ext);

  let defaultTitle = options?.title || fileBaseName;
  const defaultAuthor = options?.author || 'Unknown';
  const defaultLang = options?.language || 'zh-CN';

  if (ext === '.epub') {
    return {
      title: defaultTitle,
      author: defaultAuthor,
      language: defaultLang,
      chapters: [],
      images: [],
      coverPath: options?.coverPath,
      isEpubPassthrough: true
    };
  }

  const rawContent = fs.readFileSync(filePath, 'utf-8');
  let bodyHtml = '';

  if (ext === '.md' || ext === '.markdown') {
    bodyHtml = await marked.parse(rawContent, { gfm: true });
  } else if (ext === '.txt') {
    const lines = rawContent.split(/\r?\n/);
    if (!options?.title && lines.length > 0 && lines[0].trim().length > 0) {
      defaultTitle = lines[0].trim().substring(0, 50);
    }
    bodyHtml = lines.map(line => (line.trim() ? `<p>${escapeHtml(line)}</p>` : '')).join('\n');
  } else if (ext === '.html' || ext === '.htm') {
    bodyHtml = rawContent;
  } else {
    throw new Error(`不支持的文件格式: ${ext}，请提供 .md, .txt, .html 或 .epub 文件。`);
  }

  // Clean HTML while preserving semantic formatting, tables, figures, and rules
  const cleanBodyHtml = sanitizeHtml(bodyHtml, SANITIZE_OPTIONS);

  // Split into chapters ONLY on top-level <h1> or <h2> elements without descending into children
  const $ = cheerio.load(cleanBodyHtml, null, false);
  const rootContents = $('body').length > 0 ? $('body').contents() : $.root().contents();

  const rawChapters: ParsedChapter[] = [];
  let currentChapterTitle = defaultTitle;
  let currentHtmlParts: string[] = [];
  let chapterIndex = 1;
  let hasSeenHeading = false;

  rootContents.each((_, node) => {
    if (node.type === 'text') {
      const text = (node as { data?: string }).data ?? '';
      if (text.trim().length > 0) {
        currentHtmlParts.push(`<p>${escapeHtml(text.trim())}</p>`);
      }
      return;
    }

    if ('tagName' in node && typeof (node as { tagName?: unknown }).tagName === 'string') {
      const tag = (node as { tagName: string }).tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2') {
        const accumulated = currentHtmlParts.join('\n').trim();
        if (hasSeenHeading || accumulated.length > 0) {
          rawChapters.push({
            id: `chap_${chapterIndex++}`,
            title: currentChapterTitle,
            htmlContent: accumulated
          });
        }
        currentHtmlParts = [];
        hasSeenHeading = true;
        currentChapterTitle = $(node).text().trim() || `Chapter ${chapterIndex}`;
      } else {
        currentHtmlParts.push($.html(node));
      }
    }
  });

  const trailingHtml = currentHtmlParts.join('\n').trim();
  if (hasSeenHeading || trailingHtml.length > 0) {
    rawChapters.push({
      id: `chap_${chapterIndex}`,
      title: currentChapterTitle,
      htmlContent: trailingHtml
    });
  }

  if (rawChapters.length === 0) {
    rawChapters.push({
      id: 'chap_1',
      title: defaultTitle,
      htmlContent: ''
    });
  }

  // Extract local images, strip/replace remote or missing images, and serialize valid XHTML
  const baseDir = path.dirname(path.resolve(filePath));
  const images: EmbeddedImage[] = [];
  const imageByResolvedPath = new Map<string, EmbeddedImage>();

  const chapters: ParsedChapter[] = rawChapters.map(chap => ({
    id: chap.id,
    title: chap.title,
    htmlContent: serializeChapterXhtml(chap.htmlContent, baseDir, images, imageByResolvedPath)
  }));

  return {
    title: defaultTitle,
    author: defaultAuthor,
    language: defaultLang,
    chapters,
    images,
    coverPath: options?.coverPath,
    isEpubPassthrough: false
  };
}

function serializeChapterXhtml(
  rawChapterHtml: string,
  baseDir: string,
  images: EmbeddedImage[],
  imageMap: Map<string, EmbeddedImage>
): string {
  if (!rawChapterHtml.trim()) {
    return '';
  }

  const $chap = cheerio.load(rawChapterHtml, null, false);

  $chap('img').each((_, imgElem) => {
    const $img = $chap(imgElem);
    const rawSrc = ($img.attr('src') || '').trim();
    const alt = ($img.attr('alt') || '').trim();

    if (!rawSrc) {
      if (alt) {
        $img.replaceWith(`<span>[图片: ${escapeHtml(alt)}]</span>`);
      } else {
        $img.remove();
      }
      return;
    }

    const isNonLocal = /^(https?:|data:|mailto:|ftp:|tel:|\/\/)/i.test(rawSrc);
    if (isNonLocal) {
      if (alt) {
        $img.replaceWith(`<span>[图片: ${escapeHtml(alt)}]</span>`);
      } else {
        $img.remove();
      }
      return;
    }

    let cleanSrc = rawSrc.split(/[?#]/)[0];
    try {
      cleanSrc = decodeURIComponent(cleanSrc);
    } catch {
      // Keep raw path if percent-encoding is malformed
    }

    const resolvedPath = path.resolve(baseDir, cleanSrc);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      if (alt) {
        $img.replaceWith(`<span>[图片: ${escapeHtml(alt)}]</span>`);
      } else {
        $img.remove();
      }
      return;
    }

    let embedded = imageMap.get(resolvedPath);
    if (!embedded) {
      const data = fs.readFileSync(resolvedPath);
      const rawExt = path.extname(resolvedPath).toLowerCase();
      const mediaType = mime.lookup(rawExt) || 'image/png';
      const ext = rawExt || `.${mime.extension(mediaType) || 'png'}`;
      const id = `img_${images.length + 1}`;
      const href = `images/${id}${ext}`;

      embedded = { id, href, mediaType, data };
      images.push(embedded);
      imageMap.set(resolvedPath, embedded);
    }

    // Ensure src is serialized first on <img src="..." .../>
    const preservedAttrs: Array<[string, string]> = [];
    for (const attrName of ['alt', 'title', 'width', 'height', 'id', 'class']) {
      const val = $img.attr(attrName);
      if (val !== undefined) {
        preservedAttrs.push([attrName, val]);
        $img.removeAttr(attrName);
      }
    }
    $img.removeAttr('src');
    $img.attr('src', embedded.href);
    for (const [attrName, attrVal] of preservedAttrs) {
      $img.attr(attrName, attrVal);
    }
  });

  return $chap
    .xml()
    .replace(/&nbsp;/g, '&#160;')
    .replace(/\u00a0/g, '&#160;')
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => {
      const codePoint = parseInt(hex, 16);
      if (codePoint > 0x7f && codePoint !== 0xa0) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
