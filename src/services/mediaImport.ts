import { MAX_PRESENTATION_PAGES } from '../../shared/data-types';
import type { MediaImportResult } from '../../shared/data-types';

function bridge() {
  if (!window.kvlog) throw new Error('Importing files needs the KVLOG desktop app.');
  return window.kvlog;
}

/** Opens the file dialog for pictures and videos. */
export function importMediaFiles(): Promise<MediaImportResult> {
  return bridge().importMedia();
}

export function describeImport(result: MediaImportResult): { tone: 'ok' | 'error'; text: string } | null {
  const pictures = result.items.filter((m) => m.kind === 'image').length;
  const videos = result.items.length - pictures;
  const parts = [
    pictures ? `${pictures} picture${pictures === 1 ? '' : 's'}` : '',
    videos ? `${videos} video${videos === 1 ? '' : 's'}` : ''
  ].filter(Boolean);
  const added = parts.length ? `Added ${parts.join(' and ')}.` : '';
  if (result.problems.length) return { tone: 'error', text: [added, ...result.problems].filter(Boolean).join(' ') };
  return added ? { tone: 'ok', text: added } : null;
}

/**
 * Lets the operator choose a PowerPoint or PDF file and turns every slide into a picture.
 * PowerPoint files are converted by PowerPoint (in the main process); PDFs are drawn here.
 * Returns null when the dialog is cancelled.
 */
export async function importPresentationFile(onProgress: (text: string) => void): Promise<{ name: string; pages: string[] } | null> {
  onProgress('Choose a file. PowerPoint files are converted by PowerPoint, which can take a minute…');
  const result = await bridge().importPresentation();
  if (result.status === 'canceled') return null;
  if (result.status === 'pages') return { name: result.name, pages: result.pages };
  return { name: result.name, pages: await renderPdf(result.data, onProgress) };
}

async function renderPdf(data: Uint8Array, onProgress: (text: string) => void): Promise<string[]> {
  onProgress('Opening the PDF…');
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch {
    throw new Error('The PDF could not be opened. It may be damaged or password-protected.');
  }

  const saved: string[] = [];
  try {
    const total = Math.min(doc.numPages, MAX_PRESENTATION_PAGES);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare the slides.');
    let batch: Uint8Array[] = [];
    for (let n = 1; n <= total; n++) {
      onProgress(`Preparing slide ${n} of ${total}…`);
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1920 / base.width });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error(`Slide ${n} could not be converted.`);
      batch.push(new Uint8Array(await blob.arrayBuffer()));
      if (batch.length === 10 || n === total) {
        saved.push(...(await bridge().savePresentationPages(batch)));
        batch = [];
      }
    }
    if (doc.numPages > total) onProgress(`Only the first ${total} pages were imported.`);
    return saved;
  } catch (error) {
    for (const name of saved) void bridge().deleteMedia(name).catch(() => undefined);
    throw error;
  } finally {
    void doc.destroy();
  }
}

/** Deletes the slide pictures of a presentation that is being replaced or deleted. */
export function deletePages(pages: string[]): void {
  for (const name of pages) void window.kvlog?.deleteMedia(name).catch(() => undefined);
}
