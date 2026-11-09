'use strict';
/**
 * DSP 核心 —— 全部用苹果大小的运算堆出声音，不读任何采样文件。
 *
 * 设计原则：
 *  1. 只用正弦 + 噪声 + 包络三种原料。越少的原料，越容易保证 12 条音效听感统一。
 *  2. 每个函数都只做"叠加"，不做覆盖，所以音效可以由多个层次叠出来（撞击 + 体 + 尾音）。
 *  3. 所有随机都走 LCG 且固定种子 —— 同样的输入永远产出同样的字节，方便进 git 做 diff。
 */

const SR = 44100;

const dbToGain = (db) => Math.pow(10, db / 20);
const gainToDb = (g) => 20 * Math.log10(Math.max(g, 1e-12));

/** 线性同余随机数：固定种子 → 固定波形，不用 Math.random */
function rngOf(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeBuf(dur) {
  const n = Math.max(1, Math.floor(dur * SR));
  return { n, L: new Float64Array(n), R: new Float64Array(n) };
}

/** 等功率声像：pan ∈ [-1, 1] */
function panGains(pan, gain) {
  const a = ((pan + 1) * Math.PI) / 4;
  return [gain * Math.cos(a), gain * Math.sin(a)];
}

/**
 * 正弦分量叠加。
 * @param {number[][]} partials [[倍频, 振幅], ...]，决定音色（金属=非整数倍，木质=整数倍快速衰减）
 */
function tone(buf, t0, f, dur, gain, pan, partials, decay, attack) {
  attack = attack === undefined ? 0.004 : attack;
  const s = Math.floor(t0 * SR);
  const e = Math.min(buf.n, Math.floor((t0 + dur) * SR));
  const [gl, gr] = panGains(pan || 0, gain);
  for (let i = Math.max(0, s); i < e; i++) {
    const t = (i - s) / SR;
    let env = Math.exp(-decay * t);
    if (t < attack) env *= t / attack;
    let v = 0;
    for (let k = 0; k < partials.length; k++) {
      v += Math.sin(2 * Math.PI * f * partials[k][0] * t) * partials[k][1];
    }
    v *= env;
    buf.L[i] += v * gl;
    buf.R[i] += v * gr;
  }
}

/** 频率滑动的正弦：低频冲击、上扫 riser、下扫 whoosh 都用它 */
function glide(buf, t0, dur, f0, f1, gain, pan, decay, exponential) {
  const exp = exponential === undefined ? true : exponential;
  const s = Math.floor(t0 * SR);
  const e = Math.min(buf.n, Math.floor((t0 + dur) * SR));
  const [gl, gr] = panGains(pan || 0, gain);
  let ph = 0;
  for (let i = Math.max(0, s); i < e; i++) {
    const u = (i - s) / Math.max(1, e - s);
    const f = exp ? f0 * Math.pow(f1 / f0, u) : f0 + (f1 - f0) * u;
    ph += (2 * Math.PI * f) / SR;
    const v = Math.sin(ph) * Math.exp(-decay * u) * gain;
    buf.L[i] += v * gl;
    buf.R[i] += v * gr;
  }
}

/**
 * 滤波噪声。
 * @param {object} opts {lpf: 0~1 越低越闷, rise: 渐强时长, seed: 随机种子}
 */
function noise(buf, t0, dur, gain, pan, decay, opts) {
  opts = opts || {};
  const lpf = opts.lpf === undefined ? 0.5 : opts.lpf;
  const rise = opts.rise || 0;
  const rnd = rngOf(opts.seed || 12345);
  const s = Math.floor(t0 * SR);
  const e = Math.min(buf.n, Math.floor((t0 + dur) * SR));
  const [gl, gr] = panGains(pan || 0, gain);
  let last = 0;
  for (let i = Math.max(0, s); i < e; i++) {
    const t = (i - s) / SR;
    let env;
    if (rise > 0) {
      const u = Math.min(1, t / rise);
      env = u * u * Math.exp(-Math.max(0, t - rise) * decay);
    } else {
      env = Math.exp(-decay * t);
    }
    const w = rnd() * 2 - 1;
    last = last * lpf + w * (1 - lpf);
    const v = last * gain * env * 3.2;
    buf.L[i] += v * gl;
    buf.R[i] += v * gr;
  }
}

/** 采样级包络乘子，用于整体 shaping（例如 riser 末端硬收） */
function shape(buf, fn) {
  for (let i = 0; i < buf.n; i++) {
    const m = fn(i / buf.n);
    buf.L[i] *= m;
    buf.R[i] *= m;
  }
}

/** 把缓冲裁到实际时长，尾部留 margin 秒余量避免截断衰减 */
function trim(buf, dur, margin) {
  const keep = Math.min(buf.n, Math.floor((dur + (margin === undefined ? 0.03 : margin)) * SR));
  return { n: keep, L: buf.L.subarray(0, keep), R: buf.R.subarray(0, keep) };
}

/** 峰值归一 + tanh 软限幅。峰值精确落在 targetDb（再线性微调一次，去掉软限幅造成的偏差） */
function normalize(buf, targetDb) {
  const target = dbToGain(targetDb);
  let peak = 0;
  for (let i = 0; i < buf.n; i++) {
    peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  }
  const ratio = peak > 1e-9 ? target / peak : 1;
  for (let i = 0; i < buf.n; i++) {
    buf.L[i] = Math.tanh(buf.L[i] * ratio * 1.02);
    buf.R[i] = Math.tanh(buf.R[i] * ratio * 1.02);
  }
  // tanh 会把峰值拉低一点，再乘一次线性系数对齐到目标
  let p2 = 0;
  for (let i = 0; i < buf.n; i++) p2 = Math.max(p2, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  if (p2 > 1e-9) {
    const k = target / p2;
    for (let i = 0; i < buf.n; i++) {
      buf.L[i] *= k;
      buf.R[i] *= k;
    }
  }
  return targetDb;
}

function measurePeak(buf) {
  let peak = 0;
  for (let i = 0; i < buf.n; i++) peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  return gainToDb(peak);
}

/** 16bit / 44.1kHz / 立体声 PCM WAV */
function encodeWav(buf) {
  const head = Buffer.alloc(44);
  const dataLen = buf.n * 4;
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + dataLen, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(2, 22); // 立体声
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 4, 28);
  head.writeUInt16LE(4, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(dataLen, 40);

  const pcm = Buffer.alloc(dataLen);
  for (let i = 0; i < buf.n; i++) {
    const l = Math.max(-1, Math.min(1, buf.L[i]));
    const r = Math.max(-1, Math.min(1, buf.R[i]));
    pcm.writeInt16LE(Math.round(l * 32767), i * 4);
    pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
  }
  return Buffer.concat([head, pcm]);
}

module.exports = {
  SR,
  dbToGain,
  gainToDb,
  rngOf,
  makeBuf,
  tone,
  glide,
  noise,
  shape,
  trim,
  normalize,
  measurePeak,
  encodeWav,
};
