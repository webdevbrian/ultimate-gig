"use client";

import { useState } from "react";
import type { UgChordShape } from "@/lib/models";
import { GuitarChord } from "./GuitarChord";
import { UkuleleChord } from "./UkuleleChord";
import { PianoChord, parseChordToNotes } from "./PianoChord";

interface ChordDisplayProps {
  chordShapes: Record<string, UgChordShape>;
  isDark?: boolean;
}

type InstrumentType = "guitar" | "ukulele" | "piano";

export function ChordDisplay({ chordShapes, isDark = false }: ChordDisplayProps) {
  const [instrument, setInstrument] = useState<InstrumentType>("guitar");

  const chords = Object.values(chordShapes);

  if (chords.length === 0) {
    return null;
  }

  const buttonClass = (isActive: boolean) =>
    `px-3 py-1 text-xs font-medium rounded transition ${
      isActive
        ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
        : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
    }`;

  return (
    <div className="space-y-3">
      {/* Instrument selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600 dark:text-zinc-400">View as:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInstrument("guitar")}
            className={buttonClass(instrument === "guitar")}
          >
            Guitar
          </button>
          <button
            type="button"
            onClick={() => setInstrument("ukulele")}
            className={buttonClass(instrument === "ukulele")}
          >
            Ukulele
          </button>
          <button
            type="button"
            onClick={() => setInstrument("piano")}
            className={buttonClass(instrument === "piano")}
          >
            Piano
          </button>
        </div>
      </div>

      {/* Chord diagrams */}
      <div
        className="flex flex-wrap gap-3"
        style={{
          maxHeight: "400px",
          overflowY: "auto",
          padding: "4px",
        }}
      >
        {chords.map((chord) => {
          if (instrument === "guitar") {
            return <GuitarChord key={chord.name} chord={chord} isDark={isDark} />;
          }
          if (instrument === "ukulele") {
            return <UkuleleChord key={chord.name} chord={chord} isDark={isDark} />;
          }
          if (instrument === "piano") {
            const notes = parseChordToNotes(chord.name);
            return (
              <PianoChord
                key={chord.name}
                chordName={chord.name}
                notes={notes}
                isDark={isDark}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
