/**
 * 牌局引擎：羊了个羊式多层叠放字卡
 * - 高层字卡压住低层字卡；未被遮挡的字卡才可被读出消除
 * - 读出一个读音时，当前所有"无遮挡且同音"的字卡一起消除
 * - 消除后自动补充更难的新一波（笔画更多 / 出现更高年级字库的字）
 */
import { charInfo, type CharInfo } from '../lib/cn';
import { poolFrom, GRADES, type GradeId } from '../data/charPools';

export interface Card {
  id: number;
  info: CharInfo;
  x: number;
  y: number;
  layer: number;
  rot: number;
  wave: number;
  /** 静默补卡不播放入场动画（新卡从底下悄悄长出来） */
  quiet?: boolean;
}

export const CARD_W = 60;
export const CARD_H = 68;
export const BOARD_W = 340;
export const BOARD_H = 372;

const COLS = 7;
const ROWS = 5;
const PITCH_X = 46;
const PITCH_Y = 52;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 字卡中心允许的活动范围：层偏移 + 边缘格位会让摆位天然超出 BOARD 矩形，
 * 这里统一内缩（半卡宽 + 12px 安全边距），保证任何波次/补卡/重排
 * 都不会把字卡放到牌桌外——Board 只按 BOARD_W/BOARD_H 缩放，越界即被裁切。
 */
const MARGIN = 12;
const MIN_X = CARD_W / 2 + MARGIN;
const MAX_X = BOARD_W - CARD_W / 2 - MARGIN;
const MIN_Y = CARD_H / 2 + MARGIN;
const MAX_Y = BOARD_H - CARD_H / 2 - MARGIN;

/** 按本波难度挑选字库（带笔画与年级进阶） */
function selectChars(grade: GradeId, wave: number): CharInfo[] {
  const gradeIdx = GRADES.findIndex((g) => g.id === grade);
  const toInfo = (ch: string) => charInfo(ch);
  const uniq = (list: (CharInfo | null)[]) => {
    const map = new Map<string, CharInfo>();
    for (const i of list) if (i) map.set(i.char, i);
    return [...map.values()].sort((a, b) => a.strokes - b.strokes);
  };

  const base = uniq(poolFrom(grade, 0).map(toInfo));
  const slice = (arr: CharInfo[], from: number, to: number) =>
    arr.slice(Math.floor(arr.length * from), Math.floor(arr.length * to));

  if (wave === 0) {
    // 第一关：该年级最简单的一批字（范围放宽些，保证有足够多的不同读音）
    return slice(base, 0, 0.5);
  }

  // 第二关起：本级中等偏难笔画 + 高一年级字库渗入；波次越高笔画越重
  const baseLo = Math.min(0.4, 0.1 + wave * 0.06);
  const baseHi = Math.min(0.9, 0.55 + wave * 0.07);
  const picked = slice(base, baseLo, baseHi);

  const extra = Math.min(2, 1 + Math.floor((wave - 1) / 2));
  if (gradeIdx + 1 < GRADES.length) {
    const leak = uniq(poolFrom(GRADES[gradeIdx + 1].id, extra - 1).map(toInfo));
    const leakHi = Math.min(0.9, 0.4 + wave * 0.08);
    picked.push(...slice(leak, 0, leakHi));
  }
  return uniq(picked);
}

interface Group {
  syllable: string;
  infos: CharInfo[];
}

/** 构造若干"同音组"：优先同音不同字（四/寺/似），不足时同字重复 */
function buildGroups(chars: CharInfo[], count: number, wave: number): Group[] {
  const bySyllable = new Map<string, CharInfo[]>();
  for (const info of chars) {
    for (const s of info.syllables) {
      const arr = bySyllable.get(s) ?? [];
      if (!arr.some((a) => a.char === info.char)) arr.push(info);
      bySyllable.set(s, arr);
    }
  }
  const usable = shuffle([...bySyllable.entries()].filter(([, v]) => v.length >= 1));
  const groups: Group[] = [];
  // 第一关专用：已选字的全部读音（含多音字）都占位，保证每个字读音唯一、必须逐字读完
  const usedAny = new Set<string>();
  let idx = 0;
  while (groups.length < count && idx < usable.length * 3) {
    const [syllable, members] = usable[idx % usable.length];
    idx++;
    if (groups.some((g) => g.syllable === syllable)) continue;
    if (wave === 0) {
      const member = members.find((m) => !m.syllables.some((s) => usedAny.has(s)));
      if (!member) continue;
      member.syllables.forEach((s) => usedAny.add(s));
      groups.push({ syllable, infos: [member] });
      continue;
    }
    // 第二关起恢复"同音组"：读对一个音可以一次消 2~4 张同音字卡（波次越高大组越多）
    const p3 = Math.min(0.75, 0.45 + wave * 0.06);
    const p4 = Math.min(0.5, 0.08 + wave * 0.08);
    const size = Math.min(4, 2 + (Math.random() < p3 ? 1 : 0) + (Math.random() < p4 ? 1 : 0));
    const pool = shuffle(members);
    const infos: CharInfo[] = [];
    for (let i = 0; i < size; i++) {
      infos.push(pool[i % pool.length]);
    }
    groups.push({ syllable, infos });
  }
  return groups;
}

