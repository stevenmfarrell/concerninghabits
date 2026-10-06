// The app draws emoji in Noto Emoji, a black-and-white font. Two things make a browser skip it for
// the system's color emoji: a skin-tone modifier (U+1F3FB–U+1F3FF), which the font has no variants
// for, and the emoji presentation selector (U+FE0F), which Chrome takes as a request for color.
// Names are stored as written and cleaned when read (see src/lib/prisma.ts); ZWJ sequences still
// join without FE0F.
const COLOR_EMOJI_MARKS = /[\u{1F3FB}-\u{1F3FF}\u{FE0F}]/gu;

export function stripColorEmojiMarks(text: string) {
  return text.replace(COLOR_EMOJI_MARKS, '');
}
