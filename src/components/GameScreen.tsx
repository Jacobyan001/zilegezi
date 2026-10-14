import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Board, { type FloatScore } from './Board';
import ResultModal from './ResultModal';
import {
  refillBottom,
  createWave,
  resolveMatch,
  exposedIds,
  waveTitle,
  type Card,
} from '../game/engine';
import { textToSyllables, numToChinese, isNoiseText } from '../lib/cn';
import { GRADES } from '../data/charPools';
import { useSpeechRecognizer, speak } from '../lib/speech';
import { playCorrect, playTap, playWin, playWrong, setSoundEnabled } from '../lib/sound';
import {
  addScore,
  addStar,
  consumeRetry,
  endRun,
  getDay,
  getSettings,
  getStars,
  grantRetry,
  type Settings,
} from '../lib/storage';

type Phase = 'ready' | 'playing' | 'paused' | 'over';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${`${s}`.padStart(2, '0')}`;
}

interface Toast {
  kind: 'good' | 'bad' | 'info';
  text: string;
  key: number;
}

export default function GameScreen({
  settings: initialSettings,
  onHome,
}: {
  settings: Settings;
  onHome: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [cards, setCards] = useState<Card[]>(() => createWave(initialSettings.grade, 0));
  const [wave, setWave] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [runScore, setRunScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [hearts, setHearts] = useState(initialSettings.hearts);
  const [timeLeft, setTimeLeft] = useState(initialSettings.minutes * 60);
  const [leavingIds, setLeavingIds] = useState<Set<number>>(new Set());
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [overReason, setOverReason] = useState<'time' | 'hearts'>('time');
  const [todayScore, setTodayScore] = useState(() => getDay().score);
  const [stars, setStars] = useState(getStars);
  const [micShake, setMicShake] = useState(false);
  const [heardText, setHeardText] = useState('');
  const [confettiKey, setConfettiKey] = useState(0);
  const [tapFallback, setTapFallback] = useState(false);
  const [retryBalance, setRetryBalance] = useState(getSettings().retryBalance);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  /** 正在播放消除动画、尚未从牌堆移除的字卡 id（防止动画窗口内重复消除/重复加分） */
  const leavingRef = useRef<Set<number>>(new Set());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const waveRef = useRef(wave);
  waveRef.current = wave;
  const scoreRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const floatId = useRef(1);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);

  const showToast = useCallback((kind: Toast['kind'], text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ kind, text, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const showBanner = useCallback((text: string) => {
    setBanner({ text, key: Date.now() });
    window.setTimeout(() => setBanner(null), 1600);
  }, []);

  const finish = useCallback(
    (reason: 'time' | 'hearts') => {
      if (phaseRef.current === 'over') return;
      phaseRef.current = 'over';
      setPhase('over');
      setOverReason(reason);
      stopRec();
      endRun(scoreRef.current);
      setRetryBalance(getSettings().retryBalance);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * 按住说话语义（识别会话常驻，按钮只做门控）：
   * - 只有按住按钮期间的识别结果才参与判定（家长在旁边说话不会误触）
   * - 按下时 flush 清空识别缓冲，上一个字的残留文本不会串进来
   * - 按住期间 interim 即时匹配，音一出口就消除
   * - 松开时若还没判定过，立刻用按住期间听到的最后文本做终判（对/错立见分晓），
   *   不必等云端端点检测——这是"松开立刻判定"的关键
   */
  const holdRef = useRef(false);
  const holdTextRef = useRef('');
  /** 本次按住期间是否已经出过分（消除/判错/被压提示都算） */
  const judgedRef = useRef(false);
  const [holding, setHolding] = useState(false);

  const handleHeard = useCallback(
    (primary: string, alts: string[], isFinal: boolean, force = false) => {
      if (phaseRef.current !== 'playing') return;
      if (!force && !holdRef.current) return; // 没按住按钮，忽略环境音
      if (primary) {
        setHeardText(primary);
        if (holdRef.current) holdTextRef.current = primary;
      }

      // 候选转写：去标点 + 数字串转中文读法（ASR 常把"十"转写成"10"）
      const candidates = [primary, ...alts].map((t) =>
        t
          .replace(/[\s，。！？、,.!?~～·…]/g, '')
          .replace(/\d+/g, (r) => numToChinese(Number(r))),
      );
      // 全是语气词/环境音（嗯、啊、um…）时只忽略，绝不判错
      const allNoise = candidates.length > 0 && candidates.every((t) => isNoiseText(t));

      const heardUnits: { syllables: Set<string>; toneKeys: Set<string> }[] = [];
      for (const clean of candidates) {
        if (!clean) continue;
        if (/[\u4e00-\u9fff]/.test(clean)) {
          // 含汉字：逐字转拼音，逐字尝试消除
          for (const ch of clean) {
            if (/[\u4e00-\u9fff]/.test(ch)) heardUnits.push(textToSyllables(ch));
          }
        } else {
          // 纯拉丁串（个别 ASR 直接返回拼音）：整体作为一个读音
          heardUnits.push(textToSyllables(clean));
        }
      }
      if (!heardUnits.some((h) => h.syllables.size > 0)) return; // 纯噪音，不扣机会

      const alive = cardsRef.current.filter((c) => !leavingRef.current.has(c.id));
      const strict = settingsRef.current.strictTone;
      const matchedAll: Card[] = [];
      let blocked: Card[] = [];
      for (const h of heardUnits) {
        const { matched, blockedHint } = resolveMatch(alive, h, strict);
        for (const m of matched) {
          if (!matchedAll.some((x) => x.id === m.id)) matchedAll.push(m);
        }
        if (matched.length === 0) blocked = blocked.concat(blockedHint);
      }

      if (matchedAll.length > 0) {
        judgedRef.current = true;
        eliminate(matchedAll);
      } else if ((isFinal || force) && !allNoise && !judgedRef.current) {
        // 判错三道闸：确认终稿/松手强制、不是纯语气词、本次按住还没罚过
        judgedRef.current = true;
        if (blocked.length > 0) {
          showToast('info', `「${blocked[0].info.char}」被上面的字卡压住啦，先读上面的字吧！`);
        } else {
          markWrong();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showToast],
  );

  const {
    supported,
    error,
    start: startRec,
    stop: stopRec,
    flush: flushRec,
  } = useSpeechRecognizer({
    onResult: ({ text, isFinal, alts }) =>
      handleHeard(
        text,
        alts.map((a) => a.transcript),
        isFinal,
      ),
  });

  /** 按下话筒：清空旧缓冲，开始采纳识别结果 */
  const pressMic = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    holdRef.current = true;
    holdTextRef.current = '';
    judgedRef.current = false;
    setHeardText('');
    setHolding(true);
    flushRec();
  }, [flushRec]);

  /** 松开会话：若本次还没出过判定，立刻用最后听到的文本终判 */
  const releaseMic = useCallback(() => {
    setHolding(false);
    if (!holdRef.current) return;
    holdRef.current = false;
    if (!judgedRef.current && holdTextRef.current) {
      handleHeard(holdTextRef.current, [], true, true);
    }
  }, [handleHeard]);

  const eliminate = useCallback(
    (matched: Card[]) => {
      // 过滤正在播放消除动画的卡，防止 interim 高频回调在动画窗口内重复计分
      const fresh = matched.filter((c) => !leavingRef.current.has(c.id));
      if (fresh.length === 0) return;
      const ids = new Set(fresh.map((c) => c.id));
      for (const id of ids) leavingRef.current.add(id);
      const gained = fresh.reduce((sum, c) => sum + c.info.strokes, 0);
      scoreRef.current += gained;
      setRunScore(scoreRef.current);
      setCorrect((v) => v + fresh.length);
      setTodayScore(addScore(gained, fresh.length).score);
      playCorrect(fresh.length);

      // 分数飘字
      const newFloats: FloatScore[] = fresh.map((c) => ({
        id: floatId.current++,
        x: c.x + (Math.random() * 14 - 7),
        y: c.y - 6,
        text: `+${c.info.strokes}`,
      }));
      if (fresh.length >= 3) {
        const cx = fresh.reduce((s, c) => s + c.x, 0) / fresh.length;
        const cy = fresh.reduce((s, c) => s + c.y, 0) / fresh.length;
        newFloats.push({
          id: floatId.current++,
          x: cx,
          y: cy - 26,
          text: `同音 ×${fresh.length}！`,
          combo: true,
        });
      }
      setFloats((fs) => [...fs, ...newFloats]);
      window.setTimeout(() => {
        setFloats((fs) => fs.filter((f) => !newFloats.some((n) => n.id === f.id)));
      }, 950);

      setLeavingIds((prev) => new Set([...prev, ...ids]));
      window.setTimeout(() => {
        setLeavingIds((prev) => {
          const n = new Set(prev);
          for (const id of ids) n.delete(id);
          return n;
        });
        for (const id of ids) leavingRef.current.delete(id);

        // 注意：不能把这些副作用放进 setCards 的 updater——
        // StrictMode 会双调 updater，导致 wave 连跳两关、createWave 执行两次
        const rest = cardsRef.current.filter((c) => !ids.has(c.id));
        if (phaseRef.current !== 'playing') {
          setCards(rest);
          return;
        }
        if (rest.length === 0) {
          // 通关：生成下一波（更难）
          const nw = waveRef.current + 1;
          waveRef.current = nw;
          setWave(nw);
          setCards(createWave(settingsRef.current.grade, nw));
          setConfettiKey((k) => k + 1);
          playWin();
          if (nw === 1) {
            showBanner('🎉 第一关通过！第二关来啦');
          } else {
            // 第二关整座山全部读完：挑战成功，奖励一颗汉字星
            const total = addStar();
            setStars(total);
            showBanner(`🏆 恭喜挑战成功！解锁汉字星 ⭐×${total}`);
          }
        } else if (waveRef.current >= 1 && rest.length < 55) {
          // 羊了个羊式：牌堆始终保持很深，每次消除后悄悄从底部补几张新卡，
          // 无横幅无音效——没有"一波一波"的感觉，山消不完
          const nw = waveRef.current + 1;
          waveRef.current = nw;
          setWave(nw);
          setCards(refillBottom(rest, settingsRef.current.grade, nw));
        } else {
          setCards(rest);
        }
      }, 430);
    },
    [showBanner, showToast],
  );

  const markWrong = useCallback(() => {
    playWrong();
    setMicShake(true);
    window.setTimeout(() => setMicShake(false), 520);
    showToast('bad', '没找到这个读音的字卡，再仔细看一看、读一读～');
    setHearts((h) => {
      const nh = h - 1;
      if (nh <= 0) {
        window.setTimeout(() => finish('hearts'), 250);
      }
      return Math.max(0, nh);
    });
  }, [finish, showToast]);

  // 倒计时
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = window.setInterval(() => {
      setTimeLeft((v) => {
        if (v <= 1) {
          window.clearInterval(t);
          finish('time');
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, finish]);

  const beginPlay = useCallback(() => {
    setPhase('playing');
    phaseRef.current = 'playing';
    startRec(); // 开局就启动常驻识别会话（启动成本只付这一次）
  }, [startRec]);

  const togglePause = useCallback(() => {
    playTap();
    holdRef.current = false;
    if (phaseRef.current === 'playing') {
      setPhase('paused');
      stopRec(); // 暂停时挂起识别会话
    } else if (phaseRef.current === 'paused') {
      setPhase('playing');
      phaseRef.current = 'playing';
      startRec();
    }
  }, [startRec, stopRec]);

  const resetRun = useCallback(
    (autostart: boolean) => {
      scoreRef.current = 0;
      waveRef.current = 0;
      const s = getSettings();
      setSettings(s);
      setCards(createWave(s.grade, 0));
      setWave(0);
      setRunScore(0);
      setCorrect(0);
      setHearts(s.hearts);
      setTimeLeft(s.minutes * 60);
      setLeavingIds(new Set());
      leavingRef.current = new Set();
      setFloats([]);
      setHeardText('');
      holdRef.current = false;
      setRetryBalance(s.retryBalance);
      setTodayScore(getDay().score);
      phaseRef.current = autostart ? 'playing' : 'ready';
      setPhase(autostart ? 'playing' : 'ready');
      showBanner(waveTitle(0));
      if (autostart) startRec();
    },
    [showBanner, startRec],
  );

  const handleRetry = useCallback(() => {
    if (consumeRetry()) {
      playTap();
      resetRun(true);
    }
  }, [resetRun]);

  const handleParentReward = useCallback(() => {
    const bal = grantRetry(1);
    setRetryBalance(bal);
    showToast('good', '家长已奖励 1 次重试机会！');
  }, [showToast]);

  const handleCardTap = useCallback(
    (c: Card) => {
      // 与渲染口径一致：动画中的 leaving 卡不算遮挡
      const isOpen = exposedIds(cardsRef.current.filter((x) => !leavingRef.current.has(x.id))).has(
        c.id,
      );
      if (!isOpen) {
        showToast('info', '它被压在下面啦，先消掉上面的字卡吧！');
        return;
      }
      speak(c.info.char);
      // 无麦克风兜底模式：点字卡 = 读对（连同所有同音字）
      if (tapFallback && phaseRef.current === 'playing') {
        const heard = { syllables: new Set(c.info.syllables), toneKeys: new Set(c.info.toneKeys) };
        const { matched } = resolveMatch(cardsRef.current, heard, false);
        if (matched.length) eliminate(matched);
      }
    },
    [eliminate, showToast, tapFallback],
  );

  // 正在播放消除动画的字卡不再遮挡其他卡——否则压它的卡已经在动画里消失了，
  // 下面的卡却还显示暗色、点不动（看起来就像"没被压却不可点"）
  const exposed = new Set<number>([
    ...exposedIds(cards.filter((c) => !leavingIds.has(c.id))),
    ...leavingIds,
  ]);
  const lowTime = timeLeft <= 10 && phase === 'playing';

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* HUD */}
      <div
        className="flex items-center gap-2 px-3"
        style={{ paddingTop: 'max(0.6rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={onHome}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-block active:translate-y-0.5"
          aria-label="返回首页"
        >
          🏠
        </button>
        <div className="flex flex-col items-center rounded-2xl bg-white px-3 py-1 shadow-block">
          <span className="font-kid text-[13px] leading-tight text-ink/70">{waveTitle(wave)}</span>
          <span className="text-[10px] leading-tight text-ink/45">
            今日 {todayScore} 分 · ⭐{stars}
          </span>
        </div>
        <div className="flex-1" />
        <div
          className={`rounded-2xl bg-white px-3 py-1.5 text-center font-kid text-lg shadow-block ${
            lowTime ? 'animate-pulse text-cinnabar' : ''
          }`}
        >
          ⏱ {formatTime(timeLeft)}
        </div>
        <div className="flex items-center gap-0.5 rounded-2xl bg-white px-2 py-2 shadow-block">
          {Array.from({ length: settings.hearts }).map((_, i) => (
            <span key={i} className="text-base leading-none">
              {i < hearts ? '❤️' : '🤍'}
            </span>
          ))}
        </div>
        <button
          onClick={togglePause}
          disabled={phase === 'ready' || phase === 'over'}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-lg shadow-block active:translate-y-0.5 disabled:opacity-40"
          aria-label="暂停"
        >
          {phase === 'paused' ? '▶️' : '⏸'}
        </button>
      </div>

      {/* 分数条 */}
      <div className="mt-2 flex items-center justify-center gap-2 px-4">
        <span className="rounded-full bg-cinnabar px-4 py-1 font-kid text-base text-white shadow-block">
          本局得分 {runScore}
        </span>
        <span className="rounded-full bg-jade px-3 py-1 text-xs font-bold text-white shadow-block">
          已读对 {correct} 字
        </span>
      </div>

      {/* 牌桌 */}
      <div className="relative flex flex-1 flex-col px-2">
        <Board
          cards={cards}
          exposed={exposed}
          leavingIds={leavingIds}
          showPinyin={settings.showPinyin}
          floats={floats}
          onCardTap={handleCardTap}
        />

        {/* 彩纸 */}
        {confettiKey > 0 && <Confetti key={confettiKey} />}

        {/* 波次横幅 */}
        {banner && (
          <div key={banner.key} className="pointer-events-none absolute inset-x-0 top-1/3 z-40 flex justify-center">
            <span className="animate-dropInCenter rounded-3xl bg-ink/80 px-6 py-3 font-kid text-xl text-paper shadow-block-lg">
              {banner.text}
            </span>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div key={toast.key} className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-6">
            <span
              className={`rounded-2xl px-4 py-2 text-center text-sm font-bold shadow-block-lg ${
                toast.kind === 'bad'
                  ? 'bg-cinnabar text-white'
                  : toast.kind === 'good'
                    ? 'bg-jade text-white'
                    : 'bg-white text-ink'
              }`}
            >
              {toast.text}
            </span>
          </div>
        )}
      </div>

      {/* 收音区：按住说话，松开判定 */}
      <div
        className="flex flex-col items-center gap-1.5 px-4 pb-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="h-6 text-sm font-bold text-ink/55">
          {phase === 'playing' && heardText ? (
            <span className="rounded-full bg-white/90 px-3 py-0.5 shadow-block">
              🎧 听到：{heardText}
            </span>
          ) : error ? (
            <span className="rounded-full bg-cinnabar/15 px-3 py-0.5 text-cinnabar">{error}</span>
          ) : (
            <span>
              {tapFallback
                ? '点字卡模式：点一张字卡就能消除'
                : '大声读出最上面的汉字，同音字一起消！'}
            </span>
          )}
        </div>
        <div className={micShake ? 'animate-shake' : ''}>
          {phase === 'ready' ? (
            <button
              onClick={beginPlay}
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-cinnabar text-4xl text-white shadow-block-lg active:translate-y-1"
            >
              🎤
            </button>
          ) : tapFallback || !supported ? (
            <button
              onClick={togglePause}
              disabled={phase === 'over'}
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-cinnabar text-4xl text-white shadow-block-lg active:translate-y-1 disabled:opacity-50"
            >
              {phase === 'paused' ? '▶️' : '⏸'}
            </button>
          ) : (
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                playTap();
                pressMic();
              }}
              onPointerUp={releaseMic}
              onPointerCancel={releaseMic}
              onContextMenu={(e) => e.preventDefault()}
              disabled={phase !== 'playing'}
              className={`relative flex h-20 w-20 touch-none select-none items-center justify-center rounded-full text-4xl text-white shadow-block-lg transition-transform disabled:opacity-50 ${
                holding ? 'scale-110 bg-jade' : 'bg-cinnabar active:translate-y-1'
              }`}
              aria-label="按住读字"
            >
              {holding && (
                <>
                  <span className="absolute inset-0 animate-ring rounded-full bg-jade/50" />
                  <span
                    className="absolute inset-0 animate-ring rounded-full bg-jade/30"
                    style={{ animationDelay: '0.5s' }}
                  />
                </>
              )}
              <span className="relative">{holding ? '🎤' : '🎙️'}</span>
            </button>
          )}
        </div>
        <div className="h-5 text-xs text-ink/45">
          {phase === 'ready'
            ? '点麦克风开始 · 点字卡可以听它的发音'
            : tapFallback || !supported
              ? '点上面的字卡就能消除'
              : holding
                ? '正在听…读完就松开'
                : phase === 'paused'
                  ? '已暂停'
                  : '按住按钮读字，松开立刻判定'}
        </div>
      </div>

      {/* 开始遮罩 */}
      {phase === 'ready' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 px-8 backdrop-blur-[2px]">
          <div className="w-full max-w-xs animate-dropInCenter rounded-[28px] bg-paper p-6 text-center shadow-block-lg">
            <div className="font-kid text-3xl text-cinnabar">{waveTitle(0)}</div>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              字卡一层层叠着，先读<strong className="text-cinnabar">没有被压住</strong>的字。
              <strong className="text-cinnabar">按住🎤按钮读字，松开立刻判定</strong>。
              第一关要把每个字都读完；第二关起同音字一起消除！一个字几画就得几分。
            </p>
            <div className="mt-3 rounded-2xl bg-white p-3 text-left text-xs text-ink/60 shadow-block">
              <div>📚 当前字库：{GRADES.find((g) => g.id === settings.grade)?.name}</div>
              <div>⏱ 时长 {settings.minutes} 分钟 · ❤️ 容错 {settings.hearts} 次</div>
              <div>🔁 重试机会剩余 {settings.retryBalance} 次</div>
            </div>
            {!supported && (
              <p className="mt-3 rounded-2xl bg-cinnabar/10 px-3 py-2 text-xs text-cinnabar">
                本设备浏览器不支持语音识别，可以用点字卡模式体验
              </p>
            )}
            <button
              onClick={beginPlay}
              className="mt-3 w-full rounded-2xl bg-cinnabar px-4 py-3.5 font-kid text-xl text-white shadow-block active:translate-y-0.5"
            >
              {tapFallback ? '开始挑战（点字卡）' : '开始挑战 🎤'}
            </button>
            {!tapFallback && (
              <button
                onClick={() => {
                  playTap();
                  setTapFallback(true);
                }}
                className="mt-2 text-xs text-ink/45 underline underline-offset-2"
              >
                没有麦克风？用点字卡模式也能玩
              </button>
            )}
            <button onClick={onHome} className="mt-2 block w-full text-sm text-ink/45">
              先不玩了，回首页
            </button>
          </div>
        </div>
      )}

      {/* 暂停遮罩 */}
      {phase === 'paused' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/45 px-8 backdrop-blur-[2px]">
          <div className="w-full max-w-xs animate-dropInCenter rounded-[28px] bg-paper p-6 text-center shadow-block-lg">
            <div className="font-kid text-2xl">暂停中</div>
            <button
              onClick={togglePause}
              className="mt-4 w-full rounded-2xl bg-jade px-4 py-3 font-kid text-xl text-white shadow-block active:translate-y-0.5"
            >
              继续读 ▶
            </button>
            <button
              onClick={onHome}
              className="mt-2 w-full rounded-2xl bg-white px-4 py-2.5 font-kid text-ink/70 shadow-block active:translate-y-0.5"
            >
              结束本局回首页
            </button>
          </div>
        </div>
      )}

      {/* 结算 */}
      {phase === 'over' && (
        <ResultModal
          reason={overReason}
          score={runScore}
          correct={correct}
          todayScore={todayScore}
          retryBalance={retryBalance}
          onRetry={handleRetry}
          onParentReward={handleParentReward}
          onHome={onHome}
        />
      )}
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 18 });
  const colors = ['#e85d3f', '#3aa17e', '#f6b93b', '#5aa7e0', '#9b7ede'];
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      {pieces.map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * 130;
        return (
          <span
            key={i}
            className="absolute h-3 w-3 animate-confetti rounded-[3px]"
            style={
              {
                background: colors[i % colors.length],
                '--cx': `${Math.cos(angle) * dist}px`,
                '--cy': `${Math.sin(angle) * dist}px`,
                transform: `rotate(${Math.random() * 360}deg)`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
