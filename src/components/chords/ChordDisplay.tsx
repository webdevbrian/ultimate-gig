"use client";

import type { UgChordShape } from "@/lib/models";
import { GuitarChord } from "./GuitarChord";
import { UkuleleChord } from "./UkuleleChord";
import { BanjoChord } from "./BanjoChord";
import { PianoChord, parseChordToNotes } from "./PianoChord";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface ChordDisplayProps {
  chordShapes: Record<string, UgChordShape>;
  isDark?: boolean;
}

type InstrumentType = "guitar" | "ukulele" | "banjo" | "piano";

export function ChordDisplay({ chordShapes, isDark = false }: ChordDisplayProps) {
  const [instrument, setInstrument] = useLocalStorage<InstrumentType>(
    "ultimate-gig:ui:chord-instrument",
    "ukulele",
  );
  const [scale, setScale, hasHydrated] = useLocalStorage<number>(
    "ultimate-gig:ui:chord-scale",
    1,
  );

  const adjustScale = (delta: number) => {
    const MIN_SCALE = 0.7;
    const MAX_SCALE = 1.5;
    const STEP = 0.15;
    setScale((prev) => {
      const next = prev + delta * STEP;
      if (next < MIN_SCALE) return MIN_SCALE;
      if (next > MAX_SCALE) return MAX_SCALE;
      return Number(next.toFixed(2));
    });
  };

  const chords = Object.values(chordShapes);

  if (chords.length === 0) {
    return null;
  }

  const buttonClass = (isActive: boolean) =>
    `px-3 py-1 text-xs font-medium rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
      isActive
        ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
        : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
    }`;

  return (
    <div className="space-y-3">
      {/* Instrument selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">View as:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInstrument("ukulele")}
            className={buttonClass(instrument === "ukulele")}
          >
            Ukulele
          </button>
          <button
            type="button"
            onClick={() => setInstrument("banjo")}
            className={buttonClass(instrument === "banjo")}
          >
            Banjo
          </button>
          <button
            type="button"
            onClick={() => setInstrument("guitar")}
            className={buttonClass(instrument === "guitar")}
          >
            Guitar
          </button>
          <button
            type="button"
            onClick={() => setInstrument("piano")}
            className={buttonClass(instrument === "piano")}
          >
            Piano
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          Size:
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Decrease chord size"
              className={buttonClass(false)}
              onClick={() => adjustScale(-1)}
              disabled={!hasHydrated || scale <= 0.7}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Increase chord size"
              className={buttonClass(false)}
              onClick={() => adjustScale(1)}
              disabled={!hasHydrated || scale >= 1.5}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Chord diagrams */}
      <div
        className="flex flex-wrap gap-x-3 gap-y-6"
        style={{
          maxHeight: "400px",
          overflowY: "auto",
          padding: "4px",
        }}
      >
        {chords.map((chord) => {
          if (instrument === "guitar") {
            return <GuitarChord key={chord.name} chord={chord} isDark={isDark} scale={scale} />;
          }
          if (instrument === "ukulele") {
            return <UkuleleChord key={chord.name} chord={chord} isDark={isDark} scale={scale} />;
          }
          if (instrument === "banjo") {
            return <BanjoChord key={chord.name} chord={chord} isDark={isDark} scale={scale} />;
          }
          if (instrument === "piano") {
            const notes = parseChordToNotes(chord.name);
            return (
              <PianoChord
                key={chord.name}
                chordName={chord.name}
                notes={notes}
                isDark={isDark}
                scale={scale}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
