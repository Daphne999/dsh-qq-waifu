/**
 * apply-patch.mjs —— 幂等地给 dsh-qqbot 的发送链打上"分条发送"补丁。
 *
 *   node apply-patch.mjs           打补丁
 *   node apply-patch.mjs --check   只查状态
 *   node apply-patch.mjs --revert  撤销（从 .waifu-orig 还原）
 *
 * 打两处：
 *   ① outbound-buffer.js 的 flush（正常情况下回复走这里 —— 需要先把 streaming 关掉）
 *   ② outbound.js 的 send（兜底路径：非流式、非缓冲的消息）
 *
 * ⚠️ dsh-qqbot 升级会覆盖 dist，升级后必须重跑。
 * ⚠️ 改完需重启 DSH 才生效（dist 里的模块不会被热加载）。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QQ = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', '@tencent-connect', 'dsh-qqbot', 'dist', 'transport');
const HELPER_SRC = path.join(HERE, 'waifu-split.js');
const HELPER_DST = path.join(QQ, 'waifu-split.js');

const TARGETS = [
  { name: 'outbound-buffer.js', kind: 'buffer' },
  { name: 'outbound.js', kind: 'router' },
];

const MARK = 'waifuPlan';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const REVERT = args.includes('--revert');

const state = TARGETS.map((t) => {
  const file = path.join(QQ, t.name);
  const orig = file + '.waifu-orig';
  const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return { ...t, file, orig, src, patched: src.includes(MARK), hasOrig: fs.existsSync(orig) };
});

if (CHECK) {
  for (const s of state) {
    console.log(`${s.patched ? '✅ 已打' : 'ℹ️ 未打'}  ${s.name}${s.hasOrig ? '（有备份）' : ''}`);
  }
  process.exit(0);
}

if (REVERT) {
  let ok = 0;
  for (const s of state) {
    if (!s.hasOrig) continue;
    fs.copyFileSync(s.orig, s.file);
    ok++;
  }
  try {
    fs.unlinkSync(HELPER_DST);
  } catch {}
  console.log(ok ? `✅ 已撤销 ${ok} 个文件，重启后生效` : 'ℹ️ 没有可撤销的备份');
  process.exit(0);
}

fs.copyFileSync(HELPER_SRC, HELPER_DST);
const importLine = 'import { waifuPlan } from "./waifu-split.js";';

function addImport(src) {
  if (src.includes(importLine)) return src;
  const m = src.match(/^import .+?;$/m);
  return m ? src.replace(m[0], `${m[0]}\n${importLine}`) : `${importLine}\n${src}`;
}

for (const s of state) {
  if (s.patched) {
    console.log(`ℹ️ ${s.name} 已打过，跳过`);
    continue;
  }
  fs.copyFileSync(s.file, s.orig);
  let out = addImport(s.src);
  let changed = false;

  if (s.kind === 'buffer') {
    const before = 'const chunks = chunkMarkdownText(this.buffer, this.limit);';
    const loopBefore = `            for (const chunk of chunks) {
                await this.bot.sendMarkdown(this.record.replyTarget, chunk);
            }`;
    if (!out.includes(before) || !out.includes(loopBefore)) {
      console.error(`❌ ${s.name} 结构与预期不符，跳过`);
      continue;
    }
    out = out.replace(before, "const chunks = waifuPlan(this.buffer, this.limit, 'sendMarkdown', null);");
    out = out.replace(
      loopBefore,
      `            for (const chunk of chunks) {
                const piece = typeof chunk === 'object' && chunk !== null ? chunk.text : chunk;
                const wait = typeof chunk === 'object' && chunk !== null ? chunk.delayMs || 0 : 0;
                if (wait > 0) await new Promise((r) => setTimeout(r, wait));
                await this.bot.sendMarkdown(this.record.replyTarget, piece);
            }`,
    );
    changed = true;
  }

  if (s.kind === 'router') {
    const before = 'const chunks = chunkMarkdownText(text, this.config.textChunkLimit);';
    const loopBefore = `        for (const chunk of chunks) {
            try {
                await this.bot.sendMarkdown(record.replyTarget, chunk);`;
    if (!out.includes(before) || !out.includes(loopBefore)) {
      console.error(`❌ ${s.name} 结构与预期不符，跳过`);
      continue;
    }
    out = out.replace(before, 'const chunks = waifuPlan(text, this.config.textChunkLimit, tag, this.config);');
    out = out.replace(
      loopBefore,
      `        for (const chunk of chunks) {
            const piece = typeof chunk === 'object' && chunk !== null ? chunk.text : chunk;
            const wait = typeof chunk === 'object' && chunk !== null ? chunk.delayMs || 0 : 0;
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
            try {
                await this.bot.sendMarkdown(record.replyTarget, piece);`,
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(s.file, out, 'utf8');
    console.log(`✅ 已打补丁：${s.name}（备份 ${s.name}.waifu-orig）`);
  }
}

console.log('\n完成。记得：① 把 im-qqbot 的 streaming 设为 false；② 重启 DSH 生效。');
