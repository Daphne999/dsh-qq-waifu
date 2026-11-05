import { splitReply } from '../lib/splitter.mjs';

const text = `1. 表格不再被切碎（含 | 的内容整条发）
2. 句号只去最后一条
3. 重复投递的兜底生效

十几秒。`;

const out = splitReply(text);
console.log('段数:', out.length);
out.forEach((s, i) => console.log(`  ${i + 1}. ${JSON.stringify(s)}`));
