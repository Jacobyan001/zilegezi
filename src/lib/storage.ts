/**
 * 本地存储：家长设置、每日总分记录、重试次数余额
 */
import type { GradeId } from '../data/charPools';

const KEY = 'zilegezi:v1';

export interface Settings {
  grade: GradeId;
  /** 每次挑战时长（分钟） */
  minutes: number;
  /** 每局容错次数（读错不扣分机会） */
  hearts: number;
  /** 重试次数余额（失败后再来一局消耗，家长可奖励） */
  retryBalance: number;
  /** 拼音提示 */
  showPinyin: boolean;
  /** 严格声调判定 */
  strictTone: boolean;
  /** 音效开关 */
  sound: boolean;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  score: number;
  correct: number;
  runs: number;
  bestRun: number;
}

interface PersistShape {
  settings: Settings;
  days: Record<string, DayRecord>;
  /** 汉字星总数（第二关全部读完的挑战成功奖励） */
  stars: number;
}

export const DEFAULT_SETTINGS: Settings = {
  grade: 'kg',
  minutes: 3,
  hearts: 3,
  retryBalance: 3,
  showPinyin: true,
  strictTone: false,
  sound: true,
};

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function load(): PersistShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistShape>;
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        days: parsed.days ?? {},
        stars: parsed.stars ?? 0,
      };
    }
  } catch {
    /* ignore */
  }
  return { settings: { ...DEFAULT_SETTINGS }, days: {}, stars: 0 };
}

let cache: PersistShape | null = null;
function state(): PersistShape {
  if (!cache) cache = load();
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state()));
  } catch {
    /* ignore */
  }
}

export function getSettings(): Settings {
  return { ...state().settings };
}

export function saveSettings(patch: Partial<Settings>): Settings {
  Object.assign(state().settings, patch);
  persist();
  return getSettings();
}

export function getDay(date = todayStr()): DayRecord {
  const d = state().days[date];
  return d ? { ...d } : { date, score: 0, correct: 0, runs: 0, bestRun: 0 };
}

/** 游戏过程中实时累计当日总分 */
export function addScore(points: number, correctDelta: number): DayRecord {
  const t = todayStr();
  const days = state().days;
  const cur = days[t] ?? { date: t, score: 0, correct: 0, runs: 0, bestRun: 0 };
  cur.score += points;
  cur.correct += correctDelta;
  days[t] = cur;
  persist();
  return { ...cur };
}

/** 一局结束：记录局数与单局最佳 */
export function endRun(runScore: number): DayRecord {
  const t = todayStr();
  const days = state().days;
  const cur = days[t] ?? { date: t, score: 0, correct: 0, runs: 0, bestRun: 0 };
  cur.runs += 1;
  cur.bestRun = Math.max(cur.bestRun, runScore);
  days[t] = cur;
  persist();
  return { ...cur };
}

/** 消耗一次重试机会 */
export function consumeRetry(): boolean {
  const s = state().settings;
  if (s.retryBalance <= 0) return false;
  s.retryBalance -= 1;
  persist();
  return true;
}

/** 家长奖励：完成家务/作业后增加重试次数 */
export function grantRetry(n = 1): number {
  const s = state().settings;
  s.retryBalance += n;
  persist();
  return s.retryBalance;
}

/** 汉字星：第二关全部读完的挑战成功奖励 */
export function getStars(): number {
  return state().stars;
}

export function addStar(n = 1): number {
  state().stars += n;
  persist();
  return state().stars;
}

/** 最近 N 天记录（含今天，不足补零不返回） */
export function recentDays(n: number): DayRecord[] {
  const out: DayRecord[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(getDay(todayStr(d)));
  }
  return out;
}

/** 清除全部本地数据（家长中心使用） */
export function resetAllData() {
  cache = { settings: { ...DEFAULT_SETTINGS }, days: {}, stars: 0 };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  persist();
}
