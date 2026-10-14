/**
 * cnchar 封装：拼音（含多音字）、带声调拼音、无声调音节、笔画数
 * 所有汉字信息统一在此获取，保证游戏判定与积分准确。
 */
import cnchar from 'cnchar';
import 'cnchar-poly';

// 声调符号 → 声调号
const TONE_MARKS: Record<string, number> = {
  ā: 1, á: 1, ǎ: 1, à: 1,
  ē: 2, é: 2, ě: 2, è: 2,
  ī: 3, í: 3, ǐ: 3, ì: 3,
  ō: 4, ó: 4, ǒ: 4, ò: 4,
  ū: 5, ú: 5, ǔ: 5, ù: 5, ǖ: 5, ǘ: 5, ǚ: 5, ǜ: 5,
  ê: 0,
};

const BASE_VOWEL: Record<string, string> = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v',
};

export interface CharInfo {
  /** 汉字 */
  char: string;
  /** 主要读音，带声调符号，如 "sì" */
  spell: string;
  /** 所有读音的无声调音节，小写，如 ["si"] */
  syllables: string[];
  /** 所有读音的带声调键，如 ["si4"] */
  toneKeys: string[];
  /** 笔画数 */
  strokes: number;
}

/** 去掉声调符号，返回 { base: 无声调字母(v→v), tone: 声调号1-4,轻声0 } */
export function stripTone(p: string): { base: string; tone: number } {
  let tone = 0;
  let base = '';
  for (const ch of p) {
    if (TONE_MARKS[ch] !== undefined) {
      tone = TONE_MARKS[ch];
      base += BASE_VOWEL[ch];
    } else {
      base += ch;
    }
  }
  return { base: base.toLowerCase().replace(/ü/g, 'v'), tone };
}

const cache = new Map<string, CharInfo | null>();

/** 获取单个汉字信息；cnchar 不收录时返回 null */
export function charInfo(ch: string): CharInfo | null {
  if (cache.has(ch)) return cache.get(ch)!;
  let info: CharInfo | null = null;
  try {
    const strokes = Number(cnchar.stroke(ch));
    // poly 插件下单字返回 "(Lè|Yuè)" 形式；单音字返回普通字符串
    const raw = String(cnchar.spell(ch, 'poly', 'tone') ?? '').trim();
    const readings = (raw.startsWith('(') ? raw.slice(1, -1).split('|') : [raw])
      .map((s) => s.trim())
      .filter(Boolean);
    if (readings.length && Number.isFinite(strokes) && strokes > 0) {
      const syllables = [...new Set(readings.map((r) => stripTone(r).base))];
      const toneKeys = [...new Set(readings.map((r) => {
        const { base, tone } = stripTone(r);
        return `${base}${tone}`;
      }))];
      info = {
        char: ch,
        spell: readings[0],
        syllables,
        toneKeys,
        strokes,
      };
    }
  } catch {
    info = null;
  }
  cache.set(ch, info);
  return info;
}

/** 阿拉伯数字（0-9999）→ 中文读法："10"→"十"、"20"→"二十"、"105"→"一百零五" */
export function numToChinese(n: number): string {
  const CNUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n < 10) return CNUM[n];
  if (n < 20) return n % 10 ? '十' + CNUM[n % 10] : '十';
  if (n < 100) {
    const o = n % 10;
    return CNUM[Math.floor(n / 10)] + '十' + (o ? CNUM[o] : '');
  }
  const q = Math.floor(n / 1000);
  const b = Math.floor((n % 1000) / 100);
  const s = Math.floor((n % 100) / 10);
  const g = n % 10;
  let out = '';
  if (q) out += CNUM[q] + '千';
  if (b) out += CNUM[b] + '百';
  else if (q && (s || g)) out += '零';
  if (s) out += CNUM[s] + '十';
  else if (b && g) out += '零';
  if (g) out += CNUM[g];
  return out;
}

/**
 * 判断 ASR 转写是否为呼吸/环境音产生的语气词（嗯、啊、呃、um…）。
 * 这类声音不该判错——孩子只是没说话，不是读错了字。
 * 注意：若语气词恰好与场上亮卡同音（如"哦"→"噢"），匹配逻辑仍会先走，不受影响。
 */
const NOISE_RE = /^[嗯啊呃哦噢喔额唔哎唉嘿哈呀哇哼啦咯喽哪吧吗呢嘛哟欸诶喂呜嗨耶了滴嗯那这个是了着]+$/;
const NOISE_LATIN_RE = /^(?:um+|uh+|ah+|oh+|eh+|hm+|hmm+|mm+|em+|en+|er+|h+|sh+|huh+|meh+|yeah+)$/i;
export function isNoiseText(text: string): boolean {
  const t = text.replace(/[\s，。！？、,.!?~～·…]/g, '');
  if (!t) return true;
  if (NOISE_RE.test(t)) return true;
  return NOISE_LATIN_RE.test(t);
}

/** 把任意文本（可能是 ASR 返回的汉字、字母拼音、数字）转成读到的音节集合 */
export function textToSyllables(text: string): { syllables: Set<string>; toneKeys: Set<string> } {
  const syllables = new Set<string>();
  const toneKeys = new Set<string>();
  if (!text) return { syllables, toneKeys };

  // 阿拉伯数字 → 中文数字（ASR 偶尔把"四"识别成 4）
  const DIGIT: Record<string, string> = {
    '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
    '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
  };

  // 抽出连续的拉丁拼音串
  const latin = text.toLowerCase().match(/[a-züǖǘǚǜĀ-ſāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/gi) ?? [];
  for (const raw of latin) {
    const { base, tone } = stripTone(raw);
    if (base) syllables.add(base);
    toneKeys.add(`${base}${tone}`);
  }

  // 逐汉字转拼音
  for (const rawCh of text) {
    const ch = DIGIT[rawCh] ?? rawCh;
    const info = charInfo(ch);
    if (info) {
      info.syllables.forEach((s) => syllables.add(s));
      info.toneKeys.forEach((t) => toneKeys.add(t));
    }
  }
  return { syllables, toneKeys };
}

/** 判断两组读音是否同音（strictTone=true 时声调也要一致） */
export function pronunciationMatch(
  heard: { syllables: Set<string>; toneKeys: Set<string> },
  target: CharInfo,
  strictTone: boolean,
): boolean {
  if (strictTone) {
    for (const t of target.toneKeys) {
      if (heard.toneKeys.has(t)) return true;
    }
    // 听到的是无调字母串时，声调信息缺失，退回音节匹配以免误伤
    for (const s of target.syllables) {
      if (heard.syllables.has(s) && [...heard.toneKeys].some((k) => k === `${s}0`)) return true;
    }
    return false;
  }
  return target.syllables.some((s) => heard.syllables.has(s));
}
