# hebao-sfx

**12 类表彰 / 贺报视频事件音效。全部由代码合成，不读一个采样文件。**

零依赖、无第三方音频、无版权风险。一条命令产出 12 个 44.1kHz / 16bit / 立体声 WAV。

```bash
npx hebao-sfx build          # → ./sfx/*.wav，1.74 MB
```

- 在线试听：[zxl1130414901.github.io/hebao-sfx](https://zxl1130414901.github.io/hebao-sfx/)
- 只想要文件、不想要代码：`git clone` 后 `sfx/` 目录里就是

---

## 为什么不用采样包

现成的免费音效包有三个绕不开的坑：

1. **授权**。CC0 包里的曲目未必整包 CC0，混进一两首 CC-BY 就得逐条登记署名，批量出片时会漏。
2. **Content ID 误伤**。CC0 音效被别人剪进歌里并注册后，你直接使用原始文件也可能被平台自动下架。防御办法是变调、拉伸或加混响 —— 那还不如自己合成。
3. **听感不统一**。12 条来自 8 个作者、5 个录音棚，混在一条片子里像拼盘。贺报的情绪高度依赖"听觉一致性"。

合成恰好能同时解决这三件事：谐波与包络来自同一套语言，天然统一；不经过任何第三方文件，不存在 Content ID 匹配；代码即授权。

## 12 条音效

| id | 名称 | 时长 | 电平 | 对应画面上的什么动作 |
|---|---|---|---|---|
| `riser` | 开场上扬 | 1.23s | −16 dB | 元素从下方升起 / 巨字即将落定 |
| `stamp` | 印章砸落 | 0.65s | **−12 dB** | 徽章、印章、名次牌砸定 —— 全片最核心的一下 |
| `tick` | 数字跳动 | 0.10s | −22 dB | 业绩数字滚动时每一次跳字 |
| `coin` | 金币计数 | 0.45s | −18 dB | 金额 / 件数累加的听觉符号 |
| `applause` | 掌声 | 1.73s | −19 dB | 荣誉揭晓、定版后的人群反应 |
| `firework` | 礼花彩带 | 1.38s | −14 dB | 定版高潮、彩带炮炸开 |
| `whoosh` | 转场呼啸 | 0.45s | −18 dB | 幕与幕之间的"换口气" |
| `logosting` | 标识音 | 1.33s | −14 dB | 片尾落款，最"品牌"的一下 |
| `brass` | 颁奖铜管 | 0.98s | −15 dB | 职级晋升、荣誉揭晓 |
| `pageflip` | 翻页 | 0.27s | −21 dB | 榜单 / 条目切换 |
| `boom` | 低频冲击 | 1.03s | −13 dB | 标题落定、幕切，只给 40–90Hz |
| `sparkle` | 闪光颗粒 | 0.75s | −20 dB | 金色粒子飞散、数据点亮 |

## 用法

### CLI

```bash
npx hebao-sfx list                    # 列出全部，含对应画面
npx hebao-sfx build                   # 生成到 ./sfx
npx hebao-sfx build -o public/sfx     # 指定目录
npx hebao-sfx build stamp whoosh      # 只要这几条
npx hebao-sfx build --peak=-15        # 统一峰值（默认按相对电平表）
npx hebao-sfx json                    # 机器可读清单
```

### 当库用

```js
const sfx = require('hebao-sfx');

const buf = sfx.wav('stamp');              // 直接拿 WAV Buffer
sfx.writeFile('out/stamp.wav', 'stamp');
sfx.writeAll('public/assets/sfx');         // 全部写出
sfx.list();                                // 元数据
```

### 挂进 Remotion

音效不需要手动拖时间轴，跟着事件的帧号走即可：

```tsx
import { Audio, Sequence, staticFile } from 'remotion';

const EVENTS = [
  { t: 0.0, id: 'riser' },
  { t: 1.1, id: 'stamp' },
  { t: 1.6, id: 'tick' }, { t: 1.68, id: 'tick' }, { t: 1.76, id: 'tick' },
  { t: 2.6, id: 'pageflip' },
  { t: 4.6, id: 'applause' },
  { t: 6.6, id: 'logosting' },
];

const FPS = 60;

// t 秒 → t*60 帧，与画面用同一个换算，永远不会错位
export const SfxTrack = () => (
  <>
    {EVENTS.map((e, i) => (
      <Sequence key={i} from={Math.round(e.t * FPS)} durationInFrames={2 * FPS}>
        <Audio src={staticFile(`assets/sfx/${e.id}.wav`)} volume={1} />
      </Sequence>
    ))}
  </>
);
```

`volume={1}` 是刻意的：电平关系已经烘进文件，在 Remotion 里再乘系数会破坏这张表。要整体调响/调轻，改 `stage` 或最终混音，别逐条改。

## 相对电平表才是重点

单个音效好听、12 个混在一起却乱，原因几乎总是电平关系错了。本项目的电平是刻意排的：

```
stamp −12  ← 全片唯一的高点
boom  −13  firework −14  logosting −14  brass −15
riser −16  coin −18  whoosh −18  applause −19
sparkle −20  pageflip −21  tick −22
```

- **只有 `stamp` 允许最响**。如果两条音效电平相同，观众分不清哪一下才是重点。
- **`tick` 必须比 `coin` 低 4dB 以上**，否则滚数时会糊成连续的"哒哒哒"。
- **`applause` 是宽频持续声**，峰值不高但能量大，实际听感比 −19 更响，所以刻意压低。
- **`boom` 只占 40–90Hz**，和高频音效不抢，可以放心叠在 `stamp` 下面。

想要更强的冲击力，正确做法不是把 `stamp` 调响，而是**把其他音效整体调低 2–3dB**。

## 8 秒预算规则

一条 8 秒竖屏片子的听觉容量是有限的。经验值：

| 规则 | 数值 | 违反后的表现 |
|---|---|---|
| 事件组总数 | ≤ 8 组（6–8 组最佳） | 听不出重点，"热闹但记不住" |
| 0.4s 滑动窗口内 | ≤ 2 个事件 | 声音互相掩蔽，变成噪音 |
| 落定前留白 | 0.25–0.35s 无事件音 | stamp 那一下没有对比，砸不下来 |
| 首帧前 | 不要从 0.00s 就开始响 | 平台自动播放会有起播裁切 |

**安静才是冲击力的来源。** 如果听完觉得"吵"，先整体降 3dB，再删掉一个事件音，通常立刻变好。

## 响度的残酷事实

短视频平台通行口径是 **−14 LUFS**，但一条 8 秒、留白很多的贺报**到不了**这个值。

实测：`I = −16.6 LUFS`、`TP = −2.3 dBTP`、`LRA = 2.4`。`loudnorm` 无论 linear 还是 dynamic 都只能推到 −15.5，因为峰值预算已用完。硬追 −14 的代价是把 `stamp` 压扁 —— 那一下的瞬态正是全片最值钱的东西。

所以合理区间是 **−17 ～ −13 LUFS**。另外注意：`loudnorm` 报的 `input_i` 对短素材会偏低 0.5–1dB，判定请以 `ffmpeg -af ebur128` 的输出为准。

BGM 与本音效层的建议比例：BGM 比旁白低 12–15 dB，事件音效层再比 BGM 高 2–3 dB。

## 改音效

所有参数在 `src/presets.js`，DSP 原料在 `src/synth.js`。每条预设的 `build()` 只做"叠加"，所以可以自由分层：

```js
stamp: {
  gainDb: -12,
  build(b) {
    glide(b, 0, 0.42, 150, 62, 0.55, 0, 7.5);        // 低频冲击
    tone(b, 0, 210, 0.22, 0.26, 0, WOOD, 26);        // 木质体
    noise(b, 0, 0.035, 0.3, 0, 60, { lpf: 0.85 });   // 短促"咔"
    noise(b, 0.004, 0.5, 0.06, 0.2, 12, { lpf: 0.35 }); // 房间尾
    return 0.62;                                      // 时长（秒）
  },
}
```

改完跑 `npm test`，它会检查 WAV 头、采样率、峰值区间、尾部是否收敛，以及**同样输入是否产出同样字节**。

## 一个已知的缺口

民族仪式音色（锣鼓经、礼炮、拜年声）**没有成套的开源 CC0 资源**。Freesound 上 QMUL 的北京京剧打击乐是 CC-BY 且零散。

现实做法只有两条：用 `SuperCollider` 做金属质感（非整数倍频 + 短衰减 + 带通噪声），或者叠两层 `brass` + `pageflip` 变调。本项目目前是后者能做到的上限，`brass` 改成五声音阶即可近似锣鼓点。

## 目录

```
src/synth.js     DSP 原料：正弦、滑动正弦、滤波噪声、包络、WAV 编码
src/presets.js   12 条预设（含元数据与相对电平）
src/index.js     公共 API
bin/hebao-sfx.js CLI
index.html       试听页（npm run demo 后访问 localhost:4173）
sfx/             预生成的 WAV，可直接用
docs/design.md   参数背后的推导：谐波表、包络、为什么这么调
```

## License

MIT。生成的 WAV 文件同样无任何附加限制，商用、二次分发、再训练都可以，不需要署名。
