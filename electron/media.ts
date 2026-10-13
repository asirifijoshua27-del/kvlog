// Media Library files. Pictures, videos and presentation slides are COPIED into KVLOG's own
// media folder, so moving or deleting the original does not break anything. Windows load them
// through the private kvlog-media:// address; only files inside the media folder can be reached.
import { app, dialog, protocol, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { MEDIA_FILE_PATTERN, MEDIA_SCHEME } from '../shared/media';
import { MAX_PRESENTATION_PAGES, type MediaImportResult, type MediaItem, type PresentationImportResult } from '../shared/data-types';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v'];
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_PDF_BYTES = 200 * 1024 * 1024;
const MAX_PAGE_BYTES = 25 * 1024 * 1024;
const MAX_FILES_PER_IMPORT = 100;
const POWERPOINT_TIMEOUT_MS = 10 * 60 * 1000;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm'
};

export function mediaDir(): string {
  return path.join(app.getPath('userData'), 'media');
}

/** Must be called before the app is ready. `stream` lets videos play and seek. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }
  ]);
}

/** Returns the full path for a media file name, or null if the name is not allowed. */
export function resolveMediaFile(fileName: unknown): string | null {
  if (typeof fileName !== 'string' || !MEDIA_FILE_PATTERN.test(fileName)) return null;
  const dir = mediaDir();
  const full = path.join(dir, fileName);
  return path.dirname(full) === dir ? full : null;
}

export function contentTypeFor(fileName: string): string {
  return CONTENT_TYPES[path.extname(fileName).slice(1).toLowerCase()] ?? 'application/octet-stream';
}

/** Parses a "bytes=start-end" Range header. Returns null for no/invalid range (send the whole file). */
export function parseRange(header: string | null | undefined, size: number): { start: number; end: number } | null {
  if (!header || size === 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start: number;
  let end: number;
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

const notFound = () => new Response('Not found', { status: 404 });

/** Must be called after the app is ready. Supports Range requests so videos can seek and loop. */
export function handleMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'file') return notFound();
      const fileName = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const full = resolveMediaFile(fileName);
      if (!full) return notFound();
      const { size } = await fs.stat(full);
      const type = contentTypeFor(fileName);
      const range = parseRange(request.headers.get('range'), size);
      const start = range?.start ?? 0;
      const end = range?.end ?? size - 1;
      const body = size === 0 ? null : (Readable.toWeb(createReadStream(full, { start, end })) as unknown as ReadableStream);
      const headers: Record<string, string> = {
        'Content-Type': type,
        'Content-Length': String(size === 0 ? 0 : end - start + 1),
        'Accept-Ranges': 'bytes'
      };
      if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      return new Response(body, { status: range ? 206 : 200, headers });
    } catch {
      return notFound();
    }
  });
}

export async function importMedia(parent: BrowserWindow | null): Promise<MediaImportResult> {
  const options: OpenDialogOptions = {
    title: 'Add pictures and videos',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Pictures and videos', extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] },
      { name: 'Pictures', extensions: IMAGE_EXTENSIONS },
      { name: 'Videos', extensions: VIDEO_EXTENSIONS }
    ]
  };
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return { items: [], problems: [] };

  await fs.mkdir(mediaDir(), { recursive: true });
  const items: MediaItem[] = [];
  const problems: string[] = [];
  const files = result.filePaths.slice(0, MAX_FILES_PER_IMPORT);
  if (result.filePaths.length > files.length) problems.push(`Only the first ${MAX_FILES_PER_IMPORT} files were imported.`);

  for (const source of files) {
    const base = path.basename(source);
    const ext = path.extname(source).slice(1).toLowerCase();
    const isImage = IMAGE_EXTENSIONS.includes(ext);
    const isVideo = VIDEO_EXTENSIONS.includes(ext);
    if (!isImage && !isVideo) {
      problems.push(`${base}: not a supported picture or video type (use PNG, JPG, WebP, GIF, MP4 or WebM).`);
      continue;
    }
    try {
      const stat = await fs.stat(source);
      if (!stat.isFile()) throw new Error('not a file');
      if (isImage && stat.size > MAX_IMAGE_BYTES) {
        problems.push(`${base}: pictures must be smaller than 50 MB.`);
        continue;
      }
      if (isVideo && stat.size > MAX_VIDEO_BYTES) {
        problems.push(`${base}: videos must be smaller than 8 GB.`);
        continue;
      }
      const id = randomUUID();
      const fileName = `${id}.${ext === 'jpeg' ? 'jpg' : ext}`;
      await fs.copyFile(source, path.join(mediaDir(), fileName));
      items.push({
        id,
        name: path.basename(source, path.extname(source)).slice(0, 200) || (isVideo ? 'Video' : 'Picture'),
        fileName,
        kind: isVideo ? 'video' : 'image',
        addedAt: new Date().toISOString()
      });
    } catch {
      problems.push(`${base}: could not be copied. Check there is enough free disk space.`);
    }
  }
  return { items, problems };
}

// ----- PowerPoint and PDF -----

