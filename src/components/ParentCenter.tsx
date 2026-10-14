import { useState } from 'react';
import { GRADES, type GradeId } from '../data/charPools';
import {
  getDay,
  getSettings,
  grantRetry,
  resetAllData,
  saveSettings,
  type Settings,
} from '../lib/storage';
import { playTap, playWin } from '../lib/sound';
import { Stepper, Toggle } from './ui';

const DURATIONS = [1, 2, 3, 5, 8, 10];

export default function ParentCenter({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const [s, setS] = useState<Settings>(() => getSettings());
  const [today, setToday] = useState(() => getDay());
  const [confirmReset, setConfirmReset] = useState(false);
  const [rewardFlash, setRewardFlash] = useState('');

  const update = (patch: Partial<Settings>) => {
    playTap();
    const next = saveSettings(patch);
    setS(next);
    onChanged();
  };

  const reward = (label: string) => {
    playWin();
    const bal = grantRetry(1);
    setS((v) => ({ ...v, retryBalance: bal }));
    onChanged();
    setRewardFlash(label);
    window.setTimeout(() => setRewardFlash(''), 1800);
  };

  return (
    <div
      className="mx-auto min-h-[100dvh] w-full max-w-md px-5 pb-10"
      style={{ paddingTop: 'max(1.2rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-block active:translate-y-0.5"
        >
          ‹
        </button>
        <h1 className="font-kid text-2xl">家长中心</h1>
      </div>

      {/* 难度字库 */}
      <section className="mt-5">
        <h2 className="mb-2 font-kid text-lg">📚 难度 · 分级字库</h2>
        <div className="grid grid-cols-2 gap-2">
          {GRADES.map((g) => {
            const active = s.grade === g.id;
            return (
              <button
                key={g.id}
                onClick={() => update({ grade: g.id as GradeId })}
                className={`rounded-2xl border-2 p-3 text-left shadow-block transition-colors ${
                  active ? 'border-cinnabar bg-cinnabar/10' : 'border-transparent bg-white'
                }`}
              >
                <span className="font-kid text-base">
                  {g.emoji} {g.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-ink/50">{g.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-ink/45">
          随关卡推进，新补上来的字卡笔画会更多，第二关起还会出现下一个年级字库里的字。
        </p>
      </section>

      {/* 时长 */}
      <section className="mt-5">
        <h2 className="mb-2 font-kid text-lg">⏱ 每次挑战时长</h2>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => update({ minutes: d })}
              className={`rounded-full px-4 py-2 font-kid text-base shadow-block active:translate-y-0.5 ${
                s.minutes === d ? 'bg-cinnabar text-white' : 'bg-white text-ink/70'
              }`}
            >
              {d} 分钟
            </button>
          ))}
        </div>
      </section>

      {/* 容错与重试 */}
      <section className="mt-5 rounded-[26px] bg-white p-4 shadow-block">
        <h2 className="font-kid text-lg">❤️ 容错次数</h2>
        <p className="mt-0.5 text-[11px] text-ink/50">一局里读错多少次后结束（读被压住的字不扣次数）</p>
        <div className="mt-2">
          <Stepper value={s.hearts} min={1} max={6} suffix="次" onChange={(v) => update({ hearts: v })} />
        </div>

        <h2 className="mt-5 font-kid text-lg">🔁 重试机会</h2>
        <p className="mt-0.5 text-[11px] text-ink/50">挑战失败后"再来一局"消耗 1 次，可随时手动调整</p>
        <div className="mt-2">
          <Stepper
            value={s.retryBalance}
            min={0}
            max={99}
            suffix="次"
            onChange={(v) => update({ retryBalance: v })}
          />
        </div>

        <h2 className="mt-5 font-kid text-lg">🏅 家长奖励（+1 次重试）</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => reward('已奖励：完成家务 +1')}
            className="rounded-2xl bg-sun px-3 py-3 font-kid text-white shadow-block active:translate-y-0.5"
          >
            🧹 完成了家务
          </button>
          <button
            onClick={() => reward('已奖励：写完作业 +1')}
            className="rounded-2xl bg-jade px-3 py-3 font-kid text-white shadow-block active:translate-y-0.5"
          >
            📝 写完了作业
          </button>
        </div>
        {rewardFlash && (
          <div className="mt-2 rounded-xl bg-jade/10 px-3 py-2 text-center text-sm font-bold text-jade">
            {rewardFlash}，当前共 {s.retryBalance} 次
          </div>
        )}
      </section>

      {/* 语音与提示 */}
      <section className="mt-5 space-y-2">
        <h2 className="mb-1 font-kid text-lg">🎤 语音与提示</h2>
        <Toggle
          label="拼音提示"
          desc="在字卡上显示拼音，适合刚开始认字"
          checked={s.showPinyin}
          onChange={(v) => update({ showPinyin: v })}
        />
        <Toggle
          label="严格声调"
          desc="开启后声调读错不算对（默认只看声母韵母）"
          checked={s.strictTone}
          onChange={(v) => update({ strictTone: v })}
        />
        <Toggle
          label="游戏音效"
          desc="消除、过关、错误提示音"
          checked={s.sound}
          onChange={(v) => update({ sound: v })}
        />
      </section>

      {/* 今日数据 */}
      <section className="mt-5 rounded-[26px] bg-white p-4 text-sm shadow-block">
        <h2 className="font-kid text-lg">📊 今日数据</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="font-kid text-2xl text-cinnabar">{today.score}</div>
            <div className="text-[11px] text-ink/50">总分</div>
          </div>
          <div>
            <div className="font-kid text-2xl text-jade">{today.correct}</div>
            <div className="text-[11px] text-ink/50">读对字数</div>
          </div>
          <div>
            <div className="font-kid text-2xl text-sky">{today.runs}</div>
            <div className="text-[11px] text-ink/50">挑战局数</div>
          </div>
        </div>
        {!confirmReset ? (
          <button
            onClick={() => {
              playTap();
              setConfirmReset(true);
            }}
            className="mt-4 w-full rounded-2xl bg-paperdeep px-4 py-2.5 text-sm text-ink/55 active:translate-y-0.5"
          >
            清除全部设置与战绩记录
          </button>
        ) : (
          <div className="mt-4 rounded-2xl bg-cinnabar/10 p-3 text-center">
            <p className="text-sm text-cinnabar">确定清除？此操作不可恢复</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  resetAllData();
                  setS(getSettings());
                  setToday(getDay());
                  onChanged();
                  setConfirmReset(false);
                }}
                className="flex-1 rounded-xl bg-cinnabar py-2 text-sm font-bold text-white"
              >
                确定清除
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-xl bg-white py-2 text-sm font-bold text-ink/70"
              >
                再想想
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
