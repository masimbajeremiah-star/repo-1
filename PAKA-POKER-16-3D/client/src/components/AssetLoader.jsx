import { useEffect, useState } from 'react';
import { preloadAssets, cardBackTexture, cardFaceTextures, sounds, textures, models } from '../assets';


/*
 * Non-blocking game AssetLoader
 *
 * IMPORTANT:
 * Asset loading must never leave the game permanently stuck on
 * "Loading game assets" / "Preparing game...".
 */

const LOAD_TIMEOUT = 8000;

const loadAudio = (url) => {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== "string") {
      reject(new Error("Invalid audio URL"));
      return;
    }

    const audio = new Audio();

    let finished = false;

    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      callback(value);
    };

    const timeout = setTimeout(() => {
      console.warn(
        `[AssetLoader] Audio timeout after ${LOAD_TIMEOUT}ms: ${url}`
      );

      finish(reject, new Error(`Audio timeout: ${url}`));
    }, LOAD_TIMEOUT);

    audio.crossOrigin = "anonymous";

    audio.addEventListener(
      "canplaythrough",
      () => {
        console.log(`[AssetLoader] Audio loaded: ${url}`);
        finish(resolve, audio);
      },
      { once: true }
    );

    audio.addEventListener(
      "error",
      (event) => {
        const mediaError = audio.error;

        console.error("[AssetLoader] Audio failed:", {
          url,
          src: audio.src,
          code: mediaError?.code,
          message:
            mediaError?.message || "Unknown media error",
          event,
        });

        finish(
          reject,
          new Error(
            `Failed to load audio: ${url}`
          )
        );
      },
      { once: true }
    );

    audio.src = url;
    audio.load();
  });
};


export default function AssetLoader({
  children,
  assets = [],
  onLoaded,
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const prepareGame = async () => {
      console.log("[AssetLoader] Loading game assets...");

      try {
        /*
         * Audio assets are optional.
         * A failed sound must NOT prevent the game itself
         * from starting.
         */
        const audioAssets = Array.isArray(assets)
          ? assets.filter(
              (asset) =>
                typeof asset === "string" &&
                /\.(mp3|wav|ogg|m4a)$/i.test(asset)
            )
          : [];

        if (audioAssets.length > 0) {
          await Promise.allSettled(
            audioAssets.map((url) => loadAudio(url))
          );
        }

        /*
         * Give the browser one frame to finish mounting
         * the Three.js scene.
         */
        await new Promise((resolve) =>
          requestAnimationFrame(resolve)
        );

        if (!mounted) return;

        console.log("[AssetLoader] Game preparation complete.");

        setLoading(false);

        if (typeof onLoaded === "function") {
          onLoaded();
        }
      } catch (error) {
        /*
         * Never permanently block the game because an optional
         * asset failed.
         */
        console.error(
          "[AssetLoader] Non-fatal asset loading error:",
          error
        );

        if (!mounted) return;

        setLoading(false);

        if (typeof onLoaded === "function") {
          onLoaded();
        }
      }
    };

    prepareGame();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * CRITICAL FALLBACK:
   *
   * Even if something unexpected happens during asset loading,
   * allow the game to appear instead of leaving the player on
   * the loading screen forever.
   */
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!loading) return;
      console.warn(
        "[AssetLoader] Global loading timeout reached. Starting game anyway."
      );
      setLoading(false);
      if (typeof onLoaded === "function") onLoaded();
    }, 10000);

    return () => clearTimeout(fallback);
  }, [loading, onLoaded]);

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background: "#07111f",
          color: "#ffffff",
          fontFamily:
            "Arial, Helvetica, sans-serif",
          zIndex: 999999,
        }}
      >
        <div
          style={{
            fontSize: "24px",
            fontWeight: "700",
            marginBottom: "12px",
          }}
        >
          Loading game assets
        </div>

        <div
          style={{
            fontSize: "15px",
            opacity: 0.75,
          }}
        >
          Preparing game...
        </div>
      </div>
    );
  }

  return children;
}
