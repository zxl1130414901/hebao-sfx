'use strict';
/**
 * 12 类事件音效预设。
 *
 * 这里的顺序和参数不是随手调的 —— 它们对应一条 8 秒竖屏表彰视频里"声音该响的那几个瞬间"。
 * 每条都写明它对应画面上的什么动作；改参数时别把对应关系改掉，否则声音和画面会错位。
 *
 * gainDb 是相对电平：stamp 最响，tick 最轻。这组关系比单个音效好不好听更重要 ——
 * 12 条各自都调好听，混在一起依然会乱，靠的就是这张相对电平表。
 */
const { SR, rngOf, makeBuf, tone, glide, noise, shape, trim, normalize } = require('./synth');

const BELL = [[1, 1], [2.71, 0.42], [5.15, 0.16]]; // 金属/钟：非整数倍频
const WOOD = [[1, 1], [2.4, 0.3], [4.1, 0.12]];
const BRIGHT = [[1, 1], [2, 0.5]];

const SFX = {
  riser: {
    name: '开场上扬',
    role: '画面元素从下方升起 / 巨字即将落定',
    gainDb: -16,
    build(b) {
      const d = 1.2;
      noise(b, 0, d, 0.16, 0, 0, { lpf: 0.22, rise: d * 0.92, seed: 11 });
      glide(b, 0, d, 180, 2400, 0.11, 0, 0.9, true);
      glide(b, 0, d * 0.98, 90, 1200, 0.07, -0.3, 1.2, true);
      // 末端硬收：否则拖尾会撞上 stamp，两次冲击粘成一坨
      shape(b, (u) => (u < 0.94 ? 1 : (1 - u) / 0.06));
      return d;
    },
  },

  stamp: {
    name: '印章砸落',
    role: '徽章/印章/名次牌砸定 —— 全片最核心的一下',
    gainDb: -12,
    build(b) {
      glide(b, 0, 0.42, 150, 62, 0.55, 0, 7.5, true);
      tone(b, 0, 210, 0.22, 0.26, 0, WOOD, 26);
      noise(b, 0, 0.035, 0.3, 0, 60, { lpf: 0.85, seed: 22 });
      noise(b, 0.004, 0.5, 0.06, 0.2, 12, { lpf: 0.35, seed: 23 }); // 房间尾
      glide(b, 0.02, 0.3, 820, 300, 0.05, -0.4, 14, true);
      return 0.62;
    },
  },

  tick: {
    name: '数字跳动',
    role: '业绩数字滚动时每一次跳字',
    gainDb: -22,
    build(b) {
      tone(b, 0, 2100, 0.055, 0.3, 0, [[1, 1], [2.7, 0.25]], 70);
      noise(b, 0, 0.008, 0.16, 0, 90, { lpf: 0.9, seed: 33 });
      return 0.07;
    },
  },

  coin: {
    name: '金币计数',
    role: '金额/件数累加的听觉符号',
    gainDb: -18,
    build(b) {
      tone(b, 0, 2480, 0.28, 0.26, -0.15, BRIGHT, 16);
      tone(b, 0.045, 3720, 0.34, 0.22, 0.15, [[1, 1], [1.5, 0.35]], 13);
      noise(b, 0.002, 0.012, 0.05, 0, 80, { lpf: 0.85, seed: 44 });
      return 0.42;
    },
  },

  applause: {
    name: '掌声',
    role: '荣誉揭晓、定版后的人群反应',
    gainDb: -19,
    build(b) {
      const rnd = rngOf(55);
      const d = 1.7;
      for (let k = 0; k < 240; k++) {
        const u = Math.pow(rnd(), 0.62);
        const t = 0.06 + u * d * 0.95;
        // 密度包络：起势 0.18 → 最密 → 线性衰减
        const dens = u < 0.18 ? u / 0.18 : 1 - (u - 0.18) * 0.72;
        if (rnd() > dens * 1.05) continue;
        const g = 0.06 + rnd() * 0.11;
        noise(b, t, 0.02 + rnd() * 0.035, g, rnd() * 1.6 - 0.8, 55, { lpf: 0.72, seed: 100 + k });
      }
      noise(b, 0, d, 0.05, 0, 0.55, { lpf: 0.5, seed: 56 }); // 人群底噪
      return d;
    },
  },

  firework: {
    name: '礼花彩带',
    role: '定版高潮、彩带炮炸开',
    gainDb: -14,
    build(b) {
      glide(b, 0, 0.34, 260, 1600, 0.09, 0, 1.2, true); // 升空
      noise(b, 0.3, 0.46, 0.34, 0, 11, { lpf: 0.62, seed: 66 }); // 爆裂
      glide(b, 0.3, 0.5, 130, 48, 0.3, 0, 6, true);
      const rnd = rngOf(67);
      for (let k = 0; k < 42; k++) {
        const t = 0.33 + Math.pow(rnd(), 1.7) * 0.9;
        noise(b, t, 0.012, 0.03 + rnd() * 0.05, rnd() * 1.8 - 0.9, 90, { lpf: 0.9, seed: 200 + k });
      }
      return 1.35;
    },
  },

  whoosh: {
    name: '转场呼啸',
    role: '幕与幕之间的"换口气"',
    gainDb: -18,
    build(b) {
      noise(b, 0, 0.4, 0.15, 0, 0, { lpf: 0.3, rise: 0.16, seed: 77 });
      glide(b, 0, 0.38, 2600, 320, 0.09, 0.25, 1.6, true);
      // 下扫才是"离开"，上扫属于"登场"，别混用
      shape(b, (u) => Math.sin(Math.PI * Math.min(1, u * 1.05)) * (u > 0.92 ? (1 - u) / 0.08 : 1));
      return 0.42;
    },
  },

  logosting: {
    name: '标识音',
    role: '片尾 0.9s，品牌落款',
    gainDb: -14,
    build(b) {
      const P = { A4: 440.0, D5: 587.33, Fs5: 739.99, D6: 1174.66 };
      tone(b, 0, P.A4, 0.5, 0.16, -0.25, BELL, 9);
      tone(b, 0.09, P.D5, 0.6, 0.17, 0, BELL, 8);
      tone(b, 0.18, P.Fs5, 0.9, 0.16, 0.25, BELL, 6.5);
      tone(b, 0.18, P.D6, 1.1, 0.13, 0, BELL, 4.2);
      glide(b, 0.18, 0.5, 110, 55, 0.16, 0, 7, true);
      noise(b, 0.18, 0.35, 0.05, 0, 16, { lpf: 0.55, seed: 88 }); // 闪光
      return 1.3;
    },
  },

  brass: {
    name: '颁奖铜管',
    role: '职级晋升、荣誉揭晓',
    gainDb: -15,
    build(b) {
      const ROOT = 146.83; // D3
      const chord = [1, 1.26, 1.5, 2];
      const parts = [];
      for (let h = 1; h <= 9; h++) parts.push([h, 1 / (h * h * 0.55 + 1)]); // 锯齿近似
      for (let c = 0; c < chord.length; c++) {
        tone(b, 0.02 * c, ROOT * chord[c], 0.75, 0.075, (c - 1.5) * 0.35, parts, 3.4, 0.03);
      }
      noise(b, 0, 0.04, 0.1, 0, 55, { lpf: 0.6, seed: 99 });
      glide(b, 0, 0.4, 120, 58, 0.14, 0, 6, true);
      return 0.95;
    },
  },

  pageflip: {
    name: '翻页',
    role: '榜单/条目切换，两下比一下自然',
    gainDb: -21,
    build(b) {
      noise(b, 0, 0.055, 0.13, -0.3, 40, { lpf: 0.8, seed: 101 });
      noise(b, 0.075, 0.05, 0.1, 0.3, 45, { lpf: 0.75, seed: 102 });
      glide(b, 0, 0.06, 1800, 900, 0.03, 0, 40, true);
      return 0.24;
    },
  },

  boom: {
    name: '低频冲击',
    role: '标题落定、幕切；只给 40–90Hz',
    gainDb: -13,
    build(b) {
      glide(b, 0, 0.9, 92, 42, 0.6, 0, 3.4, true);
      tone(b, 0, 60, 0.5, 0.24, 0, [[1, 1], [1.5, 0.2]], 6);
      noise(b, 0, 0.12, 0.12, 0, 26, { lpf: 0.16, seed: 111 });
      return 1.0;
    },
  },

  sparkle: {
    name: '闪光颗粒',
    role: '金色粒子飞散、数据点亮',
    gainDb: -20,
    build(b) {
      const rnd = rngOf(121);
      for (let k = 0; k < 26; k++) {
        const t = Math.pow(rnd(), 1.45) * 0.5;
        const f = 2600 + rnd() * 5200;
        tone(b, t, f, 0.16, 0.035 + rnd() * 0.045, rnd() * 1.6 - 0.8, [[1, 1], [2.1, 0.2]], 22 + rnd() * 14);
      }
      noise(b, 0, 0.28, 0.035, 0, 12, { lpf: 0.8, seed: 122 });
      return 0.72;
    },
  },
};

