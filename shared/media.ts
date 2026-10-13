// Media files are served to KVLOG windows through a private "kvlog-media://" address,
// so the UI never needs (or gets) direct access to file paths.

export const MEDIA_SCHEME = 'kvlog-media';
export const MEDIA_FILE_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|webp|gif|mp4|webm|m4v)$/;
const VIDEO_FILE_PATTERN = /\.(mp4|webm|m4v)$/;

export function mediaUrl(fileName: string): string {
  return `${MEDIA_SCHEME}://file/${encodeURIComponent(fileName)}`;
}

export function isVideoFile(fileName: string): boolean {
  return VIDEO_FILE_PATTERN.test(fileName);
}
