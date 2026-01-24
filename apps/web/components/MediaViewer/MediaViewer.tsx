"use client";

import { useEffect, useRef } from "react";
import { createMediaDataUrl } from "@/lib/media-utils";

interface MediaViewerProps {
  fileName: string;
  content?: string;
  blobUrl?: string;
  onClose?: () => void;
}

// TODO: REPLACE THIS WITH SOMETHING BETTER?
const MediaViewer = ({ fileName, content = "", blobUrl, onClose }: MediaViewerProps) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isVideo = ["mp4", "webm", "mov", "avi"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && isVideo) {
      videoRef.current.load();
    }
  }, [isVideo]);

  if (!content && !blobUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <p className="text-center text-sm text-zinc-500">No content to display</p>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <img
          src={blobUrl || createMediaDataUrl(fileName, content || "")}
          alt={fileName}
          className="max-h-full max-w-full object-contain"
          onError={(e) => {
            // Handle image load error
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
          }}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <video
          ref={videoRef}
          src={blobUrl || createMediaDataUrl(fileName, content || "")}
          controls
          className="max-h-full max-w-full object-contain"
          onError={(e) => {
            // Handle video load error
            const target = e.target as HTMLVideoElement;
            target.style.display = "none";
          }}
        />
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <audio
          src={blobUrl || createMediaDataUrl(fileName, content || "")}
          controls
          className="w-full"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <p className="text-center text-sm text-zinc-500">Unsupported file type</p>
    </div>
  );
};
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (videoRef.current?.requestFullscreen) {
          videoRef.current.requestFullscreen();
        }
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
        } else if (audioRef.current) {
          audioRef.current.muted = !audioRef.current.muted;
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime -= 5;
        else if (audioRef.current) audioRef.current.currentTime -= 5;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (videoRef.current) videoRef.current.currentTime += 5;
        else if (audioRef.current) audioRef.current.currentTime += 5;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  if (isImage) {
    const src = blobUrl || (content ? createMediaDataUrl(fileName, content) : "");
    return (
      <div className="flex h-full w-full items-center justify-center">
        <img src={src} alt={fileName} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (isVideo) {
    const src = blobUrl;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <video
          ref={videoRef}
          src={src}
          controls
          className="max-h-[80%] max-w-full object-contain"
          autoPlay
        />
        <div className="text-center text-xs text-zinc-400">
          Space: Play/Pause | F: Fullscreen | M: Mute | ←→: ±5s
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6">
        <div className="text-6xl">🎵</div>
        <audio ref={audioRef} src={blobUrl} controls className="w-full max-w-md" autoPlay />
        <div className="text-xs text-zinc-400">Space: Play/Pause | M: Mute | ←→: ±5s</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-zinc-400">
      Unsupported media type
    </div>
  );
}