// Uses the PowerPoint installed on this PC to save each visible slide as a 1920-wide PNG.
// Paths arrive as parameters, never inside the script text.
const POWERPOINT_SCRIPT = `param([string]$InFile, [string]$OutDir)
$ErrorActionPreference = 'Stop'
try { $app = New-Object -ComObject PowerPoint.Application } catch { [Console]::Error.WriteLine('NO_POWERPOINT'); exit 3 }
$pres = $null
try {
  $pres = $app.Presentations.Open($InFile, -1, 0, 0)
  $w = 1920
  $h = [int][Math]::Round($w * $pres.PageSetup.SlideHeight / $pres.PageSetup.SlideWidth)
  foreach ($s in $pres.Slides) {
    if ($s.SlideShowTransition.Hidden -eq -1) { continue }
    $s.Export((Join-Path $OutDir ('{0:D4}.png' -f $s.SlideIndex)), 'PNG', $w, $h)
  }
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 4 }
finally {
  if ($pres) { $pres.Close() }
  if ($app.Presentations.Count -eq 0) { $app.Quit() }
}
`;

function runPowerShell(script: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
      { timeout: POWERPOINT_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (!error) return resolve();
        const code = (error as { code?: unknown }).code;
        if (code === 3 || /NO_POWERPOINT/.test(stderr)) {
          reject(new Error('Microsoft PowerPoint was not found on this PC. In PowerPoint on another computer, use File → Export → PDF, then import the PDF here.'));
        } else if ((error as { killed?: boolean }).killed) {
          reject(new Error('PowerPoint took longer than 10 minutes. Try exporting the file as PDF and importing that.'));
        } else {
          const detail = stderr.trim().split(/\r?\n/).pop()?.slice(0, 300) ?? '';
          reject(new Error(`PowerPoint could not convert the file${detail ? `: ${detail}` : '.'} If it is open in PowerPoint with unsaved changes or a password, save/close it and try again.`));
        }
      }
    );
  });
}

async function convertWithPowerPoint(source: string): Promise<string[]> {
  if (process.platform !== 'win32') throw new Error('PowerPoint import works on Windows only. Export the file as PDF instead.');
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'kvlog-ppt-'));
  try {
    const script = path.join(work, 'convert.ps1');
    const out = path.join(work, 'out');
    await fs.mkdir(out);
    await fs.writeFile(script, POWERPOINT_SCRIPT, 'utf8');
    await runPowerShell(script, ['-InFile', source, '-OutDir', out]);

    const pngs = (await fs.readdir(out)).filter((n) => /^\d{4}\.png$/i.test(n)).sort().slice(0, MAX_PRESENTATION_PAGES);
    if (pngs.length === 0) throw new Error('The presentation has no visible slides.');
    await fs.mkdir(mediaDir(), { recursive: true });
    const pages: string[] = [];
    for (const png of pngs) {
      const fileName = `${randomUUID()}.png`;
      await fs.copyFile(path.join(out, png), path.join(mediaDir(), fileName));
      pages.push(fileName);
    }
    return pages;
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function importPresentation(parent: BrowserWindow | null): Promise<PresentationImportResult> {
  const options: OpenDialogOptions = {
    title: 'Import PowerPoint or PDF',
    properties: ['openFile'],
    filters: [{ name: 'PowerPoint or PDF', extensions: ['pptx', 'ppt', 'pdf'] }]
  };
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return { status: 'canceled' };

  const source = result.filePaths[0];
  const ext = path.extname(source).slice(1).toLowerCase();
  const name = path.basename(source, path.extname(source)).slice(0, 200) || 'Presentation';
  const stat = await fs.stat(source);
  if (!stat.isFile()) throw new Error('That is not a file.');

  if (ext === 'pdf') {
    if (stat.size > MAX_PDF_BYTES) throw new Error('PDF files must be smaller than 200 MB.');
    const data = await fs.readFile(source);
    return { status: 'pdf', name, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
  }
  if (ext === 'pptx' || ext === 'ppt') return { status: 'pages', name, pages: await convertWithPowerPoint(source) };
  throw new Error('Choose a .pptx, .ppt or .pdf file.');
}

/** Saves slide images rendered by the UI (from a PDF). Only real PNGs are accepted. */
export async function savePresentationPages(pages: unknown): Promise<string[]> {
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > MAX_PRESENTATION_PAGES) throw new Error('Invalid slide images.');
  for (const page of pages) {
    if (!(page instanceof Uint8Array) || page.byteLength > MAX_PAGE_BYTES || page.byteLength < 8) throw new Error('Invalid slide image.');
    if (!PNG_SIGNATURE.every((b, i) => page[i] === b)) throw new Error('Invalid slide image.');
  }
  await fs.mkdir(mediaDir(), { recursive: true });
  const names: string[] = [];
  for (const page of pages as Uint8Array[]) {
    const fileName = `${randomUUID()}.png`;
    await fs.writeFile(path.join(mediaDir(), fileName), page);
    names.push(fileName);
  }
  return names;
}

/** Returns the file names (from the given list) that no longer exist in the media folder. */
export async function findMissingMedia(fileNames: unknown): Promise<string[]> {
  if (!Array.isArray(fileNames) || fileNames.length > 20000) throw new Error('Invalid media list.');
  const missing: string[] = [];
  for (const name of fileNames) {
    const full = resolveMediaFile(name);
    if (!full) continue;
    try {
      await fs.access(full);
    } catch {
      missing.push(name as string);
    }
  }
  return missing;
}

export async function deleteMediaFile(fileName: unknown): Promise<void> {
  const full = resolveMediaFile(fileName);
  if (!full) throw new Error('Invalid media file name.');
  try {
    await fs.unlink(full);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Could not delete the media file.');
  }
}
