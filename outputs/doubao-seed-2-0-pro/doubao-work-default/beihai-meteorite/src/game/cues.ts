import type { VoiceCue } from './types';

export const DURATION = 180;

export const CUES: VoiceCue[] = [
  {
    id:1, start:0, end:20, scene:'北海星夜',
    voice:'旁白，沉静男声',
    subtitle:'北部湾的夜，海面像一块缓慢呼吸的深蓝色矿石。',
    shot:'远景：星空、方块海浪与地平线', sound:'低频海风与轻浪'
  },
  {
    id:2, start:20, end:42, scene:'天外轨迹',
    voice:'旁白',
    subtitle:'凌晨两点十七分，一道白色轨迹越过狮子座，向海面坠落。',
    shot:'跟拍：高空陨石与大气层边缘', sound:'由远及近的呼啸'
  },
  {
    id:3, start:42, end:62, scene:'燃烧体',
    voice:'旁白',
    subtitle:'它的外壳在大气中碎裂，熔融的裂纹像被点燃的树枝。',
    shot:'近景：旋转陨石、火焰方块和碎屑', sound:'火焰轰鸣'
  },
  {
    id:4, start:62, end:82, scene:'远海撞击',
    voice:'旁白',
    subtitle:'撞击发生在离岸四十二公里处，白光之后，巨浪向四周展开。',
    shot:'俯拍：冲击波、环形浪和短暂强光', sound:'爆炸与海浪'
  },
  {
    id:5, start:82, end:106, scene:'科考船启航',
    voice:'船长，中年女声',
    subtitle:'左舵十五，航速十二节。我们要在黎明前抵达落点。',
    shot:'中景：方块科考船破浪前行', sound:'船笛声、引擎与浪击'
  },
  {
    id:6, start:106, end:132, scene:'载人潜水器',
    voice:'潜航员，青年男声',
    subtitle:'潜水器开始下潜，深度八百，一千二，一千六。',
    shot:'舱外视角：光柱逐渐消失', sound:'声呐脉冲与压载声'
  },
  {
    id:7, start:132, end:158, scene:'海底陨石',
    voice:'潜航员',
    subtitle:'发现目标。它嵌在沙层里，断面仍有细小的金属闪光。',
    shot:'近景：海底、岩块、陨石与探照灯', sound:'水下环境与短促声呐'
  },
  {
    id:8, start:158, end:180, scene:'样本与星空',
    voice:'旁白',
    subtitle:'一块来自星际的碎片，被装进标本箱，也把北海的夜空连向了更远的宇宙。',
    shot:'结尾：样本箱、海面黎明与星空叠化', sound:'温暖尾音与海浪淡出'
  }
];