interface Placement {
  x: number;
  y: number;
  layer: number;
  rot: number;
}

function placeCards(count: number, layers: number, occupied: Set<string>): Placement[] | null {
  const placements: (Placement & { cell: string })[] = [];
  const usedCells = new Set(occupied);
  const layerCounts = new Array(layers).fill(0);

  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      // 低层权重更大，形成下宽上尖的叠堆（羊了个羊式小山）
      const r = Math.random();
      let layer = layers - 1;
      const weights =
        layers === 2
          ? [0.62, 0.38]
          : layers === 3
            ? [0.45, 0.33, 0.22]
            : [0.26, 0.22, 0.18, 0.14, 0.11, 0.09];
      let acc = 0;
      for (let l = 0; l < layers; l++) {
        acc += weights[l] ?? 0.1;
        if (r <= acc) {
          layer = l;
          break;
        }
      }
      // 中心聚集（三角分布）：字卡堆成中间高、四周低的小山
      const col = Math.min(COLS - 1, Math.floor(((Math.random() + Math.random()) / 2) * COLS));
      const row = Math.min(ROWS - 1, Math.floor(((Math.random() + Math.random()) / 2) * ROWS));
      const cell = `${layer}:${col}:${row}`;
      if (usedCells.has(cell)) continue;
      usedCells.add(cell);
      layerCounts[layer]++;

      const ox = (layer - (layers - 1) / 2) * 16 + rand(-6, 6);
      const oy = (layer - (layers - 1) / 2) * 17 + rand(-6, 6);
      placements.push({
        x: clamp(BOARD_W / 2 + (col - (COLS - 1) / 2) * PITCH_X + ox, MIN_X, MAX_X),
        y: clamp(BOARD_H / 2 + (row - (ROWS - 1) / 2) * PITCH_Y + oy, MIN_Y, MAX_Y),
        layer,
        rot: rand(-4, 4),
        cell,
      });
      placed = true;
    }
    if (!placed) return null;
  }
  return placements.map(({ cell, ...p }) => {
    void cell;
    return p;
  });
}

function overlaps(a: Card, b: Card): boolean {
  return (
    b.layer > a.layer &&
    Math.abs(b.x - a.x) < CARD_W * 0.58 &&
    Math.abs(b.y - a.y) < CARD_H * 0.58
  );
}

/**
 * 判断字卡 c 是否被现有牌堆的投影面积完全遮住：
 * 在 c 的矩形内打 5×5 网格共 25 个采样点，每个点都必须落在某张现有字卡的矩形内
 * （覆盖卡矩形内缩 8px，吸收双方 ±4° 旋转与圆角带来的边缘缝隙）
 */
function fullyHidden(c: Card, pile: Card[]): boolean {
  const hw = CARD_W / 2;
  const hh = CARD_H / 2;
  const m = 8;
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      const px = c.x - hw + (i * CARD_W) / 4;
      const py = c.y - hh + (j * CARD_H) / 4;
      const covered = pile.some((o) => Math.abs(o.x - px) <= hw - m && Math.abs(o.y - py) <= hh - m);
      if (!covered) return false;
    }
  }
  return true;
}

export function isBlocked(card: Card, cards: Card[]): boolean {
  return cards.some((o) => o.id !== card.id && overlaps(card, o));
}

function shareSyllable(a: Card, b: Card): boolean {
  return a.info.syllables.some((s) => b.info.syllables.includes(s));
}

/**
 * 统计无遮挡字卡里的同音对数。
 * 语音玩法中任何一张暴露字卡读对即可消除，不存在真正的死局；
 * 这里仅作为布局"软偏好"——让开局暴露区尽量多一些同音对，多消更爽快。
 */
function countExposedPairs(cards: Card[]): number {
  const exposed = cards.filter((c) => !isBlocked(c, cards));
  let n = 0;
  for (let i = 0; i < exposed.length; i++) {
    for (let j = i + 1; j < exposed.length; j++) {
      if (shareSyllable(exposed[i], exposed[j])) n++;
    }
  }
  return n;
}

let nextId = 1;

function instantiate(
  infos: CharInfo[],
  wave: number,
  layers: number,
  occupied: Set<string>,
): Card[] | null {
  const placements = placeCards(infos.length, layers, occupied);
  if (!placements) return null;
  return placements.map((p, i) => ({
    id: nextId++,
    info: infos[i],
    wave,
    ...p,
  }));
}

