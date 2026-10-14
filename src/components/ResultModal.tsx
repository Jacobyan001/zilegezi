import { useState } from 'react';
import ParentGate from './ParentGate';

export default function ResultModal({
  reason,
  score,
  correct,
  todayScore,
  retryBalance,
  onRetry,
  onParentReward,
  onHome,
}: {
  reason: 'time' | 'hearts';
  score: number;
  correct: number;
  todayScore: number;
  retryBalance: number;
  onRetry: () => void;
  onParentReward: () => void;
  onHome: () => void;
}) {
  const [gateOpen, setGateOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-sm animate-dropInCenter rounded-[28px] bg-paper p-6 text-center shadow-block-lg">
        <div className="text-5xl">{reason === 'time' ? '⏰' : '💪'}</div>
        <div className="mt-2 font-kid text-2xl text-cinnabar">
          {reason === 'time' ? '时间到！' : '机会用完啦！'}
        </div>
        <p className="mt-1 text-sm text-ink/60">
          {reason === 'time' ? '今天也读得很响亮～' : '没关系，多读几遍就会啦！'}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white p-3 shadow-block">
            <div className="font-kid text-2xl text-cinnabar">{score}</div>
            <div className="text-[11px] text-ink/55">本局得分</div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-block">
            <div className="font-kid text-2xl text-jade">{correct}</div>
            <div className="text-[11px] text-ink/55">读对字数</div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-block">
            <div className="font-kid text-2xl text-sky">{todayScore}</div>
            <div className="text-[11px] text-ink/55">今日总分</div>
          </div>
        </div>

        <button
          onClick={onRetry}
          disabled={retryBalance <= 0}
          className="mt-5 w-full rounded-2xl bg-cinnabar px-4 py-3.5 font-kid text-xl text-white shadow-block active:translate-y-0.5 disabled:opacity-40"
        >
          再来一局 🔁
        </button>
        <div className="mt-1 text-xs text-ink/50">
          {retryBalance > 0 ? `将消耗 1 次重试机会，剩余 ${retryBalance} 次` : '今天的重试机会用完啦'}
        </div>

        {retryBalance <= 0 && (
          <button
            onClick={() => setGateOpen(true)}
            className="mt-3 w-full rounded-2xl bg-sun px-4 py-2.5 font-kid text-white shadow-block active:translate-y-0.5"
          >
            🏅 我完成了家务/作业，请家长奖励
          </button>
        )}

        <button
          onClick={onHome}
          className="mt-2 w-full rounded-2xl bg-white px-4 py-2.5 font-kid text-ink/70 shadow-block active:translate-y-0.5"
        >
          回首页
        </button>
      </div>

      {gateOpen && (
        <ParentGate
          onPass={() => {
            setGateOpen(false);
            onParentReward();
          }}
          onCancel={() => setGateOpen(false)}
          title="家长验证"
          desc="完成家务或作业后，通过验证即可奖励 1 次重试机会"
        />
      )}
    </div>
  );
}
