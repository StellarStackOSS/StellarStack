export type MediaType = "image" | "video" | "audio" | "unknown";

export const MEDIA_EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"],
  video: ["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv", "m4v"],
  audio: ["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"],
};

/**
 * Detect media type from file extension
 */
export const GetMediaType = (fileName: string): MediaType => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if ((MEDIA_EXTENSIONS.image as readonly string[]).includes(ext)) return "image";
  if ((MEDIA_EXTENSIONS.video as readonly string[]).includes(ext)) return "video";
  if ((MEDIA_EXTENSIONS.audio as readonly string[]).includes(ext)) return "audio";

  return "unknown";
};

/**
 * Check if a file is a media file
 */
export const IsMediaFile = (fileName: string): boolean => {
  return GetMediaType(fileName) !== "unknown";
};

/**
 * Get MIME type for a file
 */
const GetMimeType = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    aac: "audio/aac",
  };
  return mimeMap[ext] || "application/octet-stream";
};

/**
 * Create a data URL from content with multiple fallbacks
 */
export const CreateMediaDataUrl = (fileName: string, content: string): string => {
  const mimeType = GetMimeType(fileName);
  try {
    // Try to create a data URL
    return `data:${mimeType};base64,${btoa(content)}`;
  } catch {
    // Fallback for non-latin1 characters
    try {
      const encoded = new TextEncoder().encode(content);
      const binaryString = Array.from(encoded)
        .map((byte) => String.fromCharCode(byte))
        .join("");
      return `data:${mimeType};base64,${btoa(binaryString)}`;
    } catch {
      // Last resort - return as-is
      return content;
    }
  }
};
