/**
 * waifu-split.js —— 注入到 dsh-qqbot dist/transport 的"分条发送"实现。
 *
 * 由 dsh-qq-waifu 的 apply-patch.mjs 复制到这里，被 outbound.js 的 send() 调用。
 * 只对"整条回复"（tag === 'sendMarkdown'）做分句，工具结果/错误提示保持原样。
 *
 * 配置从 ~/.dsh/profiles/desktop/local/waifu-split.json 读（每次调用重读，改完不用重启）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_PATH = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'local', 'waifu-split.json');

const DEFAULTS = {
  enabled: true,
  maxChunks: 5,
  minChunkChars: 4,
  maxChunkChars: 60,
  perCharMs: 45,
  minDelayMs: 180,
  maxDelayMs: 1800,
  stripTrailingChars: '。',
  onlyTags: ['sendMarkdown'],
};

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

const SENTENCE_END = /(?<=[。！？!?；;…\n])/;

function splitText(text, cfg) {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  let parts = raw.split(SENTENCE_END).map((s) => s.trim()).filter(Boolean);

  const merged = [];
  for (const p of parts) {
    const prev = merged[merged.length - 1];
    if (prev && p.length < cfg.minChunkChars) merged[merged.length - 1] = prev + p;
    else merged.push(p);
  }
  parts = merged;

  const out = [];
  for (const p of parts) {
    if (p.length <= cfg.maxChunkChars) {
      out.push(p);
      continue;
    }
    let buf = '';
    for (const seg of p.split(/(?<=[，,])/)) {
      if ((buf + seg).length > cfg.maxChunkChars && buf) {
        out.push(buf);
        buf = seg;
      } else buf += seg;
    }
    if (buf) out.push(buf);
  }

  if (out.length > cfg.maxChunks) {
    const head = out.slice(0, cfg.maxChunks - 1);
    const tail = out.slice(cfg.maxChunks - 1).join('');
    return [...head, tail];
  }
  return out;
}

function stripTail(s, chars) {
  if (!chars) return s;
  const esc = String(chars).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const t = s.replace(new RegExp(`[${esc}]+$`), '').trim();
  return t || s;
}

function delayFor(chunk, cfg) {
  const n = String(chunk || '').length;
  return Math.min(cfg.maxDelayMs, Math.max(cfg.minDelayMs, n * cfg.perCharMs));
}

/**
 * 把一段完整回复变成"要发送的计划"：数组项可以是 string（原样）或 {text, delayMs}。
 * 保持向后兼容：非目标 tag 直接返回原 chunk 数组。
 *
 * 去重：qqbot 里 buffer.flush 和 router.send 可能对同一条回复各触发一次，
 * 用"文本 + 时间窗"挡住第二次（默认 8 秒内同样内容只发一次）。
 */
const recent = new Map(); // key -> timestamp

function dedupeKey(text) {
  const s = String(text ?? '');
  return `${s.length}:${s.slice(0, 40)}:${s.slice(-40)}`;
}

export function waifuPlan(text, limit, tag, _config) {
  const cfg = readConfig();
  const base = chunkByLimit(text, limit ?? 2000);

  const isTarget = cfg.enabled && (cfg.onlyTags ?? []).includes(tag);
  if (!isTarget) return base;

  // 同一段文本在短时间内第二次出现 → 认为重复投递，直接吞掉
  const now = Date.now();
  const key = dedupeKey(text);
  const last = recent.get(key);
  if (last !== undefined && now - last < (cfg.dedupeWindowMs ?? 8000)) {
    return [];
  }
  recent.set(key, now);
  // 顺手清理过期项，避免 Map 无限增长
  if (recent.size > 50) {
    for (const [k, t] of recent) {
      if (now - t > 30000) recent.delete(k);
    }
  }

  const pieces = splitText(text, cfg).map((s) => stripTail(s, cfg.stripTrailingChars));
  // 分句失败（比如整条没有标点）就退回原来的长度切分
  if (pieces.length <= 1) return base;

  return pieces.map((p, i) => ({
    text: p,
    delayMs: i === 0 ? 0 : delayFor(pieces[i - 1], cfg),
  }));
}

/** 简易的按长度切分（不依赖原模块，避免循环引用） */
function chunkByLimit(text, limit) {
  const max = Number(limit) > 0 ? Number(limit) : 2000;
  const s = String(text ?? '');
  if (s.length <= max) return [s];
  const out = [];
  for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max));
  return out;
}
