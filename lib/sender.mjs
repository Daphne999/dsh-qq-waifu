/**
 * sender.mjs —— 把切好的句子逐条发出去，中间按"打字速度"停顿。
 *
 * 发送动作由外部注入（send 函数），这样单测里可以完全离线验证顺序与节奏。
 */
import { splitReply, typingDelayMs } from './splitter.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} text 完整回复
 * @param {(chunk: string, index: number) => Promise<any>} send 实际发送
 * @param {object} opts
 * @returns {Promise<{sent: string[], failedAt: number|null, error: string|null}>}
 */
export async function sendSentences(text, send, opts = {}) {
  const {
    maxChunks = 5,
    minChunkChars = 4,
    maxChunkChars = 60,
    stripTrailingChars = '。',
    perCharMs = 45,
    minDelayMs = 180,
    maxDelayMs = 1800,
    fixedDelayMs = null,
    onChunk = null,
    shouldContinue = () => true,
  } = opts;

  const chunks = splitReply(text, { maxChunks, minChunkChars, maxChunkChars, stripTrailingChars });
  const sent = [];

  for (let i = 0; i < chunks.length; i++) {
    if (!shouldContinue()) break;
    const chunk = chunks[i];
    try {
      await send(chunk, i);
      sent.push(chunk);
      onChunk?.(chunk, i, chunks.length);
    } catch (e) {
      return { sent, failedAt: i, error: e instanceof Error ? e.message : String(e) };
    }
    if (i < chunks.length - 1) {
      const wait = fixedDelayMs ?? typingDelayMs(chunk, { perCharMs, minMs: minDelayMs, maxMs: maxDelayMs });
      await sleep(wait);
    }
  }

  return { sent, failedAt: null, error: null };
}
