export type VoiceCue = {
  id: string
  kind: 'dialogue' | 'mono' | 'radio' | 'title'
  speaker: string
  text: string
  delivery: string
  start: number
  end: number
}

export const TOTAL_DURATION = 115

export const subtitles: VoiceCue[] = [
  {
    id: 's1',
    kind: 'mono',
    speaker: '章北海',
    text: '陨石，是宇宙中最古老的金属。',
    delivery: '低沉独白',
    start: 2,
    end: 8
  },
  {
    id: 's2',
    kind: 'dialogue',
    speaker: '章北海（回忆父亲）',
    text: '要多想。……我只能告诉你，在那之前，要多想。',
    delivery: '父亲回响',
    start: 9,
    end: 15
  },
  {
    id: 's3',
    kind: 'mono',
    speaker: '章北海',
    text: '如果他们成功了，人类将永远被困在近地轨道。',
    delivery: '冷硬',
    start: 17,
    end: 24
  },
  {
    id: 's4',
    kind: 'dialogue',
    speaker: '老航天A',
    text: '化学推进是成熟稳妥的路线，辐射驱动那是赌全人类的命。',
    delivery: '固执',
    start: 27,
    end: 34
  },
  {
    id: 's5',
    kind: 'dialogue',
    speaker: '老航天B',
    text: '下一代的事，让下一代去做。我们这代人，要先活下来。',
    delivery: '保守',
    start: 34.5,
    end: 40
  },
  {
    id: 's6',
    kind: 'mono',
    speaker: '章北海（内心）',
    text: '……没关系的，都一样。',
    delivery: '冰冷',
    start: 46,
    end: 53
  },
  {
    id: 's7',
    kind: 'mono',
    speaker: '章北海（内心）',
    text: '为了人类文明的存续——我将替你们做出选择。',
    delivery: '决绝',
    start: 55,
    end: 62
  },
  {
    id: 's8',
    kind: 'radio',
    speaker: '无线电',
    text: '……观察甲板……请勿倚靠舷窗……',
    delivery: '失真背景',
    start: 64,
    end: 69
  },
  {
    id: 's9',
    kind: 'mono',
    speaker: '章北海',
    text: '（真空中，没有枪响。）',
    delivery: '寂静',
    start: 72,
    end: 77
  },
  {
    id: 's10',
    kind: 'radio',
    speaker: '无线电',
    text: '紧急警报！观察甲板发生事故！重复，观察甲板——',
    delivery: '尖锐警报',
    start: 86,
    end: 93
  },
  {
    id: 's11',
    kind: 'mono',
    speaker: '章北海',
    text: '自然选择号……前进四。',
    delivery: '极轻',
    start: 103,
    end: 110
  }
]
