import { VOICE_CUES, type VoiceCue } from '../film/voices';

/**
 * Bottom-centered 【speaker】 line, driven straight off the cue manifest.
 * Presentation is fixed by the brief — no other styling is introduced — so a
 * dubbing pass can attach real audio by `id` and the picture stays in sync.
 */
export function Subtitle({ t }: { t: number }) {
  const cue: VoiceCue | undefined = VOICE_CUES.find(c => t >= c.start && t < c.end);
  if (!cue) return null;
  return (
    <div className="subtitle" key={cue.id}>
      <span className="spk">【{cue.speaker}】</span>
      <span className="txt">{cue.text}</span>
    </div>
  );
}
