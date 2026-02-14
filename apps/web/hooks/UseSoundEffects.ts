"use client";

import { useCallback, useRef } from "react";

type SoundType = "copy" | "jobDone" | "startup";

const SOUND_FILES: Record<SoundType, string> = {
  copy: "/copy.mp3",
  jobDone: "/job-done.mp3",
  startup: "/startup.mp3",
};

/**
 * Hook for playing sound effects throughout the app
 *
 * Usage:
 *   const { playSound } = useSoundEffects();
 *   playSound("copy"); // When creating folder or uploading file
 *   playSound("jobDone"); // When server finishes installing
 *   playSound("startup"); // When user signs in
 */
export const useSoundEffects = () => {
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    copy: null,
    jobDone: null,
    startup: null,
  });

  const playSound = useCallback((type: SoundType, volume: number = 0.5) => {
    // Only play in browser environment
    if (typeof window === "undefined") return;

    try {
      // Create audio element if it doesn't exist
      if (!audioRefs.current[type]) {
        audioRefs.current[type] = new Audio(SOUND_FILES[type]);
      }

      const audio = audioRefs.current[type]!;
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.currentTime = 0;
      audio.play().catch((err) => {
        // Silently fail - browsers may block autoplay
        console.debug("Sound playback blocked:", err);
      });
    } catch (err) {
      console.debug("Failed to play sound:", err);
    }
  }, []);

  return { playSound };
};

/**
 * Standalone function for playing sounds outside of React components
 * Useful for callbacks in API responses
 */
export const PlaySoundEffect = (type: SoundType, volume: number = 0.5) => {
  if (typeof window === "undefined") return;

  try {
    const audio = new Audio(SOUND_FILES[type]);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch((err) => {
      console.debug("Sound playback blocked:", err);
    });
  } catch (err) {
    console.debug("Failed to play sound:", err);
  }
};
