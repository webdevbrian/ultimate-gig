"use client";

interface PianoChordProps {
  chordName: string;
  notes: string[];
  isDark?: boolean;
  scale?: number;
}

// Map note names to piano key indices (C = 0, C# = 1, D = 2, etc.)
const noteToIndex: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

// Which keys are black keys (sharps/flats)
const blackKeyIndices = [1, 3, 6, 8, 10];

export function PianoChord({ chordName, notes, isDark = false, scale = 1 }: PianoChordProps) {
  const whiteKeyWidth = 28 * scale;
  const whiteKeyHeight = 100 * scale;
  const blackKeyWidth = 18 * scale;
  const blackKeyHeight = 65 * scale;
  const numOctaves = 2; // Show 2 octaves
  const numWhiteKeys = 7 * numOctaves + 1; // C-C for each octave
  const leftMargin = 10 * scale;
  const topMargin = 30 * scale;
  const padding = 8 * scale;
  const borderRadius = 6 * scale;
  const width = leftMargin + numWhiteKeys * whiteKeyWidth + 10 * scale;
  const height = topMargin + whiteKeyHeight + 20 * scale;

  // Colors based on theme
  const backgroundColor = isDark ? "#1a1a1a" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#000000";
  const whiteKeyColor = isDark ? "#e5e5e5" : "#ffffff";
  const whiteKeyStroke = isDark ? "#666666" : "#000000";
  const blackKeyColor = isDark ? "#1a1a1a" : "#000000";
  const highlightColor = isDark ? "#facc15" : "#fbbf24";

  // Parse notes and determine which keys to highlight
  const highlightedKeys = new Set<number>();
  notes.forEach((note) => {
    const baseNote = note.replace(/\d+$/, ""); // Remove octave number
    const octave = Number.parseInt(note.match(/\d+$/)?.[0] || "4", 10);
    const noteIndex = noteToIndex[baseNote];
    if (noteIndex !== undefined) {
      // Calculate absolute key index (0 = C4, 12 = C5, etc.)
      const keyIndex = (octave - 4) * 12 + noteIndex;
      highlightedKeys.add(keyIndex);
    }
  });

  // Helper to get black key position
  const getBlackKeyX = (keyIndex: number): number => {
    const whiteKeysPerOctave = 7;
    const octave = Math.floor(keyIndex / 12);
    const noteInOctave = keyIndex % 12;
    // Black keys sit between white keys
    const blackKeyMap: Record<number, number> = {
      1: 0.7, // C#/Db (between C and D)
      3: 1.7, // D#/Eb (between D and E)
      6: 3.7, // F#/Gb (between F and G)
      8: 4.7, // G#/Ab (between G and A)
      10: 5.7, // A#/Bb (between A and B)
    };
    const blackKeyOffset = blackKeyMap[noteInOctave];
    if (blackKeyOffset === undefined) return -1;
    return leftMargin + (octave * whiteKeysPerOctave + blackKeyOffset) * whiteKeyWidth;
  };

  return (
    <div
      style={{
        display: "inline-block",
        padding: `${padding}px`,
        backgroundColor,
        borderRadius: `${borderRadius}px`,
      }}
    >
      <svg width={width} height={height} xmlns="http://www.w3.org/2000/svg">
        {/* Chord name */}
        <text
          x={width / 2}
          y={15 * scale}
          textAnchor="middle"
          style={{
            fontSize: `${14 * scale}px`,
            fontWeight: "600",
            fill: textColor,
          }}
        >
          {chordName}
        </text>

        {/* Draw white keys */}
        {Array.from({ length: numWhiteKeys }).map((_, whiteKeyIndex) => {
          // Calculate which absolute key this is (C4 = 0, D4 = 2, etc.)
          const octave = Math.floor(whiteKeyIndex / 7) + 4;
          const whiteKeyInOctave = whiteKeyIndex % 7;
          const noteMap = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
          const noteInOctave = noteMap[whiteKeyInOctave];
          const absoluteKey = (octave - 4) * 12 + noteInOctave;
          const isHighlighted = highlightedKeys.has(absoluteKey);

          const x = leftMargin + whiteKeyIndex * whiteKeyWidth;

          return (
            <rect
              key={`white-${whiteKeyIndex}`}
              x={x}
              y={topMargin}
              width={whiteKeyWidth}
              height={whiteKeyHeight}
              fill={isHighlighted ? highlightColor : whiteKeyColor}
              stroke={whiteKeyStroke}
              strokeWidth={1 * scale}
            />
          );
        })}

        {/* Draw black keys */}
        {Array.from({ length: numOctaves }).map((_, octave) => {
          return blackKeyIndices.map((blackIndex) => {
            const absoluteKey = (octave + 4 - 4) * 12 + blackIndex;
            const isHighlighted = highlightedKeys.has(absoluteKey);
            const x = getBlackKeyX(absoluteKey);
            if (x < 0) return null;

            return (
              <rect
                key={`black-${octave}-${blackIndex}`}
                x={x}
                y={topMargin}
                width={blackKeyWidth}
                height={blackKeyHeight}
                fill={isHighlighted ? highlightColor : blackKeyColor}
                stroke={whiteKeyStroke}
                strokeWidth={1 * scale}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}

// Helper function to convert chord name to notes
export function parseChordToNotes(chordName: string): string[] {
  // This is a simplified chord parser. In a real implementation,
  // you'd want a more comprehensive chord library.
  const baseNote = chordName.match(/^[A-G][#b]?/)?.[0] || "C";
  const chordType = chordName.substring(baseNote.length);

  // Common chord patterns (intervals from root)
  const chordPatterns: Record<string, number[]> = {
    "": [0, 4, 7], // Major triad
    m: [0, 3, 7], // Minor triad
    7: [0, 4, 7, 10], // Dominant 7th
    maj7: [0, 4, 7, 11], // Major 7th
    m7: [0, 3, 7, 10], // Minor 7th
    dim: [0, 3, 6], // Diminished
    aug: [0, 4, 8], // Augmented
    sus2: [0, 2, 7], // Suspended 2nd
    sus4: [0, 5, 7], // Suspended 4th
    "6": [0, 4, 7, 9], // Major 6th
    m6: [0, 3, 7, 9], // Minor 6th
  };

  const intervals = chordPatterns[chordType] || chordPatterns[""];
  const rootIndex = noteToIndex[baseNote] || 0;

  // Generate notes in the 4th octave
  const notes = intervals.map((interval) => {
    const noteIndex = (rootIndex + interval) % 12;
    const noteName = Object.keys(noteToIndex).find(
      (key) => noteToIndex[key] === noteIndex && !key.includes("b"),
    );
    return `${noteName}4`;
  });

  return notes;
}
