'use strict';
/**
 * 冒烟测试：不靠耳朵，靠断言。
 * 检查 WAV 头、采样率、声道数、时长、峰值，以及"同样输入产出同样字节"的确定性。
 */
const assert = require('assert');
const sfx = require('../src');

let pass = 0;
const fail = [];

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓ ' + name);
  } catch (e) {
    fail.push(name + ' — ' + e.message);
    console.log('  ✗ ' + name + ' — ' + e.message);
  }
}

console.log('\nhebao-sfx 冒烟测试\n');

check('12 条预设齐全', () => {
  assert.strictEqual(sfx.IDS.length, 12, '预设数量应为 12');
});

check('list() 元数据完整', () => {
  for (const r of sfx.list()) {
    assert.ok(r.id && r.name && r.role, r.id + ' 缺元数据');
    assert.ok(r.duration > 0.03 && r.duration < 2.2, r.id + ' 时长异常: ' + r.duration);
  }
});

for (const id of sfx.IDS) {
  check(id + ' WAV 结构正确', () => {
    const buf = sfx.wav(id);
    assert.strictEqual(buf.toString('ascii', 0, 4), 'RIFF');
    assert.strictEqual(buf.toString('ascii', 8, 12), 'WAVE');
    assert.strictEqual(buf.readUInt16LE(20), 1, '应为 PCM');
    assert.strictEqual(buf.readUInt16LE(22), 2, '应为立体声');
    assert.strictEqual(buf.readUInt32LE(24), 44100, '采样率应为 44100');
    assert.strictEqual(buf.readUInt16LE(34), 16, '位深应为 16');
    assert.strictEqual(buf.readUInt32LE(40), buf.length - 44, 'data 长度与文件不符');

    // 峰值应落在 -24 ~ -6 dBFS，且不是静音
    const peak = sfx.measurePeak(sfx.render(id).buf);
    assert.ok(peak > -26 && peak < -5, id + ' 峰值异常: ' + peak.toFixed(1) + 'dBFS');

    // 尾部 10ms 应接近静音（说明包络收干净了，不会"咔"一声）
    const r = sfx.render(id);
    const tailStart = Math.floor(r.L.length * 0.995);
    let tailPeak = 0;
    for (let i = tailStart; i < r.L.length; i++) {
      tailPeak = Math.max(tailPeak, Math.abs(r.L[i]), Math.abs(r.R[i]));
    }
    assert.ok(tailPeak < 0.2, id + ' 尾部未收敛: ' + tailPeak.toFixed(3));
  });
}

check('确定性：两次渲染字节一致', () => {
  const a = sfx.wav('applause');
  const b = sfx.wav('applause');
  assert.ok(a.equals(b), '含随机脉冲的 applause 也应可复现');
});

check('相对电平表：stamp 比 tick 响至少 6dB', () => {
  const s = sfx.measurePeak(sfx.render('stamp').buf);
  const t = sfx.measurePeak(sfx.render('tick').buf);
  assert.ok(s - t >= 6, '实际差值 ' + (s - t).toFixed(1) + 'dB');
});

check('未知 id 应报错', () => {
  assert.throws(() => sfx.render('nope'), /未知音效/);
});

console.log('\n  通过 ' + pass + '，失败 ' + fail.length + '\n');
if (fail.length) {
  fail.forEach((f) => console.error('  ! ' + f));
  process.exit(1);
}
