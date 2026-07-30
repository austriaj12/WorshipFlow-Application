// Utility module for Musical Key Transposition and Smart AI Chord-Over-Lyric Alignment Parsing (Image 1 & Image 2 & Section Chord Summary Support)

export const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

const CHROMATIC_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_SEMITONE = {
  'C': 0, 'C#': 1, 'DB': 1,
  'D': 2, 'D#': 3, 'EB': 3,
  'E': 4,
  'F': 5, 'F#': 6, 'GB': 6,
  'G': 7, 'G#': 8, 'AB': 8,
  'A': 9, 'A#': 10, 'BB': 10,
  'B': 11
};

// Regex to detect individual chord tokens (e.g. A, C#m, Bm7, D/F#, Asus4, Gadd9, F#m/C#, Eb, Db, Ebm)
const CHORD_REGEX = /^[A-G][b#]?(?:m|maj|min|dim|aug|sus[24]?|add[91113]?|[245679]|11|13)*(?:\/[A-G][b#]?)?$/;

// Calculate semitone difference between two musical keys (e.g. 'C' -> 'Db' = +1)
export function getSemitoneDifference(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const fromClean = fromKey.trim().toUpperCase();
  const toClean = toKey.trim().toUpperCase();

  const fromVal = NOTE_TO_SEMITONE[fromClean];
  const toVal = NOTE_TO_SEMITONE[toClean];

  if (fromVal === undefined || toVal === undefined) return 0;

  let diff = toVal - fromVal;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

// Transpose a single note (e.g. "C#" or "Ab") by `semitones`
export function transposeNote(note, semitones, preferFlats = false) {
  if (!note) return note;
  const upper = note.toUpperCase();
  if (NOTE_TO_SEMITONE[upper] === undefined) return note;
  
  const currentIdx = NOTE_TO_SEMITONE[upper];
  let targetIdx = (currentIdx + semitones) % 12;
  if (targetIdx < 0) targetIdx += 12;

  const scale = preferFlats ? CHROMATIC_FLATS : CHROMATIC_SHARPS;
  return scale[targetIdx];
}

// Transpose a full chord token (e.g. "A/C#" +2 -> "B/D#", "C#m" +2 -> "D#m")
export function transposeChordToken(chordStr, semitones, preferFlats = false) {
  if (!chordStr || semitones === 0) return chordStr;

  // Handle slash chords (e.g. A/C# -> transpose A and C# separately)
  if (chordStr.includes('/')) {
    const parts = chordStr.split('/');
    const rootTransposed = transposeSingleChordRoot(parts[0], semitones, preferFlats);
    const bassTransposed = transposeNote(parts[1], semitones, preferFlats);
    return `${rootTransposed}/${bassTransposed}`;
  }

  return transposeSingleChordRoot(chordStr, semitones, preferFlats);
}

function transposeSingleChordRoot(chord, semitones, preferFlats) {
  const match = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return chord;
  const root = match[1];
  const suffix = match[2];
  const newRoot = transposeNote(root, semitones, preferFlats);
  return `${newRoot}${suffix}`;
}

// Detect if a string line is composed primarily of chords
export function isChordLine(line) {
  if (!line || !line.trim()) return false;
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  tokens.forEach(tok => {
    // Strip common chord chart punctuation like |, /, (), [], -, 2x, 7x
    const clean = tok.replace(/[|()\[\]\/\-]/g, '').replace(/\d+x$/i, '').trim();
    if (!clean || CHORD_REGEX.test(clean) || tok === '|' || tok === '/' || tok === '-') {
      chordCount++;
    }
  });

  return (chordCount / tokens.length) >= 0.5;
}

// Transpose all chords within a multi-line chord chart string by `semitones`
export function transposeChordChart(text, semitones, preferFlats = false) {
  if (!text || semitones === 0) return text;

  const lines = text.split('\n');
  return lines.map(line => {
    // Check if line contains Key definition (e.g. "Key: Db")
    if (/^Key\s*:/i.test(line.trim())) {
      const parts = line.split(':');
      const keyVal = parts[1] ? parts[1].trim() : '';
      const newKeyVal = transposeNote(keyVal, semitones, preferFlats);
      return `Key: ${newKeyVal}`;
    }

    if (!isChordLine(line)) return line;

    let newLine = '';
    let i = 0;
    while (i < line.length) {
      if (/\s|[|()\[\]\-]/.test(line[i])) {
        newLine += line[i];
        i++;
      } else {
        let token = '';
        while (i < line.length && !/\s|[|()\[\]\-]/.test(line[i])) {
          token += line[i];
          i++;
        }
        const cleanToken = token.replace(/\d+x$/i, '');
        const multiplier = token.slice(cleanToken.length);

        if (CHORD_REGEX.test(cleanToken) || cleanToken.includes('/')) {
          const transposed = transposeChordToken(cleanToken, semitones, preferFlats);
          newLine += `${transposed}${multiplier}`;
        } else {
          newLine += token;
        }
      }
    }
    return newLine;
  }).join('\n');
}

// Parse presentation lyrics raw string into section mapping (e.g. { VERSE 1: ["THIS IS THE DAY...", ...], CHORUS: [...] })
export function parsePresentationLyricsSections(rawLyrics) {
  if (!rawLyrics || !rawLyrics.trim()) return {};
  const lines = rawLyrics.split('\n');
  
  const sectionMap = {};
  let currentLabel = 'MAIN';
  sectionMap[currentLabel] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const isHeader = /^(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|TAG|PRE-CHORUS|POST-CHORUS|REFRAIN|INTERLUDE|ENDING|INSTRUMENTAL|TURNAROUND)/i.test(trimmed);

    if (isHeader) {
      currentLabel = trimmed.toUpperCase();
      if (!sectionMap[currentLabel]) {
        sectionMap[currentLabel] = [];
      }
    } else {
      if (!sectionMap[currentLabel]) sectionMap[currentLabel] = [];
      sectionMap[currentLabel].push(trimmed);
    }
  });

  return sectionMap;
}

