// Deliberate contrast with AssetFallback: a missing/failed *image* is loudly
// flagged (purple MISSING placeholder) because content authors need to catch
// it during development. A missing/failed *sound* degrades silently — SFX
// are non-blocking and non-critical to gameplay, and an audible glitch or a
// thrown error would be a worse player experience than simply no sound.

import { resolveAssetUrl } from "../utils/resolveAssetUrl";

export interface PlaySoundOptions {
  audioFactory?: (src: string) => HTMLAudioElement;
}

export function playSound(src: string, options: PlaySoundOptions = {}): void {
  const audioFactory = options.audioFactory ?? ((path: string) => new Audio(path));

  try {
    const audio = audioFactory(resolveAssetUrl(src));
    const playResult = audio.play();
    if (playResult && typeof playResult.then === "function") {
      playResult.catch((err: unknown) => {
        if (import.meta.env.DEV) {
          console.warn(`[playSound] failed to play "${src}":`, err);
        }
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[playSound] failed to play "${src}":`, err);
    }
  }
}
