"use client";

import { useEffect, useRef } from "react";
import { CreateMediaDataUrl } from "@/lib/MediaUtils";
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css'
import Card from "@stellarUI/components/Card/Card";

interface MediaViewerProps {
  fileName: string;
  content?: string;
  blobUrl?: string;
  onClose?: () => void;
  fileSize?: string;
  fileSizeBytes?: number;
  modified?: string;
  fileType?: "folder" | "file";
}

export const MediaViewer = ({
  fileName,
  content = "",
  blobUrl,
  onClose,
  fileSize,
  fileSizeBytes,
  modified,
  fileType
}: MediaViewerProps) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isVideo = ["mp4", "webm", "mov", "avi"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
        } else if (audioRef.current) {
          audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
        }
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
    const src = blobUrl || (content ? CreateMediaDataUrl(fileName, content) : "");

    console.log(blobUrl);

    return (
      <div className="flex h-full w-full flex-row items-center justify-center gap-4">
        <Zoom canSwipeToUnzoom={true}>
          <img src={src} alt={fileName} className="max-h-full max-w-full object-contain rounded-lg" />
        </Zoom>
        {(fileSize || modified) && (
            <div className="text-xs text-zinc-400 gap-4 flex h-full p-4 flex-col border border-white/5 rounded-md">
              <div>
                <span className="text-white">Name: </span>{fileName && <span>{fileName}</span>}
              </div>
              <div>
                <span className="text-white">Type:</span> {ext && <span>{ext}</span>}
              </div>
              <div>
                <span className="text-white">Size: </span>{fileSize && <span>{fileSize} ({fileSizeBytes} bytes)</span>}
              </div>
              <div>
                <span className="text-white">Modified: </span>{modified && <span>{modified}</span>}
              </div>
            </div>
        )}
      </div>
    );
  }

  if (isVideo) {
    const src = blobUrl;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        {(fileSize || modified) && (
          <div className="text-xs text-zinc-400 flex items-center gap-4">
            {fileName && <span>{fileName}</span>}
            {fileSize && <span>{fileSize}</span>}
            {modified && <span>{modified}</span>}
          </div>
        )}
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
        {(fileSize || modified) && (
          <div className="text-xs text-zinc-400 flex items-center gap-4">
            {fileSize && <span>{fileSize}</span>}
            {modified && <span>{modified}</span>}
          </div>
        )}
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
};
