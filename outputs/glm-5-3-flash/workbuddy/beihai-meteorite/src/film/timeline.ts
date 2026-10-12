// 影片时间轴: 全部分镜 + 集中保存的待配音清单(voiceCues)
// 总时长 216 秒, 硬上限 360 秒之内
export const FILM_DURATION = 216

export type CueKind = 'dialogue' | 'narration' | 'inner' | 'broadcast' | 'radio' | 'ambient-chat'

export interface VoiceCue {
  id: string
  kind: CueKind
  speaker: string
  text: string
  delivery: string
  start: number
  end: number
}

export interface Shot {
  id: string
  scene: 'study' | 'airlock' | 'eva' | 'ending'
  start: number
  end: number
  from: [number, number, number]
  to: [number, number, number]
  look: [number, number, number]
  lookTo?: [number, number, number]
  title?: string
}

// ---------- 分镜 ----------
export const SHOTS: Shot[] = [
  // 序幕
  { id: 'S01', scene: 'ending', start: 0, end: 8, from: [0, 4, 60], to: [0, 4, 40], look: [0, 2, 0], title: '危机纪元 · 二百零五年' },
  // 场景一: 书房, 父子对话
  { id: 'S02', scene: 'study', start: 8, end: 20, from: [4.5, 2.2, 5.5], to: [3.8, 2.1, 5.0], look: [0, 1.4, 0], title: '北京 · 书房' },
  { id: 'S03', scene: 'study', start: 20, end: 30, from: [-4, 2.4, 4.6], to: [-3.2, 2.2, 4.2], look: [1.2, 1.4, -0.5] },
  { id: 'S04', scene: 'study', start: 30, end: 40, from: [1.2, 1.7, 2.4], to: [0.8, 1.7, 2.2], look: [-1.2, 1.4, -0.4] },
  { id: 'S05', scene: 'study', start: 40, end: 52, from: [0, 2.8, 6.4], to: [0, 2.4, 5.6], look: [0, 1.2, 0] },
  { id: 'S06', scene: 'study', start: 52, end: 62, from: [-2.6, 1.5, 3.2], to: [-2.2, 1.6, 3.0], look: [-1.2, 1.5, -0.4] },
  // 场景二: 太空站气闸
  { id: 'S07', scene: 'airlock', start: 62, end: 72, from: [0, 2.6, 7], to: [0, 2.4, 6], look: [0, 1.5, 0], title: '低轨道太空站 · 三号气闸舱' },
  { id: 'S08', scene: 'airlock', start: 72, end: 86, from: [3.4, 2.0, 4.4], to: [2.8, 1.9, 4.0], look: [0, 1.4, 0] },
  { id: 'S09', scene: 'airlock', start: 86, end: 98, from: [-3.2, 1.8, 3.6], to: [-2.6, 1.8, 3.4], look: [1.4, 1.3, -1] },
  // 场景三: 舱外(真空)
  { id: 'S10', scene: 'eva', start: 98, end: 112, from: [6, 5, 14], to: [5, 4.4, 12], look: [0, 1.6, 0], title: '舱外作业 · 真空' },
  { id: 'S11', scene: 'eva', start: 112, end: 126, from: [-5, 2.4, 8], to: [-4.2, 2.2, 7], look: [0.8, 1.5, 0] },
  { id: 'S12', scene: 'eva', start: 126, end: 138, from: [1.6, 1.9, 3.4], to: [1.2, 1.8, 3.0], look: [-1.4, 1.5, 0] },
  { id: 'S13', scene: 'eva', start: 138, end: 152, from: [-6, 3, 10], to: [-5, 2.8, 9], look: [0, 1.4, -2] },
  { id: 'S14', scene: 'eva', start: 152, end: 166, from: [4, 3.4, 9], to: [3.4, 3.0, 8], look: [-0.6, 1.4, -1.4] },
  // 尾声
  { id: 'S15', scene: 'ending', start: 166, end: 184, from: [0, 2.2, 8], to: [0, 2.6, 6], look: [0, 1.5, 0], title: '' },
  { id: 'S16', scene: 'ending', start: 184, end: 200, from: [0, 3, 30], to: [0, 6, 44], look: [0, 1.5, 0] },
  { id: 'S17', scene: 'ending', start: 200, end: 216, from: [0, 2, 12], to: [0, 2, 10], look: [0, 2, 0] },
]

