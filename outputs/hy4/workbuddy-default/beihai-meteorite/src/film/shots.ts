// Shot list and camera choreography.
//
// A shot owns a time range, a set, and a list of camera keyframes. The engine
// finds the active shot, interpolates position + look-at between keyframes with
// a smoothstep ease, and hands the set its local time.

import { FILM_DURATION } from './voices';

export type SetId = 'titles' | 'orbit' | 'chamber' | 'quarters' | 'workshop'
  | 'bay' | 'pod' | 'theshot' | 'aftermath' | 'credits';

export interface Key {
  t: number;                                  // absolute film time
  p: [number, number, number];                // camera position
  l: [number, number, number];                // look-at target
  fov?: number;
}

export interface Shot {
  id: string;
  set: SetId;
  start: number;
  end: number;
  label: string;
  keys: Key[];
}

export const SHOTS: Shot[] = [
  {
    id: 's1', set: 'titles', start: 0, end: 18, label: '片头 / Titles',
    keys: [
      { t: 0, p: [0, 0, 30], l: [0, 0, 0], fov: 46 },
      { t: 18, p: [2.4, 1.2, 13], l: [0, 0, 0], fov: 52 }
    ]
  },
  {
    id: 's2', set: 'orbit', start: 18, end: 52, label: '轨道 / Orbit',
    keys: [
      { t: 18, p: [-15, 11, 27], l: [4, -28, -30], fov: 54 },
      { t: 34, p: [-7, 5, 20], l: [6, -38, -34], fov: 50 },
      { t: 52, p: [1, 0.5, 13], l: [6, -46, -34], fov: 44 }
    ]
  },
  {
    id: 's3', set: 'chamber', start: 52, end: 92, label: '会议厅 / Chamber',
    keys: [
      { t: 52, p: [0.5, 7.2, 12.5], l: [0, 1.4, 0], fov: 48 },
      { t: 62, p: [0.5, 4.6, 8.6], l: [0, 1.4, 0], fov: 44 },
      { t: 70, p: [-4.2, 2.5, 4.4], l: [-3.0, 1.5, -1.4], fov: 38 },
      { t: 78, p: [4.8, 2.5, 4.2], l: [3.2, 1.5, -1.4], fov: 38 },
      { t: 85, p: [4.4, 1.9, 5.4], l: [2.6, 1.5, 2.1], fov: 34 },
      { t: 92, p: [3.0, 1.7, 4.0], l: [2.6, 1.45, 2.2], fov: 30 }
    ]
  },
  {
    id: 's4', set: 'quarters', start: 92, end: 128, label: '舱室 / Quarters',
    keys: [
      { t: 92, p: [3.8, 2.8, 4.8], l: [-0.4, 1.5, 0.6], fov: 42 },
      { t: 104, p: [1.8, 2.0, 3.2], l: [-0.4, 1.5, 0.6], fov: 36 },
      { t: 116, p: [2.4, 1.7, 2.6], l: [0.8, 1.5, 2.4], fov: 34 },
      { t: 128, p: [1.2, 1.6, 1.9], l: [-0.2, 1.45, 0.8], fov: 28 }
    ]
  },
  {
    id: 's5', set: 'workshop', start: 128, end: 176, label: '机加工位 / Workshop',
    keys: [
      { t: 128, p: [0.5, 3.6, -4.6], l: [0, 1.3, 0], fov: 46 },
      { t: 140, p: [-3.0, 2.1, -1.8], l: [-2.2, 1.7, -0.2], fov: 36 },
      { t: 152, p: [0.0, 1.7, -1.9], l: [0.4, 1.32, 0.1], fov: 26 },
      { t: 164, p: [1.9, 2.0, -1.4], l: [2.0, 1.3, -0.3], fov: 32 },
      { t: 176, p: [-0.8, 2.3, -3.0], l: [-0.2, 1.5, 1.6], fov: 34 }
    ]
  },
  {
    id: 's6', set: 'bay', start: 176, end: 214, label: '离站平台 / Departure',
    keys: [
      { t: 176, p: [9, 5.4, 9.5], l: [-2, 1.5, 1], fov: 50 },
      { t: 188, p: [3.0, 2.4, 7.4], l: [-1.4, 1.4, 3.0], fov: 40 },
      { t: 200, p: [7.8, 2.5, 8.4], l: [4.5, 1.5, 5.2], fov: 32 },
      { t: 214, p: [10.5, 3.4, 6.4], l: [1, 2.6, 0.5], fov: 44 }
    ]
  },
  {
    id: 's7', set: 'pod', start: 214, end: 252, label: '外部作业位 / EVA',
    keys: [
      { t: 214, p: [-3.6, 1.3, 6.8], l: [0, 1.3, 1.2], fov: 44 },
      { t: 226, p: [1.8, 2.0, 4.4], l: [0.6, 1.5, -2], fov: 38 },
      { t: 238, p: [1.2, 2.3, 2.9], l: [6, 4.6, -40], fov: 34 },
      { t: 252, p: [0.8, 1.7, 2.2], l: [8, 5.4, -62], fov: 22 }
    ]
  },
  {
    id: 's8', set: 'theshot', start: 252, end: 286, label: '真空 / Vacuum',
    keys: [
      { t: 252, p: [-11, 3.2, 13], l: [-5, 1.6, 1], fov: 48 },
      { t: 262, p: [-2.5, 2.2, 9], l: [2, 1.0, -14], fov: 40 },
      { t: 270, p: [3.4, 1.5, -6], l: [0, 0, -30], fov: 34 },
      { t: 278, p: [2.0, 1.0, -18], l: [0, 0, -30], fov: 28 },
      { t: 286, p: [6.5, 3.0, -15], l: [0, 0, -30], fov: 40 }
    ]
  },
  {
    id: 's9', set: 'aftermath', start: 286, end: 312, label: '事后 / Aftermath',
    keys: [
      { t: 286, p: [0, 3.2, 8.4], l: [0, 1.2, -2], fov: 46 },
      { t: 296, p: [-2.0, 1.9, 5.4], l: [-2.4, 1.4, 2.8], fov: 34 },
      { t: 304, p: [3.4, 1.8, 5.8], l: [1.6, 1.4, 2.4], fov: 32 },
      { t: 312, p: [1.8, 1.7, 4.2], l: [1.6, 1.45, 2.4], fov: 26 }
    ]
  },
  {
    id: 's10', set: 'credits', start: 312, end: FILM_DURATION, label: '片尾 / Credits',
    keys: [
      { t: 312, p: [0, 0, 30], l: [0, 0, 0], fov: 48 },
      { t: 330, p: [0, 5, 46], l: [0, 0, 0], fov: 44 }
    ]
  }
];

export const DURATION = FILM_DURATION;

export function shotAt(t: number): Shot {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}
