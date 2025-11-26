"use client";

import type { UgChordShape } from "@/lib/models";

interface BanjoChordProps {
  chord: UgChordShape;
  isDark?: boolean;
  scale?: number;
}

export function BanjoChord({ chord, isDark = false, scale = 1 }: BanjoChordProps) {
  const { name, baseFret, frets, fingers, barres } = chord;

  const numStrings = 5;
  const numFrets = 5;
  const stringSpacing = 24 * scale;
  const fretHeight = 28 * scale;
  const leftMargin = 30 * scale;
  const chordNameY = 22 * scale;
  const topMargin = 30 * scale + chordNameY;
  const padding = 8 * scale;
  const width = leftMargin + stringSpacing * (numStrings - 1) + 20 * scale;
  const height = topMargin + fretHeight * numFrets + 20 * scale;

  const lineColor = isDark ? "#ffffff" : "#000000";
  const mutedColor = isDark ? "#666666" : "#999999";
  const backgroundColor = isDark ? "#1a1a1a" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#000000";
  const dotColor = isDark ? "#ffffff" : "#000000";
  const barreColor = isDark ? "#ffffff" : "#000000";

  // Map guitar strings (low E to high E) to banjo Open G order (g D G B D)
  // Guitar indices: [0:E2,1:A2,2:D3,3:G3,4:B3,5:E4]
  // Banjo order: 5th string high g (G3) -> guitar index 3, then D string -> index 2,
  // G string -> index 3 (reuse, but treat as same pitch), B string -> index 4, D string -> index 2.
  const banjoSourceIndices = [3, 2, 3, 4, 2];
  const banjoFrets = banjoSourceIndices.map((index) => frets[index] ?? -1);
  const banjoFingers = banjoSourceIndices.map((index) => fingers[index] ?? 0);

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

        {barres.map((barre, index) => {
          const fretNum = barre.fret - displayBaseFret + 1;
          if (fretNum < 0 || fretNum > numFrets) return null;

          const startString = Math.min(barre.startString, numStrings - 1);
          const lastString = Math.min(barre.lastString, numStrings - 1);

          const y = topMargin + (fretNum - 0.5) * fretHeight;
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

        {banjoFrets.map((fret, stringIndex) => {
          const displayIndex = numStrings - 1 - stringIndex;
          const x = leftMargin + displayIndex * stringSpacing;

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

          const fretNum = fret - displayBaseFret + 1;
          if (fretNum < 0 || fretNum > numFrets) return null;

          const y = topMargin + (fretNum - 0.5) * fretHeight;

          return (
            <g key={`string-${stringIndex}-dot`}>
              <circle cx={x} cy={y} r={7 * scale} fill={dotColor} />
              {banjoFingers[stringIndex] > 0 && (
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
                  {banjoFingers[stringIndex]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
