import { afterEach, describe, expect, it, vi } from "vitest";
import { playSound } from "../engine/audio/playSound";

function fakeAudioFactory(play: () => unknown) {
  return () => ({ play }) as unknown as HTMLAudioElement;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("playSound", () => {
  it("attempts playback via the audio factory for a given src", () => {
    const play = vi.fn().mockReturnValue(undefined);
    const audioFactory = vi.fn(fakeAudioFactory(play));
    playSound("/content/assets/audio/dice_win.mp3", { audioFactory });
    expect(audioFactory).toHaveBeenCalledWith("/content/assets/audio/dice_win.mp3");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the audio factory itself throws", () => {
    const audioFactory = () => {
      throw new Error("boom");
    };
    expect(() => playSound("/missing.mp3", { audioFactory })).not.toThrow();
  });

  it("does not throw when play() throws synchronously", () => {
    const audioFactory = fakeAudioFactory(() => {
      throw new Error("boom");
    });
    expect(() => playSound("/missing.mp3", { audioFactory })).not.toThrow();
  });

  it("does not throw or produce an unhandled rejection when play() returns a rejected promise", async () => {
    const audioFactory = fakeAudioFactory(() => Promise.reject(new Error("boom")));
    expect(() => playSound("/missing.mp3", { audioFactory })).not.toThrow();
    // Flush microtasks so the rejection is actually handled by our .catch()
    // before the test ends (Vitest fails tests on unhandled rejections).
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("does not throw when play() returns undefined (non-promise)", () => {
    const audioFactory = fakeAudioFactory(() => undefined);
    expect(() => playSound("/content/assets/audio/dice_win.mp3", { audioFactory })).not.toThrow();
  });

  it("logs a dev console.warn when playback fails, and does not warn on success", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    playSound("/content/assets/audio/dice_win.mp3", { audioFactory: fakeAudioFactory(() => undefined) });
    expect(warnSpy).not.toHaveBeenCalled();

    playSound("/missing.mp3", {
      audioFactory: () => {
        throw new Error("boom");
      },
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it("resolves the src against a non-root Vite BASE_URL before invoking the audio factory", () => {
    vi.stubEnv("BASE_URL", "/broadsheet-rapier/");
    const play = vi.fn().mockReturnValue(undefined);
    const audioFactory = vi.fn(fakeAudioFactory(play));
    playSound("/content/assets/audio/dice_win.mp3", { audioFactory });
    expect(audioFactory).toHaveBeenCalledWith("/broadsheet-rapier/content/assets/audio/dice_win.mp3");
  });
});
