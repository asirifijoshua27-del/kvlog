// Minimal ZIP reader for .docx, .pptx and EasyWorship .ewsx files (stored and deflated entries).
import { inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  read(): Buffer;
}

const MAX_ENTRY_BYTES = 400 * 1024 * 1024;

export function readZip(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('This is not a valid file (it is not a ZIP package).');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('The file is damaged.');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen).replace(/\\/g, '/');
    p += 46 + nameLen + extraLen + commentLen;
    entries.push({
      name,
      read() {
        if (size > MAX_ENTRY_BYTES) throw new Error(`${name} is too large.`);
        if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('The file is damaged.');
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const data = buf.subarray(start, start + compSize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES });
        throw new Error(`${name} uses a compression KVLOG cannot read.`);
      }
    });
  }
  return entries;
}

export function zipText(entries: ZipEntry[], name: string): string | null {
  const e = entries.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return e ? e.read().toString('utf8') : null;
}
