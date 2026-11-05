/**
 * splitter.mjs —— 把一段回复切成"像人一句一句发"的小段。
 *
 * 纯函数、无依赖，方便单测。规则：
 *   1. 先按句末标点切（。！？!?…；; 和换行）
 *   2. 过短的片段（默认 < 4 字）并进前一段，避免"嗯。""好。"单独刷屏
 *   3. 过长的片段（默认 > 60 字）按逗号再切一次，避免一条顶屏幕
 *   4. 最多切 maxChunks 段，超出的合并到最后一段
 */
const SENTENCE_END = /(?<=[。！？!?；;…\n])/;

export function splitReply(text, opts = {}) {
  const {
    minChunkChars = 4,
    maxChunkChars = 60,
    maxChunks = 5,
    keepPunctuation = true,
    // 句末要去掉的字符：默认只去句号（真人发消息很少打句号），保留 ？！ 这类情绪标点
    stripTrailingChars = '。',
  } = opts;

  const raw = String(text ?? '').trim();
  if (!raw) return [];

  // 1) 按句末标点粗切
  let parts = raw
    .split(SENTENCE_END)
    .map((s) => s.trim())
    .filter(Boolean);

  // 2) 太短的并到前一段
  const merged = [];
  for (const p of parts) {
    const prev = merged[merged.length - 1];
    if (prev && p.length < minChunkChars) merged[merged.length - 1] = prev + p;
    else merged.push(p);
  }
  parts = merged;

  // 3) 太长的按逗号再切
  const out = [];
  for (const p of parts) {
    if (p.length <= maxChunkChars) {
      out.push(p);
      continue;
    }
    let buf = '';
    for (const seg of p.split(/(?<=[，,])/)) {
      if ((buf + seg).length > maxChunkChars && buf) {
        out.push(buf);
        buf = seg;
      } else buf += seg;
    }
    if (buf) out.push(buf);
  }

  // 4) 超过上限的合并
  if (out.length > maxChunks) {
    const head = out.slice(0, maxChunks - 1);
    const tail = out.slice(maxChunks - 1).join('');
    out.length = 0;
    out.push(...head, tail);
  }

  // 5) 去掉句末不需要的标点（默认只去句号，保留 ？！ 这类情绪）
  if (!keepPunctuation) return out.map((s) => s.replace(/[。！？!?；;…，,]+$/g, ''));
  if (stripTrailingChars) {
    const esc = stripTrailingChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`[${esc}]+$`);
    return out.map((s) => {
      const t = s.replace(re, '').trim();
      return t || s; // 全是标点就保留原文，别发空消息
    });
  }
  return out;
}

/** 估算"打字"需要多久：按字数，带上下限 */
export function typingDelayMs(chunk, { perCharMs = 45, minMs = 180, maxMs = 1800 } = {}) {
  const n = String(chunk || '').length;
  return Math.min(maxMs, Math.max(minMs, n * perCharMs));
}
