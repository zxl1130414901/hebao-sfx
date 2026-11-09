#!/usr/bin/env node
'use strict';
/**
 * hebao-sfx CLI
 *
 *   hebao-sfx list                         列出 12 条音效
 *   hebao-sfx build                        输出全部到 ./sfx
 *   hebao-sfx build -o public/sfx          指定输出目录
 *   hebao-sfx build stamp whoosh            只造指定几条
 *   hebao-sfx build --peak=-15              统一峰值电平
 *   hebao-sfx json                         输出机器可读清单（给 agent / 构建脚本用）
 */

const path = require('path');
const { list, writeAll, IDS } = require('../src');
const PKG = require('../package.json');

const argv = process.argv.slice(2);
const cmd = argv[0] || 'help';

/**
 * 手写参数解析：要同时支持 `-o dir` / `--out dir` / `--out=dir`，
 * 且能区分「选项的值」和「位置参数」，否则 `build -o sfx` 会把 sfx 当成音效 id。
 */
const ALIAS = { o: 'out', p: 'peak', h: 'help' };

function parseArgs(list) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.startsWith('-')) {
      const raw = a.replace(/^--?/, '');
      const eq = raw.indexOf('=');
      let key = eq === -1 ? raw : raw.slice(0, eq);
      key = ALIAS[key] || key;
      if (eq !== -1) {
        opts[key] = raw.slice(eq + 1);
      } else {
        const next = list[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          opts[key] = next;
          i++;
        } else {
          opts[key] = true;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { opts, positional };
}

const { opts, positional } = parseArgs(argv.slice(1));
const flag = (name, dflt) => (opts[name] === undefined ? dflt : opts[name]);

function banner() {
  const rows = list();
  console.log('');
  console.log('  id           时长     峰值      对应画面');
  console.log('  ' + '-'.repeat(66));
  for (const r of rows) {
    console.log(
      '  ' +
        r.id.padEnd(12) +
        (r.duration.toFixed(2) + 's').padEnd(9) +
        (r.peakDb + 'dB').padEnd(10) +
        r.role
    );
  }
  console.log('');
  console.log('  共 ' + rows.length + ' 条 · 44.1kHz / 16bit / 立体声 · 全部由代码合成，无采样素材');
  console.log('');
}

switch (cmd) {
  case 'list':
  case 'ls':
    banner();
    break;

  case 'json': {
    console.log(JSON.stringify({ name: PKG.name, version: PKG.version, sampleRate: 44100, sfx: list() }, null, 2));
    break;
  }

  case 'build':
  case 'gen': {
    const out = path.resolve(String(flag('out', 'sfx')));
    const peakArg = flag('peak', null);
    const opts2 = peakArg === null || peakArg === true ? {} : { peakDb: Number(peakArg) };

    const unknown = positional.filter((a) => !IDS.includes(a));
    if (unknown.length) {
      console.error('未知音效 id: ' + unknown.join(', ') + '\n用 `hebao-sfx list` 查看可用值');
      process.exit(1);
    }

    const results = writeAll(out, positional, opts2);
    console.log('\n  输出到 ' + out + '\n');
    let total = 0;
    for (const r of results) {
      total += r.bytes;
      console.log(
        '  ' +
          r.id.padEnd(12) +
          (r.duration.toFixed(2) + 's').padEnd(9) +
          (r.peakDb.toFixed(1) + 'dBFS').padEnd(11) +
          (r.bytes / 1024).toFixed(0) +
          'KB'
      );
    }
    console.log('\n  共 ' + results.length + ' 个文件，' + (total / 1024 / 1024).toFixed(2) + ' MB');
    if (peakArg === null) console.log('  峰值按预设的相对电平表输出（stamp 最响、tick 最轻）——这是刻意的。');
    console.log('');
    break;
  }

  default:
    console.log(`
  hebao-sfx v${PKG.version} — 表彰视频事件音效，纯代码合成

  用法
    hebao-sfx list                 列出 12 条音效及其对应画面
    hebao-sfx build [-o dir]        生成 WAV（默认 ./sfx）
    hebao-sfx build stamp whoosh    只生成指定几条
    hebao-sfx build --peak=-15      统一峰值电平（默认按相对电平表）
    hebao-sfx json                  输出 JSON 清单

  直接当库用
    const sfx = require('hebao-sfx');
    sfx.writeAll('public/assets/sfx');
`);
}