// Smart AI Parser: Converts multi-line chord charts and maps chords directly onto presentation lyrics lines
export function parseChordChartToSections(rawText, semitones = 0, presentationLyricsRaw = '') {
  if (!rawText || !rawText.trim()) return [];

  const textToParse = semitones !== 0 ? transposeChordChart(rawText, semitones) : rawText;
  const lines = textToParse.split('\n');
  
  const presentationMap = presentationLyricsRaw ? parsePresentationLyricsSections(presentationLyricsRaw) : {};

  const sections = [];
  let currentSection = {
    label: 'CHORDS',
    pairs: []
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (/^Key\s*:/i.test(trimmed)) {
      i++;
      continue;
    }

    const isHeader = /^(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|TAG|PRE-CHORUS|POST-CHORUS|REFRAIN|INTERLUDE|ENDING|INSTRUMENTAL|TURNAROUND)/i.test(trimmed);

    if (isHeader) {
      if (currentSection.pairs.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        label: trimmed.toUpperCase(),
        pairs: []
      };
      i++;
      continue;
    }

    if (isChordLine(line)) {
      const chordLineText = line;
      let lyricLineText = '';

      if (i + 1 < lines.length && !isChordLine(lines[i + 1]) && !/^(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|TAG|PRE-CHORUS|POST-CHORUS|REFRAIN|INTERLUDE|ENDING|INSTRUMENTAL|TURNAROUND)/i.test(lines[i + 1].trim())) {
        lyricLineText = lines[i + 1];
        i += 2;
      } else {
        i += 1;
      }

      currentSection.pairs.push({
        chords: chordLineText,
        lyrics: lyricLineText
      });
    } else {
      const lyricLineText = line;
      let chordLineText = '';

      if (i + 1 < lines.length && isChordLine(lines[i + 1])) {
        chordLineText = lines[i + 1];
        i += 2;
      } else {
        i += 1;
      }

      currentSection.pairs.push({
        chords: chordLineText,
        lyrics: lyricLineText
      });
    }
  }

  if (currentSection.pairs.length > 0) {
    sections.push(currentSection);
  }

  // Smart Section Mapping: If chord summary (e.g. Verse: Db Gb - Db) is provided,
  // distribute chord progressions onto matching presentation lyrics lines!
  if (presentationLyricsRaw && sections.length > 0) {
    sections.forEach(sec => {
      const secNorm = sec.label.replace(/\s*\d+$/, '').trim();
      let matchedLyricsLines = null;

      // Find best section match in presentation lyrics
      Object.keys(presentationMap).forEach(key => {
        const keyNorm = key.replace(/\s*\d+$/, '').trim();
        if (keyNorm === secNorm || key.includes(secNorm) || sec.label.includes(keyNorm)) {
          matchedLyricsLines = presentationMap[key];
        }
      });

      if (matchedLyricsLines && matchedLyricsLines.length > 0) {
        const hasLyricsInPairs = sec.pairs.some(p => p.lyrics && p.lyrics.trim());
        if (!hasLyricsInPairs) {
          const chordLines = sec.pairs.map(p => p.chords).filter(Boolean);
          if (chordLines.length > 0) {
            const newPairs = [];
            matchedLyricsLines.forEach((lyricLine, idx) => {
              const assignedChord = chordLines[idx % chordLines.length] || '';
              newPairs.push({
                chords: assignedChord,
                lyrics: lyricLine
              });
            });
            sec.pairs = newPairs;
          }
        }
      }
    });
  }

  return sections;
}
