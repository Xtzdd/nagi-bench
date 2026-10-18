export interface VoiceCue {
  id: number;
  start: number;
  end: number;
  scene: string;
  voice: string;
  subtitle: string;
  shot: string;
  sound: string;
}

export interface FilmState {
  time: number;
  duration: number;
  playing: boolean;
  subtitle: string;
  scene: string;
  cueId: number;
  cues: VoiceCue[];
}
