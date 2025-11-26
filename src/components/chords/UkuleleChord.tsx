"use client";

import type { UgChordShape } from "@/lib/models";

interface UkuleleChordProps {
  chord: UgChordShape;
  isDark?: boolean;
  scale?: number;
}

export function UkuleleChord({ chord, isDark = false, scale = 1 }: UkuleleChordProps) {
  const { name, baseFret, frets, fingers, barres } = chord;

  // Constants for rendering - ukulele has 4 strings
  const numStrings = 4;
  const numFrets = 5;
  const stringSpacing = 24 * scale;
  const fretHeight = 28 * scale;
  const leftMargin = 30 * scale;
  const chordNameY = 22 * scale;
  const topMargin = 30 * scale + chordNameY;
  const padding = 8 * scale;
  const width = leftMargin + stringSpacing * (numStrings - 1) + 20 * scale;
  const height = topMargin + fretHeight * numFrets + 20 * scale;

  // Colors based on theme
  const lineColor = isDark ? "#ffffff" : "#000000";
  const mutedColor = isDark ? "#666666" : "#999999";
  const backgroundColor = isDark ? "#1a1a1a" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#000000";
  const dotColor = isDark ? "#ffffff" : "#000000";
  const barreColor = isDark ? "#ffffff" : "#000000";

  // Map guitar-based frets to ukulele standard tuning (C E A with re-entrant G)
  const ukuleleSourceIndices = [2, 4, 5, 3]; // approx: C, E, A, high G
  const ukuleleFrets = ukuleleSourceIndices.map((index) => frets[index] ?? -1);
  const ukuleleFingers = ukuleleSourceIndices.map((index) => fingers[index] ?? 0);

  const displayBaseFret = baseFret > 1 ? baseFret : 1;

  return (
    <div
      style={{
        display: "inline-block",
        padding: `${padding}px`,
        backgroundColor,
        borderRadius: `${6 * scale}px`,
      }}
    >
      <svg width={width} height={height} xmlns="http://www.w3.org/2000/svg">
        {/* Chord name */}
        <text
          x={width / 2}
          y={chordNameY}
          textAnchor="middle"
          style={{
            fontSize: `${14 * scale}px`,
            fontWeight: "600",
            fill: textColor,
          }}
        >
          {name}
        </text>

        {/* Base fret indicator (if not at fret 1) */}
        {displayBaseFret > 1 && (
          <text
            x={leftMargin - 12 * scale}
            y={topMargin + fretHeight / 2}
            textAnchor="end"
            style={{
              fontSize: `${11 * scale}px`,
              fill: textColor,
            }}
          >
            {displayBaseFret}fr
          </text>
        )}

        {/* Draw frets */}
        {Array.from({ length: numFrets + 1 }).map((_, fretIndex) => {
          const y = topMargin + fretIndex * fretHeight;
          const strokeWidth = (fretIndex === 0 && baseFret === 1 ? 3 : 1) * scale;
          return (
            <line
              key={`fret-${fretIndex}`}
              x1={leftMargin}
              y1={y}
              x2={leftMargin + stringSpacing * (numStrings - 1)}
              y2={y}
              stroke={lineColor}
              strokeWidth={strokeWidth}
            />
          );
        })}

        {/* Draw strings */}
        {Array.from({ length: numStrings }).map((_, stringIndex) => {
          const x = leftMargin + stringIndex * stringSpacing;
          return (
            <line
              key={`string-${stringIndex}`}
              x1={x}
              y1={topMargin}
              x2={x}
              y2={topMargin + fretHeight * numFrets}
              stroke={lineColor}
              strokeWidth={1 * scale}
            />
          );
        })}

        {/* Draw barres (adjusted for ukulele) */}
        {barres.map((barre, index) => {
          const fretNum = barre.fret - displayBaseFret + 1;
          if (fretNum < 0 || fretNum > numFrets) return null;

          // Only show barre within the 4 ukulele strings
          const startString = Math.min(barre.startString, numStrings - 1);
          const lastString = Math.min(barre.lastString, numStrings - 1);

          const y = topMargin + (fretNum - 0.5) * fretHeight;
          // Reverse the barre positions to match reversed strings
          const x1 = leftMargin + (numStrings - 1 - lastString) * stringSpacing;
          const x2 = leftMargin + (numStrings - 1 - startString) * stringSpacing;

          return (
            <g key={`barre-${index}`}>
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={barreColor}
                strokeWidth={16 * scale}
                strokeLinecap="round"
                opacity={0.9}
              />
            </g>
          );
        })}

        {/* Draw finger positions and open/muted indicators */}
        {ukuleleFrets.map((fret, stringIndex) => {
          // Reverse the string order (high A on left, low G on right)
          const displayIndex = numStrings - 1 - stringIndex;
          const x = leftMargin + displayIndex * stringSpacing;

          // Muted string (x)
          if (fret === -1) {
            return (
              <g key={`string-${stringIndex}-indicator`}>
                <line
                  x1={x - 4 * scale}
                  y1={topMargin - 16 * scale}
                  x2={x + 4 * scale}
                  y2={topMargin - 8 * scale}
                  stroke={mutedColor}
                  strokeWidth={2 * scale}
                />
                <line
                  x1={x - 4 * scale}
                  y1={topMargin - 8 * scale}
                  x2={x + 4 * scale}
                  y2={topMargin - 16 * scale}
                  stroke={mutedColor}
                  strokeWidth={2 * scale}
                />
              </g>
            );
          }

          // Open string (o)
          if (fret === 0) {
            return (
              <circle
                key={`string-${stringIndex}-indicator`}
                cx={x}
                cy={topMargin - 12 * scale}
                r={5 * scale}
                fill="none"
                stroke={lineColor}
                strokeWidth={2 * scale}
              />
            );
          }

          // Finger position
          const fretNum = fret - displayBaseFret + 1;
          if (fretNum < 0 || fretNum > numFrets) return null;

          const y = topMargin + (fretNum - 0.5) * fretHeight;

          return (
            <g key={`string-${stringIndex}-dot`}>
              <circle cx={x} cy={y} r={7 * scale} fill={dotColor} />
              {ukuleleFingers[stringIndex] > 0 && (
                <text
                  x={x}
                  y={y + 1 * scale}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontSize: `${10 * scale}px`,
                    fontWeight: "600",
                    fill: isDark ? "#000000" : "#ffffff",
                  }}
                >
                  {ukuleleFingers[stringIndex]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
