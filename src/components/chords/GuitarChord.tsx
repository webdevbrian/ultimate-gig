"use client";

import type { UgChordShape } from "@/lib/models";

interface GuitarChordProps {
  chord: UgChordShape;
  isDark?: boolean;
}

export function GuitarChord({ chord, isDark = false }: GuitarChordProps) {
  const { name, baseFret, frets, fingers, barres } = chord;

  // Constants for rendering
  const numStrings = 6;
  const numFrets = 5;
  const stringSpacing = 24;
  const fretHeight = 28;
  const leftMargin = 30;
  const topMargin = 30;
  const width = leftMargin + stringSpacing * (numStrings - 1) + 20;
  const height = topMargin + fretHeight * numFrets + 20;

  // Colors based on theme
  const lineColor = isDark ? "#ffffff" : "#000000";
  const mutedColor = isDark ? "#666666" : "#999999";
  const backgroundColor = isDark ? "#1a1a1a" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#000000";
  const dotColor = isDark ? "#ffffff" : "#000000";
  const barreColor = isDark ? "#ffffff" : "#000000";

  // Calculate the highest fret used
  const maxFret = Math.max(...frets.filter((f) => f >= 0));
  const displayBaseFret = baseFret > 1 ? baseFret : 1;

  return (
    <div
      style={{
        display: "inline-block",
        padding: "8px",
        backgroundColor,
        borderRadius: "6px",
      }}
    >
      <svg width={width} height={height} xmlns="http://www.w3.org/2000/svg">
        {/* Chord name */}
        <text
          x={width / 2}
          y={15}
          textAnchor="middle"
          style={{
            fontSize: "14px",
            fontWeight: "600",
            fill: textColor,
          }}
        >
          {name}
        </text>

        {/* Base fret indicator (if not at fret 1) */}
        {displayBaseFret > 1 && (
          <text
            x={leftMargin - 12}
            y={topMargin + fretHeight / 2}
            textAnchor="end"
            style={{
              fontSize: "11px",
              fill: textColor,
            }}
          >
            {displayBaseFret}fr
          </text>
        )}

        {/* Draw frets */}
        {Array.from({ length: numFrets + 1 }).map((_, fretIndex) => {
          const y = topMargin + fretIndex * fretHeight;
          const strokeWidth = fretIndex === 0 && baseFret === 1 ? 3 : 1;
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
              strokeWidth={1}
            />
          );
        })}

        {/* Draw barres */}
        {barres.map((barre, index) => {
          const fretNum = barre.fret - displayBaseFret + 1;
          if (fretNum < 0 || fretNum > numFrets) return null;

          const y = topMargin + (fretNum - 0.5) * fretHeight;
          // Reverse the barre positions to match reversed strings
          const x1 = leftMargin + (numStrings - 1 - barre.lastString) * stringSpacing;
          const x2 = leftMargin + (numStrings - 1 - barre.startString) * stringSpacing;

          return (
            <g key={`barre-${index}`}>
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={barreColor}
                strokeWidth={16}
                strokeLinecap="round"
                opacity={0.9}
              />
            </g>
          );
        })}

        {/* Draw finger positions and open/muted indicators */}
        {frets.map((fret, stringIndex) => {
          // Reverse the string order (high E on left, low E on right)
          const displayIndex = numStrings - 1 - stringIndex;
          const x = leftMargin + displayIndex * stringSpacing;

          // Muted string (x)
          if (fret === -1) {
            return (
              <g key={`string-${stringIndex}-indicator`}>
                <line
                  x1={x - 4}
                  y1={topMargin - 16}
                  x2={x + 4}
                  y2={topMargin - 8}
                  stroke={mutedColor}
                  strokeWidth={2}
                />
                <line
                  x1={x - 4}
                  y1={topMargin - 8}
                  x2={x + 4}
                  y2={topMargin - 16}
                  stroke={mutedColor}
                  strokeWidth={2}
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
                cy={topMargin - 12}
                r={5}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          }

          // Finger position
          const fretNum = fret - displayBaseFret + 1;
          if (fretNum < 0 || fretNum > numFrets) return null;

          const y = topMargin + (fretNum - 0.5) * fretHeight;

          return (
            <g key={`string-${stringIndex}-dot`}>
              <circle cx={x} cy={y} r={7} fill={dotColor} />
              {fingers[stringIndex] > 0 && (
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    fill: isDark ? "#000000" : "#ffffff",
                  }}
                >
                  {fingers[stringIndex]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
