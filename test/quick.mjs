import { splitReply } from '../lib/splitter.mjs';

const t1 = '第一句话。第二句话。最后一句。';
console.log('只去最后一条的结尾:', JSON.stringify(splitReply(t1)));

const t2 = '| 仓库 | 状态 |\n|---|---|\n| dsh-warden | 有 |\n| dsh-qq-archive | 有 |';
const r2 = splitReply(t2);
console.log('表格不分条:', r2.length, '条');

const t3 = '看这段代码：\n```js\nconsole.log(1)\n```\n就这样。';
const r3 = splitReply(t3);
console.log('代码块不分条:', r3.length, '条');

const t4 = '好。';
console.log('单句:', JSON.stringify(splitReply(t4)));

const t5 = '真的吗？！我不信。就这样。';
console.log('带情绪标点:', JSON.stringify(splitReply(t5)));
