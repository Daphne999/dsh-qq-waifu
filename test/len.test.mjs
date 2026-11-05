import { splitReply } from '../lib/splitter.mjs';

let bad = 0;

// 短消息：每条都去标点
{
  const out = splitReply('这次短。每条都去。就这样。');
  const ok = out.length === 3 && out.every((s) => !/[。]$/.test(s));
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} 短消息每条都去: ${JSON.stringify(out)}`);
}

// 长消息：只去最后一条
{
  const long =
    '第一句话稍微长一点，得把这件事说清楚，不然她看不懂我在讲什么。' +
    '第二句话也不短，补充另一个细节，说明为什么要这么改。' +
    '第三句话继续展开，让整段的字数稳稳超过六十个。' +
    '第四句话收尾。';
  const out = splitReply(long);
  const last = out[out.length - 1];
  const middleKeepPunct = out.slice(0, -1).every((s) => s.endsWith('。'));
  const lastStripped = !last.endsWith('。');
  const ok = out.length >= 3 && middleKeepPunct && lastStripped;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} 长消息只去最后: ${JSON.stringify(out)}`);
}

// 表格：整条不分
{
  const t = '| a | b |\n|---|---|\n| 1 | 2 |';
  const out = splitReply(t);
  const ok = out.length === 1;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} 表格不分条: ${out.length} 条`);
}

console.log(bad === 0 ? '\n✅ 标点规则全部符合预期' : `\n❌ ${bad} 项不符合`);
process.exit(bad === 0 ? 0 : 1);
