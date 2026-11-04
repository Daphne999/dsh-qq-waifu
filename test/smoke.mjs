/**
 * smoke.mjs —— 验证三个工具注册成功、切分预览可用、关闭开关后拒绝发送。
 * 不实际发送（发送通道是 qq-notify，这里只测到"会拒绝"为止）。
 */
import { apply } from '../lib/index.js';

const tools = [];
const fakeCtx = {
  logger: { info: () => {} },
  get: (k) => (k === 'tools' ? { register: (d) => tools.push(d) } : undefined),
  on: () => {},
  effect: () => {},
};

await apply(fakeCtx, {
  enabled: true,
  maxChunks: 5,
  minChunkChars: 4,
  maxChunkChars: 60,
  perCharMs: 10,
  minDelayMs: 20,
  maxDelayMs: 100,
});

const byName = (n) => tools.find((t) => t.name === n);
const names = ['waifu_split', 'waifu_say', 'waifu_status'];
const missing = names.filter((n) => !byName(n));
if (missing.length) {
  console.error('❌ 缺少工具:', missing.join(', '));
  process.exit(1);
}
console.log(`✅ ${names.length} 个工具已注册`);

const split = await byName('waifu_split').execute({ text: '我回来了。今天有点累。不过还好。' });
if (!split.ok || !/切成 3 条/.test(split.report)) {
  console.error('❌ 预览结果不对:\n' + split.report);
  process.exit(1);
}
console.log('✅ 切分预览正确（3 条）');

const empty = await byName('waifu_split').execute({ text: '   ' });
if (empty.ok !== false) {
  console.error('❌ 空文本没有被拒绝');
  process.exit(1);
}
console.log('✅ 空文本被拒绝');

const status = await byName('waifu_status').execute();
if (!status.ok || !/开关：开/.test(status.report)) {
  console.error('❌ 状态输出不对:\n' + status.report);
  process.exit(1);
}
console.log('✅ 状态输出正常');

// 关掉开关后必须拒绝发送（安全网：不会误发）
const closed = [];
await apply(
  {
    logger: { info: () => {} },
    get: (k) => (k === 'tools' ? { register: (d) => closed.push(d) } : undefined),
    on: () => {},
    effect: () => {},
  },
  { enabled: false },
);
const say = await closed.find((t) => t.name === 'waifu_say').execute({ text: '在吗。' });
if (say.ok !== false || !/已关闭/.test(say.report)) {
  console.error('❌ 关闭后仍然尝试发送:', say.report);
  process.exit(1);
}
console.log('✅ 关闭开关后拒绝发送');

console.log('\n✅ 全部通过');
