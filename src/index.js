'use strict';
/**
 * hebao-sfx —— 12 类表彰视频事件音效，纯代码合成，零依赖、零采样。
 *
 *   const sfx = require('hebao-sfx');
 *   sfx.list();                      // 看有哪些音效
 *   const buf = sfx.wav('stamp');    // 直接拿 WAV Buffer
 *   sfx.writeFile('out/stamp.wav', 'stamp');
 *
 * 为什么不用采样包：采样有授权风险、有 Content ID 误伤、还有 12 条音色不统一的问题。
 * 合成出来的 12 条天然共享同一套谐波与包络语言，混在一起才像"一个团队做的"。
 */

const fs = require('fs');
const path = require('path');
const { IDS, SFX, render, list } = require('./presets');
const { SR, encodeWav, measurePeak } = require('./synth');

/** 渲染成 WAV Buffer */
function wav(id, opts) {
  return encodeWav(render(id, opts).buf);
}

/** 写入单个 WAV 文件，返回写入结果 */
function writeFile(file, id, opts) {
  const r = render(id, opts);
  const buf = encodeWav(r.buf);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, buf);
  return { id, file, duration: r.duration, peakDb: measurePeak(r.buf), bytes: buf.length };
}

/**
 * 批量写出。
 * @param {string} outDir
 * @param {string[]} [ids] 省略则全部
 * @param {{peakDb?:number}} [opts]
 */
function writeAll(outDir, ids, opts) {
  const targets = ids && ids.length ? ids : IDS;
  fs.mkdirSync(outDir, { recursive: true });
  return targets.map((id) => writeFile(path.join(outDir, id + '.wav'), id, opts));
}

module.exports = {
  SR,
  IDS,
  SFX,
  list,
  render,
  wav,
  writeFile,
  writeAll,
  encodeWav,
  measurePeak,
};
