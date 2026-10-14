import { useCallback, useEffect, useRef, useState } from 'react';

export interface SpeechAlt {
  transcript: string;
  confidence: number;
}

export interface SpeechResultPayload {
  text: string;
  isFinal: boolean;
  /** 全部候选（首选在第一位） */
  alts: SpeechAlt[];
}

interface RecognizerOptions {
  onResult: (payload: SpeechResultPayload) => void;
}

// ---- Web Speech API 类型（webkit 前缀） ----
interface SRAlt {
  transcript: string;
  confidence: number;
}
interface SRResult {
  isFinal: boolean;
  length: number;
  [index: number]: SRAlt;
}
interface SRResultList {
  length: number;
  [index: number]: SRResult;
}
interface SREvent extends Event {
  resultIndex: number;
  results: SRResultList;
}
interface SRErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRConstructor = new () => SpeechRecognitionLike;

function getCtor(): SRConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as SRConstructor) ?? (w.webkitSpeechRecognition as SRConstructor) ?? null;
}

/**
 * 常驻语音识别器：一局游戏期间保持同一个会话（启动只需一次，
 * 规避国内网络下每次重新 start() 都要 1~3 秒的问题）。
 * - onend 自动重启保活
 * - flush() 废弃当前会话并立即重建，清空识别缓冲（配合"按住说话"防串字）
 * - 是否采纳结果由调用方根据"是否按住按钮"自行门控
 */
export function useSpeechRecognizer({ onResult }: RecognizerOptions) {
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListenRef = useRef(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    wantListenRef.current = true;
    if (recRef.current) return; // 会话已存在，直接复用
    const rec = new Ctor();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      setListening(true);
      setError('');
    };
    rec.onresult = (e: SREvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const alts: SpeechAlt[] = [];
        for (let j = 0; j < r.length; j++) {
          alts.push({ transcript: r[j].transcript, confidence: r[j].confidence });
        }
        if (alts.length > 0) {
          onResultRef.current({ text: alts[0].transcript, isFinal: r.isFinal, alts });
        }
      }
    };
    rec.onerror = (e: SRErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListenRef.current = false;
        setListening(false);
        setError('麦克风被拒绝了，请在浏览器设置里允许，或改用点字卡模式');
      } else if (e.error === 'network') {
        setError('语音识别网络不佳，可以试试 Edge 浏览器');
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      // 保活：还想听就立刻换一个新实例续上
      if (wantListenRef.current) {
        window.setTimeout(() => {
          if (wantListenRef.current) start();
        }, 120);
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* noop */
    }
  }, []);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    const rec = recRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    }
    setListening(false);
  }, []);

  /** 清空识别缓冲：废弃当前会话，靠 onend 保活逻辑立刻重建一个干净会话 */
  const flush = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onend = null; // 不让旧会话自己重启，这里手动重建，避免竞态
    recRef.current = null;
    try {
      rec.abort();
    } catch {
      /* noop */
    }
    setListening(false);
    if (wantListenRef.current) {
      window.setTimeout(() => {
        if (wantListenRef.current && !recRef.current) start();
      }, 0);
    }
  }, [start]);

  useEffect(
    () => () => {
      wantListenRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* noop */
      }
    },
    [],
  );

  return { start, stop, flush, listening, error, supported: getCtor() !== null };
}

export function speechSupported(): boolean {
  return getCtor() !== null;
}

/** 朗读文本（TTS），用于"点字卡跟读" */
export function speak(text: string, rate = 0.85) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = rate;
  window.speechSynthesis.speak(u);
}