/** 在多种布局中挑出初始暴露同音对最多的一种 */
function bestLayout<T extends Card[]>(candidates: T[]): T {
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const score = countExposedPairs(c) * 100 + Math.random() * 10;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** 生成一波字卡（wave=0 即"第一关"，极易；wave>=1 第二关：开局就是一座 6 层字卡山） */
export function createWave(grade: GradeId, wave: number): Card[] {
  const layers = wave === 0 ? 2 : 6;
  const groupCount = wave === 0 ? 10 : Math.min(26, 18 + wave);
  const chars = selectChars(grade, wave);
  const groups = buildGroups(chars, groupCount, wave);
  const infos = groups.flatMap((g) => g.infos);

  const candidates: Card[][] = [];
  for (let attempt = 0; attempt < 24; attempt++) {
    const cards = instantiate(infos, wave, layers, new Set());
    if (cards) candidates.push(cards);
  }
  if (candidates.length === 0) return [];
  return bestLayout(candidates);
}

/**
 * 静默补卡（羊了个羊式）：每次消除后从牌堆底部悄悄长出 1~2 组新卡。
 * - 新卡永远垫在所有老卡之下，老卡永不被压暗
 * - 新卡必须被现有字卡山的投影面积完全遮住，绝不允许露出边缘
 * - 露出一丝的新卡直接丢弃，宁缺毋滥
 * - 无横幅、无音效、无入场动画——没有"一波一波"的感觉，山始终很深
 */
export function refillBottom(cards: Card[], grade: GradeId, wave: number): Card[] {
  const groupCount = 2 + (Math.random() < 0.5 ? 1 : 0); // 2~3 组（约 5~8 张）
  const chars = selectChars(grade, wave);
  const groups = buildGroups(chars, groupCount, wave);
  const infos = groups.flatMap((g) => g.infos);
  if (infos.length === 0) return cards;
  const minLayer = Math.min(...cards.map((c) => c.layer));

  let best: Card[] | null = null;
  let bestHidden = -1;
  for (let attempt = 0; attempt < 24; attempt++) {
    const fresh = instantiate(infos, wave, 2, new Set());
    if (!fresh) continue;
    // 整体垫到所有老卡之下，并标记静默（不播掉落入场动画）
    const shifted = fresh.map((c) => ({ ...c, layer: c.layer + minLayer - 2, quiet: true }));
    // 只保留被现有字卡山投影面积完全遮住的新卡
    const hidden = shifted.filter((c) => fullyHidden(c, cards));
    if (hidden.length > bestHidden) {
      bestHidden = hidden.length;
      best = [...cards, ...hidden];
      if (hidden.length === shifted.length) break; // 全部藏住，提前收工
    }
  }
  return best ?? cards;
}

/** 重新排列全部字卡位置（保留内容与张数） */
export function reshuffle(cards: Card[]): Card[] {
  if (cards.length === 0) return cards;
  const maxLayer = Math.max(...cards.map((c) => c.layer));
  const layers = maxLayer <= 1 ? 2 : 5;
  const infos = shuffle(cards.map((c) => c.info));
  for (let attempt = 0; attempt < 24; attempt++) {
    const placements = placeCards(infos.length, layers, new Set());
    if (!placements) continue;
    return cards.map((c, i) => ({ ...c, info: infos[i], ...placements[i] }));
  }
  return cards;
}

export type HeardTarget = { syllables: Set<string>; toneKeys: Set<string> };

/** 判定听到的读音能消哪些字卡（仅无遮挡，同音全部一起消） */
export function resolveMatch(
  cards: Card[],
  heard: HeardTarget,
  strictTone: boolean,
): { matched: Card[]; blockedHint: Card[] } {
  const matchInfo = (info: CharInfo): boolean => {
    if (strictTone) {
      const hitTone = info.toneKeys.some((t) => heard.toneKeys.has(t));
      if (hitTone) return true;
      // 听到的是无调字母串（tone=0）时退回音节匹配
      return info.syllables.some((s) => heard.syllables.has(s) && heard.toneKeys.has(`${s}0`));
    }
    return info.syllables.some((s) => heard.syllables.has(s));
  };
  const matched: Card[] = [];
  const blockedHint: Card[] = [];
  for (const c of cards) {
    if (!matchInfo(c.info)) continue;
    if (isBlocked(c, cards)) blockedHint.push(c);
    else matched.push(c);
  }
  return { matched, blockedHint };
}

/** 当前无遮挡字卡（给 UI 做明暗区分） */
export function exposedIds(cards: Card[]): Set<number> {
  return new Set(cards.filter((c) => !isBlocked(c, cards)).map((c) => c.id));
}

export function waveTitle(wave: number): string {
  return wave === 0 ? '第一关 · 入门级' : '第二关 · 大师级';
}
