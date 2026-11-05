import { splitReply } from '../lib/splitter.mjs';

const short = '这次短。每条都去。就这样。';
const long =
  '第一句话稍微长一点，得把这件事说清楚，不然她看不懂我在讲什么。' +
  '第二句话也不短，补充另一个细节，说明为什么要这么改。' +
  '第三句话继续展开，让整段的字数稳稳超过六十个。' +
  '第四句话收尾。';

console.log('短消息:', JSON.stringify(splitReply(short)), '| 长度', short.length);
console.log('长消息:', JSON.stringify(splitReply(long)), '| 长度', long.length);
