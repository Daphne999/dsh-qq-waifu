import { splitReply, typingDelayMs } from '../lib/splitter.mjs';

const longSentence =
  '今天上午开会开到了十一点半，下午又写了一下午代码，晚上还改了三版方案，' +
  '中间还接了三个电话，回了两封邮件，真的是从早忙到晚，现在脑子已经彻底转不动了。';

const cases = [
  { name: '一句话', input: '我回来了。', max: 1 },
  { name: '三句', input: '我回来了。今天有点累。不过还好。', max: 3 },
  { name: '短句并进前一段', input: '嗯。好。那我们走吧。', max: 2 },
  { name: '超长句按逗号切', input: longSentence, min: 2 },
  { name: '换行当分隔', input: '在的～\n刚才在忙，没看到消息。\n怎么啦？', max: 3 },
  {
    name: '超过上限要合并',
    input: '第一句话写得长一点。第二句话也写得长一点。第三句话还是长一点。第四句话继续长一点。第五句话仍然很长。第六句话也躲不掉。',
    max: 5,
  },
  { name: '空输入', input: '', exact: 0 },
];

let bad = 0;
for (const c of cases) {
  const out = splitReply(c.input, { maxChunks: 5 });
  const joined = out.join('').replace(/\s/g, '');
  const sameText = c.input === '' ? out.length === 0 : joined === c.input.replace(/\s/g, '');
  const countOk =
    c.exact !== undefined
      ? out.length === c.exact
      : (c.max === undefined || out.length <= c.max) && (c.min === undefined || out.length >= c.min);
  const ok = sameText && countOk;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${c.name}: ${out.length} 段 ${JSON.stringify(out.slice(0, 2))}${out.length > 2 ? '…' : ''}`);
}

const d1 = typingDelayMs('好');
const d2 = typingDelayMs(longSentence);
const dOk = d1 >= 180 && d1 <= 1800 && d2 > d1 && d2 <= 1800;
if (!dOk) bad++;
console.log(`${dOk ? '✅' : '❌'} 打字延迟: 短句 ${d1}ms / 长句 ${d2}ms`);

console.log(bad === 0 ? '\n✅ 切分逻辑全部符合预期' : `\n❌ ${bad} 项不符合预期`);
process.exit(bad === 0 ? 0 : 1);
