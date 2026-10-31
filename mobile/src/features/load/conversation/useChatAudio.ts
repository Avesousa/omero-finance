import { useCallback, useEffect, useState } from "react";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

/**
 * Reproducción única del chat: un solo reproductor (expo-audio) para todas las burbujas de audio; al tocar otra, la anterior se corta.
 * Se crea una vez en la pantalla y se le pasa a cada burbuja: `toggle(id, uri)` en play/pausa, y la burbuja con
 * `activeId === id` muestra `playing` y `positionMs`. Al terminar, `activeId` vuelve a null.
 */
export function useChatAudio() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (status.didJustFinish && activeId) {
      setActiveId(null);
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, activeId, player]);

  const toggle = useCallback(
    async (id: string, uri: string) => {
      if (activeId === id) {
        if (status.playing) player.pause();
        else player.play();
        return;
      }
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      } catch {
        /* sigue igual: en silencio puede no sonar */
      }
      player.pause();
      player.replace({ uri });
      setActiveId(id);
      player.play();
    },
    [activeId, status.playing, player],
  );

  const stop = useCallback(() => {
    player.pause();
    setActiveId(null);
  }, [player]);

  return {
    /** Burbuja que tiene el reproductor (sonando o en pausa), o null. */
    activeId,
    playing: activeId != null && status.playing,
    /** Avance de la burbuja activa, en ms. */
    positionMs: activeId != null ? Math.round(status.currentTime * 1000) : 0,
    toggle,
    stop,
  };
}
