import { sendSentences } from '../lib/sender.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) 正常逐条发送：顺序正确、每段只发一次
{
  const got = [];
  const res = await sendSentences(
    '我回来了。今天有点累。不过还好。',
    async (chunk) => {
      got.push(chunk);
    },
    { fixedDelayMs: 5 },
  );
  const ok = res.failedAt === null && got.length === 3 && got[0] === '我回来了。' && got[2] === '不过还好';
  console.log(`${ok ? '✅' : '❌'} 逐条发送: ${JSON.stringify(got)}`);
  if (!ok) process.exit(1);
}

// 2) 中途失败要停下，并报告失败位置
{
  const got = [];
  const res = await sendSentences(
    '第一句话比较长。第二句话也比较长。第三句话还是很长。',
    async (chunk, i) => {
      if (i === 1) throw new Error('网络断了');
      got.push(chunk);
    },
    { fixedDelayMs: 5 },
  );
  const ok = res.failedAt === 1 && got.length === 1 && /网络断了/.test(res.error || '');
  console.log(`${ok ? '✅' : '❌'} 中途失败: 已发 ${got.length} 条，failedAt=${res.failedAt}`);
  if (!ok) process.exit(1);
}

// 3) 外部要求中止（比如用户又发了新消息）就停
{
  const got = [];
  let flag = true;
  const p = sendSentences(
    '一。二。三。四。',
    async (chunk) => {
      got.push(chunk);
      flag = false; // 发完第一条就"叫停"
    },
    { fixedDelayMs: 5, shouldContinue: () => flag },
  );
  const res = await p;
  const ok = res.sent.length === 1;
  console.log(`${ok ? '✅' : '❌'} 可中止: 发出 ${res.sent.length} 条`);
  if (!ok) process.exit(1);
}

// 4) 延迟确实按打字速度走（短句间隔 < 长句间隔）
{
  const t0 = Date.now();
  await sendSentences('短句子。另一句。', async () => {}, { perCharMs: 5, minDelayMs: 20, maxDelayMs: 200 });
  const shortMs = Date.now() - t0;

  const t1 = Date.now();
  await sendSentences(
    '这句话比较长一点，大概二十来个字吧。还有第二句也不短，凑个长度。',
    async () => {},
    { perCharMs: 5, minDelayMs: 20, maxDelayMs: 200 },
  );
  const longMs = Date.now() - t1;
  const ok = shortMs > 0 && longMs > shortMs;
  console.log(`${ok ? '✅' : '❌'} 延迟节奏: 短 ${shortMs}ms / 长 ${longMs}ms`);
  if (!ok) process.exit(1);
}

console.log('\n✅ 发送逻辑全部符合预期');