const IDS = Object.keys(SFX);

/**
 * 渲染单条音效。
 * @param {string} id
 * @param {{peakDb?: number}} [opts] peakDb 默认用预设里的 gainDb
 * @returns {{id:string, name:string, sampleRate:number, channels:number, duration:number, peakDb:number, L:Float64Array, R:Float64Array, buf:object}}
 */
function render(id, opts) {
  const preset = SFX[id];
  if (!preset) throw new Error(`未知音效 id: ${id}（可用: ${IDS.join(', ')}）`);
  opts = opts || {};
  // 先给一块 8 秒的画布，再按实际时长裁掉，避免预测长度的误差
  const canvas = makeBuf(8);
  const dur = preset.build(canvas);
  const buf = trim(canvas, dur);
  const peakDb = normalize(buf, opts.peakDb === undefined ? preset.gainDb : opts.peakDb);
  return {
    id,
    name: preset.name,
    role: preset.role,
    sampleRate: SR,
    channels: 2,
    duration: buf.n / SR,
    peakDb,
    L: buf.L,
    R: buf.R,
    buf,
  };
}

/** 时长缓存：list() 不该为了报个秒数就把 12 条全渲染一遍 */
const DUR = {};
function durationOf(id) {
  if (DUR[id] === undefined) {
    const dur = SFX[id].build(makeBuf(2));
    DUR[id] = Math.floor((dur + 0.03) * SR) / SR; // 与 trim() 的保留余量保持一致
  }
  return Math.round(DUR[id] * 1000) / 1000;
}

function list() {
  return IDS.map((id) => ({
    id,
    name: SFX[id].name,
    role: SFX[id].role,
    peakDb: SFX[id].gainDb,
    duration: durationOf(id),
  }));
}

module.exports = { SFX, IDS, render, list };
