import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';

/**
 * Storage abstraction.
 *
 * v1 writes to local disk under `public/uploads`, because that is what a
 * Hostinger Node container can do without an extra service. The interface is
 * deliberately four methods wide so an S3-compatible driver is one file and a
 * config change — the database stores a *relative path* and a provider key, so
 * migrating storage is a copy job, not a data migration.
 */
export interface MediaStorage {
  readonly key: string;
  put(file: File, prefix: string): Promise<StoredMedia>;
  remove(path: string): Promise<void>;
}

export type StoredMedia = { path: string; bytes: number; contentType: string };

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

function assertAcceptable(file: File): string {
  const extension = ALLOWED.get(file.type);
  if (!extension) {
    throw new AppError('validation_failed', 'unsupported_media_type', { type: file.type });
  }
  if (file.size > env.MEDIA_MAX_BYTES) {
    throw new AppError('validation_failed', 'file_too_large', { max: env.MEDIA_MAX_BYTES });
  }
  return extension;
}

class LocalDiskStorage implements MediaStorage {
  readonly key = 'local';
  private readonly root = join(process.cwd(), 'public', 'uploads');

  async put(file: File, prefix: string): Promise<StoredMedia> {
    const extension = assertAcceptable(file);
    const buffer = Buffer.from(await file.arrayBuffer());

    // Content-hashed names: the same image uploaded twice occupies one file,
    // the name is unguessable, and nothing the uploader controls reaches the
    // filesystem — which is what stops "../../.env" being a valid filename.
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    const safePrefix = prefix.replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'media';
    const relative = `${safePrefix}/${hash}.${extension}`;
    const absolute = join(this.root, relative);

    await mkdir(join(this.root, safePrefix), { recursive: true });
    await writeFile(absolute, buffer);

    return { path: relative, bytes: buffer.byteLength, contentType: file.type };
  }

  async remove(path: string): Promise<void> {
    const relative = path.replace(/^\/+/, '');
    if (relative.includes('..')) throw new AppError('validation_failed', 'invalid_path');
    await unlink(join(this.root, relative)).catch(() => undefined);
  }
}

/**
 * Placeholder for the object-storage driver. It throws rather than silently
 * falling back to local disk, because a media file that lands somewhere the
 * next deploy will erase is worse than a clear failure at configuration time.
 */
class UnconfiguredS3Storage implements MediaStorage {
  readonly key = 's3';
  async put(): Promise<StoredMedia> {
    throw new AppError(
      'unavailable',
      'S3 media driver selected but not implemented. Set MEDIA_DRIVER=local or add the driver.',
    );
  }
  async remove(): Promise<void> {
    throw new AppError('unavailable', 'S3 media driver selected but not implemented.');
  }
}

export const storage: MediaStorage =
  env.MEDIA_DRIVER === 's3' ? new UnconfiguredS3Storage() : new LocalDiskStorage();

/** Intrinsic dimensions, read from the file header — no image library needed. */
export function readImageSize(buffer: Buffer): { width: number; height: number } | null {
  // PNG: IHDR is always the first chunk.
  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // JPEG: walk the segment markers to the first SOF.
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 9) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1]!;
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}
