"use client";

import { useMemo } from "react";
import { cn } from "@workspace/ui/lib/utils";

export interface ArcadeScrollTextProps {
  text: string;
  charMap?: Record<string, string | null>;
  scrollSpeed?: number;
  iconSize?: number;
  gap?: number;
  repeat?: number;
  className?: string;
  basePath?: string;
}

// Default character to SVG icon mapping
const defaultCharMap: Record<string, string | null> = {
  // Lowercase letters
  a: "30-letter-a.svg",
  b: "30-letter-b.svg",
  c: "30-letter-c.svg",
  d: "30-letter-d.svg",
  e: "30-letter-e.svg",
  f: "30-letter-f.svg",
  g: "30-letter-g.svg",
  h: "30-letter-h.svg",
  i: "30-letter-i.svg",
  j: "30-letter-j.svg",
  k: "30-letter-k.svg",
  l: "30-letter-l.svg",
  m: "30-letter-m.svg",
  n: "30-letter-n.svg",
  o: "30-letter-o.svg",
  p: "30-letter-p.svg",
  q: "30-letter-q.svg",
  r: "30-letter-r.svg",
  s: "30-letter-s.svg",
  t: "30-letter-t.svg",
  u: "30-letter-u.svg",
  v: "30-letter-v.svg",
  w: "30-letter-w.svg",
  x: "30-letter-x.svg",
  y: "30-letter-y.svg",
  z: "30-letter-z.svg",

  // Numbers
  0: "30-number-zero.svg",
  1: "30-number-one.svg",
  2: "30-number-two.svg",
  3: "30-number-three.svg",
  4: "30-number-four.svg",
  5: "30-number-five.svg",
  6: "30-number-six.svg",
  7: "30-number-seven.svg",
  8: "30-number-eight.svg",
  9: "30-number-nine.svg",

  // Special characters
  " ": null, // Space = gap
  "!": "30-exclamation-mark.svg",
  "?": "30-question-mark.svg",
  "@": "30-at-sign.svg",
  "#": "30-hashtag.svg",
  "+": "30-plus.svg",
  "-": "30-minus.svg",
  "=": "30-equals.svg",
  "*": "30-xmark.svg",
  "/": "30-divide.svg",
  "%": "30-percentage.svg",
  "&": "30-ampersand.svg",
  "~": "30-tilde.svg",
  ":": "30-two-dots.svg",
  "(": "30-brackets-square.svg",
  ")": "30-brackets-square.svg",
  "[": "30-brackets-square.svg",
  "]": "30-brackets-square.svg",
  "{": "30-brackets-curly.svg",
  "}": "30-brackets-curly.svg",
  '"': "30-close-quotation-mark.svg",
  "'": "30-open-quotation-mark.svg",
};

export const ArcadeScrollText = ({
  text,
  charMap,
  scrollSpeed = 20,
  iconSize = 30,
  gap = 8,
  repeat = 3,
  className,
  basePath = "/icons/Bar",
}: ArcadeScrollTextProps) => {
  // Merge custom map with default map
  const mergedCharMap = useMemo(() => ({ ...defaultCharMap, ...charMap }), [charMap]);

  // Build icon array from text
  const icons = useMemo(() => {
    const chars = text.toLowerCase().split("");
    return chars.map((char) => mergedCharMap[char] ?? null);
  }, [text, mergedCharMap]);

  // Duplicate icons for seamless scrolling loop
  const repeatedIcons = useMemo(() => Array(repeat).fill(icons).flat(), [icons, repeat]);

  const translatePercent = 100 / repeat;

  return (
    <div className={cn("relative w-full overflow-hidden rounded-lg bg-black/20", className)}>
      <div
        className="animate-arcade-scroll flex items-center whitespace-nowrap"
        style={{
          gap: `${gap}px`,
          animationDuration: `${scrollSpeed}s`,
        }}
      >
        {repeatedIcons.map((iconPath, idx) =>
          iconPath ? (
            <img
              key={idx}
              src={`${basePath}/${iconPath}`}
              alt={text[idx % text.length]}
              style={{
                width: iconSize,
                height: iconSize,
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              key={idx}
              style={{
                width: gap,
                height: iconSize,
                flexShrink: 0,
              }}
            />
          )
        )}
      </div>

      <style jsx>{`
        @keyframes arcade-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-${translatePercent}%));
          }
        }
      `}</style>
    </div>
  );
};