// ---------- 集中式待配音清单 ----------
export const VOICE_CUES: VoiceCue[] = [
  { id: 'C01', kind: 'dialogue', speaker: '父亲', text: '北海，你真的想清楚了？', delivery: '低沉缓慢，带倦意', start: 10, end: 14 },
  { id: 'C02', kind: 'dialogue', speaker: '章北海', text: '想了三十多年，父亲。', delivery: '平静而坚定', start: 15.5, end: 19 },
  { id: 'C03', kind: 'inner', speaker: '章北海（内心）', text: '航天事业的路线之争，从来不是技术问题。工质引擎会拖死人类舰队的未来……总得有人扫清障碍。', delivery: '内心独白，冷静克制', start: 22, end: 31 },
  { id: 'C04', kind: 'dialogue', speaker: '父亲', text: '要多想。', delivery: '极轻，几乎耳语', start: 33, end: 35.5 },
  { id: 'C05', kind: 'dialogue', speaker: '章北海', text: '我会的。', delivery: '沉稳', start: 37, end: 39 },
  { id: 'C06', kind: 'ambient-chat', speaker: '值班员', text: '轨道舱夜间巡检完成，各系统正常。', delivery: '例行公事的平直语调', start: 42, end: 46 },
  { id: 'C07', kind: 'inner', speaker: '章北海（内心）', text: '父亲，我多想了。想了三十年，也想明白了。', delivery: '内心独白，一字一顿', start: 54, end: 60 },
  { id: 'C08', kind: 'broadcast', speaker: '站内广播', text: '外围走廊陨石撞击风险评估小组，请从三号气闸舱出舱作业。重复，三号气闸舱。', delivery: '广播腔，匀速', start: 64, end: 71 },
  { id: 'C09', kind: 'dialogue', speaker: '刘工', text: '北海，一会儿你负责采样记录，我检查撞击点。', delivery: '轻松，同事闲聊', start: 75, end: 80 },
  { id: 'C10', kind: 'dialogue', speaker: '章北海', text: '好。', delivery: '简短', start: 81, end: 82.5 },
  { id: 'C11', kind: 'ambient-chat', speaker: '赵总工', text: '这批陨石样本太关键了，发展工质还是辐射推进，就看这次评估。', delivery: '感慨，语气略重', start: 88, end: 95 },
  { id: 'C12', kind: 'dialogue', speaker: '刘工', text: '这几块陨石的成分很奇怪……北海，把光谱仪递我一下。', delivery: '专注，随口', start: 100, end: 106 },
  { id: 'C13', kind: 'radio', speaker: '赵总工（无线电）', text: '气闸舱，B 组作业一切正常吗？……北海？章北海？！', delivery: '由平静转为惊恐', start: 142, end: 150 },
  { id: 'C14', kind: 'inner', speaker: '章北海（内心）', text: '从今天起，航天会飞向正确的方向。', delivery: '内心独白，如释重负又空洞', start: 170, end: 176 },
]

// 非语言声音 cue 的时间点(供导演与音效引擎同步)
export const SFX_CUES = [
  { id: 'X01', sfx: 'mechanic', start: 9, end: 11 },          // 书房挂钟/纸张
  { id: 'X02', sfx: 'doorClose', start: 60, end: 62 },        // 书房灯灭
  { id: 'X03', sfx: 'stationHum', start: 62, end: 98 },       // 站内低鸣
  { id: 'X04', sfx: 'airlock', start: 96, end: 98 },          // 泄压
  { id: 'X05', sfx: 'gunHandling', start: 122, end: 126 },    // 拔枪上膛(真空无声, 仅闷震)
  { id: 'X06', sfx: 'vacuumShot', start: 129, end: 132 },     // 真空射击: 无声, 仅内部传导闷震
  { id: 'X07', sfx: 'vacuumShot', start: 134, end: 137 },
  { id: 'X08', sfx: 'radioStatic', start: 138, end: 142 },    // 通讯噪声
  { id: 'X09', sfx: 'alarm', start: 152, end: 158 },          // 舱内警报(远)
  { id: 'X10', sfx: 'thruster', start: 160, end: 166 },       // 推进器远去
  { id: 'X11', sfx: 'spacePad', start: 184, end: 200 },       // 尾声星空铺底
]
