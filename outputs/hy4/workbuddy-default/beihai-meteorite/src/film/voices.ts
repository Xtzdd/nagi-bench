// Voice cue manifest.
//
// Every intended voice line in the film lives here and nowhere else. The
// subtitle overlay is driven directly from this list, so a dubbing pass later
// can attach real audio cue-by-cue using `id` without touching the picture.
//
// No human voice is synthesized anywhere in this project: each cue is rendered
// on screen as a bottom-centered 【speaker】 line, synchronized to `start`/`end`.

export type VoiceKind =
  | 'dialogue'
  | 'narration'
  | 'monologue'
  | 'broadcast'
  | 'comms'
  | 'chatter';

export interface VoiceCue {
  id: string;
  kind: VoiceKind;
  speaker: string;
  text: string;
  delivery: string;
  start: number;
  end: number;
}

export const VOICE_CUES: VoiceCue[] = [
  // ---------- 0. titles ----------
  { id: 'v001', kind: 'narration', speaker: '旁白', text: '危机纪元第 205 年。人类第一次拥有了一支舰队，也第一次需要决定它该往哪里去。', delivery: '低沉、克制，缓缓铺开', start: 3.0, end: 11.0 },
  { id: 'v002', kind: 'narration', speaker: '旁白', text: '在所有的路线之争里，最安静的那个人，往往已经做出了选择。', delivery: '压低，留出停顿', start: 11.6, end: 17.4 },

  // ---------- 1. station exterior ----------
  { id: 'v003', kind: 'broadcast', speaker: '空间站广播', text: '生态舱压力正常，各舱段巡检完毕。', delivery: '机械女声，轻微电流底噪', start: 21.0, end: 25.6 },
  { id: 'v004', kind: 'monologue', speaker: '章北海', text: '从这里看下去，地球还是蓝的。可蓝的东西，并不一定安全。', delivery: '内心独白，平稳，几乎不带情绪', start: 28.0, end: 36.0 },
  { id: 'v005', kind: 'monologue', speaker: '章北海', text: '他们要造更大的化学火箭。把燃料烧完，然后在半路上停下来。', delivery: '陈述，略带评判', start: 38.0, end: 45.5 },
  { id: 'v006', kind: 'monologue', speaker: '章北海', text: '辐射驱动才是唯一能带我们走出去的东西。这一点，我不能说服他们。', delivery: '缓慢，下定论', start: 46.5, end: 55.5 },

  // ---------- 2. meeting chamber ----------
  { id: 'v007', kind: 'dialogue', speaker: '老航天 甲', text: '工质推进是成熟方案。四十年，我们靠它把人送上了月球。', delivery: '笃定，带资历的重量', start: 58.0, end: 65.0 },
  { id: 'v008', kind: 'dialogue', speaker: '老航天 乙', text: '辐射驱动？那只是纸面上的比冲。工程上根本没有谱。', delivery: '不以为然，略快', start: 66.0, end: 72.5 },
  { id: 'v009', kind: 'dialogue', speaker: '老航天 丙', text: '小章，你在会上很少说话。今天也不反对我们吗？', delivery: '和气，试探', start: 73.5, end: 79.5 },
  { id: 'v010', kind: 'dialogue', speaker: '章北海', text: '我同意诸位的意见。', delivery: '平静，几乎听不出波澜', start: 80.5, end: 84.0 },
  { id: 'v011', kind: 'chatter', speaker: '会场', text: '（低声议论）那就按工质路线报上去。', delivery: '环境人声，压低成背景', start: 85.0, end: 91.0 },

  // ---------- 3. quarters ----------
  { id: 'v012', kind: 'monologue', speaker: '章北海', text: '争论是有用的。但争论需要时间，而时间不在我们这边。', delivery: '内心独白，节奏收紧', start: 95.0, end: 102.5 },
  { id: 'v013', kind: 'monologue', speaker: '章北海', text: '他们不是坏人。他们只是把一生的经验，押在了一条走不通的路上。', delivery: '略缓，带一丝悯意', start: 104.0, end: 112.0 },
  { id: 'v014', kind: 'monologue', speaker: '章北海', text: '我不需要说服三个人。我只需要让这条路空出来。', delivery: '冷静，收束', start: 113.5, end: 121.0 },
  { id: 'v015', kind: 'narration', speaker: '旁白', text: '那天夜里，他没有再打开任何一份论证材料。', delivery: '低声，像翻过一页', start: 122.0, end: 128.0 },

  // ---------- 4. workshop ----------
  { id: 'v016', kind: 'monologue', speaker: '章北海', text: '这块石头来自小行星带，密度足够，形状也够不规则。', delivery: '技术性的，专注', start: 132.0, end: 139.5 },
  { id: 'v017', kind: 'monologue', speaker: '章北海', text: '在真空里，它不需要声音，也不需要火药的尾巴。它只需要速度。', delivery: '平稳，近乎自语', start: 141.0, end: 149.0 },
  { id: 'v018', kind: 'comms', speaker: '车间通讯', text: '三号工位申请延时两小时，做一次标定。', delivery: '简短，带混响', start: 151.0, end: 155.5 },
  { id: 'v019', kind: 'monologue', speaker: '章北海', text: '两小时。足够把误差降到他们看不出来的程度。', delivery: '低声，带一点自嘲', start: 157.0, end: 164.0 },
  { id: 'v020', kind: 'narration', speaker: '旁白', text: '他没有留下图纸，也没有留下记录。只有一件做完了就应当消失的东西。', delivery: '克制，不评判', start: 166.0, end: 175.0 },

  // ---------- 5. departure ----------
  { id: 'v021', kind: 'broadcast', speaker: '调度广播', text: '穿梭机 K-7 准备离站，前往同步轨道试验段。', delivery: '机械，程序化', start: 179.0, end: 185.0 },
  { id: 'v022', kind: 'dialogue', speaker: '老航天 甲', text: '这一趟回来，就把方案定死。', delivery: '轻松，胜券在握', start: 186.0, end: 191.0 },
  { id: 'v023', kind: 'dialogue', speaker: '老航天 乙', text: '定死？科学的事，哪有定死。', delivery: '笑', start: 191.8, end: 196.0 },
  { id: 'v024', kind: 'broadcast', speaker: '调度广播', text: 'K-7，离站许可已发放，祝顺利。', delivery: '机械', start: 198.0, end: 202.5 },
  { id: 'v025', kind: 'monologue', speaker: '章北海', text: '祝顺利。', delivery: '极轻，几乎只是重复', start: 204.0, end: 207.0 },

  // ---------- 6. the aim ----------
  { id: 'v026', kind: 'comms', speaker: '舱内通讯', text: '外部作业位已解锁。请注意系留。', delivery: '带轻微延迟', start: 216.0, end: 221.5 },
  { id: 'v027', kind: 'monologue', speaker: '章北海', text: '真空不传声。所以这一下，谁也听不见。', delivery: '平稳，呼吸可闻', start: 223.0, end: 231.0 },
  { id: 'v028', kind: 'monologue', speaker: '章北海', text: '他们会把它写成一次微流星撞击。概率不高，但不是零。', delivery: '冷静到近乎残忍', start: 232.5, end: 241.0 },
  { id: 'v029', kind: 'monologue', speaker: '章北海', text: '给我三秒。', delivery: '短促，屏息', start: 243.0, end: 246.0 },

  // ---------- 7. the shot ----------
  { id: 'v030', kind: 'narration', speaker: '旁白', text: '没有火光，没有声音。只有一块石头，穿过三百公里的安静。', delivery: '极慢，留白', start: 254.0, end: 263.0 },
  { id: 'v031', kind: 'comms', speaker: 'K-7 通讯', text: '——舱压——', delivery: '被打断，只留半句', start: 268.0, end: 270.0 },
  { id: 'v032', kind: 'broadcast', speaker: '空间站警报', text: '检测到轨道碎片撞击事件，启动应急预案。', delivery: '尖锐，重复', start: 272.0, end: 279.0 },

  // ---------- 8. aftermath ----------
  { id: 'v033', kind: 'dialogue', speaker: '调查组', text: '结论：微流星体撞击，概率事件。无人为因素。', delivery: '公事公办', start: 288.0, end: 295.5 },
  { id: 'v034', kind: 'chatter', speaker: '舱内', text: '（低声）太可惜了……三位老先生一起走。', delivery: '环境人声，压低', start: 296.5, end: 302.0 },
  { id: 'v035', kind: 'monologue', speaker: '章北海', text: '现在，工质推进没有它的拥护者了。路线会自己改过来。', delivery: '低沉，毫无得意', start: 303.5, end: 311.5 },

  // ---------- 9. credits ----------
  { id: 'v036', kind: 'narration', speaker: '旁白', text: '他回到舱室，把那件东西拆了，一块一块扔进熔炉。然后躺下，睡了很久。', delivery: '平缓，收束', start: 314.0, end: 324.0 },
  { id: 'v037', kind: 'monologue', speaker: '章北海', text: '前进。', delivery: '极轻，几乎没有重量', start: 325.5, end: 329.0 }
];

export const FILM_DURATION = 330;
