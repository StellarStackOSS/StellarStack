"use client";

import { useEffect, useRef } from "react";

export type PixelTextProps = {
    text: string;
    letterSpacing?: number; // px between glyphs
    spaceWidth?: number;    // px for spaces
    className?: string;
};

const NUMBER_MAP: Record<string, string> = {
    "0": "zero",
    "1": "one",
    "2": "two",
    "3": "three",
    "4": "four",
    "5": "five",
    "6": "six",
    "7": "seven",
    "8": "eight",
    "9": "nine",
};

const svgCache = new Map<string, SVGSVGElement>();

const charToFilename = (char: string): string | null => {
    if (char === " ") return null;

    const lower = char.toLowerCase();

    if (lower >= "a" && lower <= "z") {
        return `30-letter-${lower}.svg`;
    }

    if (NUMBER_MAP[lower]) {
        return `30-number-${NUMBER_MAP[lower]}.svg`;
    }

    return null;
};

const loadSvg = async (path: string): Promise<SVGSVGElement> => {
    if (svgCache.has(path)) {
        return svgCache.get(path)!.cloneNode(true) as SVGSVGElement;
    }

    const res = await fetch(path);
    if (!res.ok) {
        throw new Error(`Failed to load SVG: ${path}`);
    }

    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = doc.documentElement as unknown as SVGSVGElement;

    svgCache.set(path, svg);

    return svg.cloneNode(true) as SVGSVGElement;
};

const PixelText = ({
                              text,
                              letterSpacing = 4,
                              spaceWidth = 12,
                              className,
                          }: PixelTextProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        const render = async () => {
            if (!containerRef.current) return;

            const root = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );

            root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            root.setAttribute("fill", "currentColor");
            if (className) root.setAttribute("class", className);

            let xOffset = 0;
            let maxHeight = 0;

            for (const char of text) {
                if (char === " ") {
                    xOffset += spaceWidth;
                    continue;
                }

                const filename = charToFilename(char);
                if (!filename) continue;

                const svg = await loadSvg(`/icons/bar/${filename}`);
                if (cancelled) return;

                const width =
                    Number(svg.getAttribute("width")) ||
                    svg.viewBox?.baseVal?.width ||
                    0;

                const height =
                    Number(svg.getAttribute("height")) ||
                    svg.viewBox?.baseVal?.height ||
                    0;

                maxHeight = Math.max(maxHeight, height);

                const group = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "g"
                );

                group.setAttribute("transform", `translate(${xOffset}, 0)`);
                group.appendChild(svg);

                root.appendChild(group);

                xOffset += width + letterSpacing;
            }

            root.setAttribute("width", String(xOffset));
            root.setAttribute("height", String(maxHeight));

            containerRef.current.innerHTML = "";
            containerRef.current.appendChild(root);
        };

        render();

        return () => {
            cancelled = true;
        };
    }, [text, letterSpacing, spaceWidth, className]);

    return <div ref={containerRef} />;
};

export default PixelText;