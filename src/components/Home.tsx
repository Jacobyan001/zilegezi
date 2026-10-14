import { useState } from 'react';
import { GRADES } from '../data/charPools';
import { getDay, getStars, type Settings } from '../lib/storage';
import { playTap } from '../lib/sound';
import { Modal } from './ui';
import ParentGate from './ParentGate';

function LogoMark() {
  return (
    <div className="relative mx-auto h-36 w-44">
      <div className="absolute left-2 top-0 h-24 w-24 rotate-[-10deg] rounded-3xl bg-sky/80 shadow-card" />
      <span className="absolute left-2 top-1 flex h-24 w-24 rotate-[-10deg] items-center justify-center font-kai text-5xl text-white/90">
        汉
      </span>
      <div className="absolute right-3 top-4 h-24 w-24 rotate-[8deg] rounded-3xl bg-jade/85 shadow-card" />
      <span className="absolute right-3 top-5 flex h-24 w-24 rotate-[8deg] items-center justify-center font-kai text-5xl text-white/90">
        字
      </span>
      <div className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 rounded-3xl bg-cinnabar shadow-card-deep" />
      <span className="absolute bottom-1 left-1/2 flex h-24 w-24 -translate-x-1/2 items-center justify-center font-kai text-5xl text-white">
        字
      </span>
    </div>
  );
}

export default function Home({
  settings,
  onStart,
  onOpenParent,
  onOpenRecords,
}: {
  settings: Settings;
  onStart: () => void;
  onOpenParent: () => void;
  onOpenRecords: () => void;
}) {
  const [gateOpen, setGateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const today = getDay();
  const gradeMeta = GRADES.find((g) => g.id === settings.grade)!;

  return (
    <div
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            playTap();
            setHelpOpen(true);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-block active:translate-y-0.5"
          aria-label="玩法说明"
        >
          ❓
        </button>
        <div className="flex gap-1.5">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-sun shadow-block">
            ⭐ ×{getStars()}
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink/60 shadow-block">
            🔁 重试 ×{settings.retryBalance}
          </span>
        </div>
        <button
          onClick={() => {
            playTap();
            setGateOpen(true);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-block active:translate-y-0.5"
          aria-label="家长中心"
        >
          ⚙️
        </button>
      </div>

      <div className="mt-6 text-center">
        <LogoMark />
        <h1 className="mt-4 font-kid text-5xl tracking-wide text-cinnabar drop-shadow-sm">字了个字</h1>
        <p className="mt-2 font-kid text-base text-ink/60">大声读汉字，一读就消除！</p>
      </div>

      {/* 今日战绩 */}
      <div className="mt-6 rounded-[26px] bg-white p-4 shadow-block">
        <div className="flex items-center justify-between px-1">
          <span className="font-kid text-lg">🏆 今日战绩</span>
          <button onClick={onOpenRecords} className="text-xs font-bold text-sky active:opacity-60">
            查看每日记录 ›
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-cinnabar/10 py-3">
            <div className="font-kid text-3xl text-cinnabar">{today.score}</div>
            <div className="text-[11px] text-ink/55">今日总分</div>
          </div>
          <div className="rounded-2xl bg-jade/10 py-3">
            <div className="font-kid text-3xl text-jade">{today.correct}</div>
            <div className="text-[11px] text-ink/55">读对字数</div>
          </div>
          <div className="rounded-2xl bg-sky/10 py-3">
            <div className="font-kid text-3xl text-sky">{today.bestRun}</div>
            <div className="text-[11px] text-ink/55">单局最高</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex-1">
        <button
          onClick={onStart}
          className="group relative w-full overflow-hidden rounded-[28px] bg-cinnabar px-6 py-6 text-white shadow-block-lg active:translate-y-1"
        >
          <span className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/10" />
          <span className="absolute -bottom-10 -left-4 h-24 w-24 rounded-full bg-white/10" />
          <span className="relative block font-kid text-3xl">开始挑战 🎤</span>
          <span className="relative mt-1 block text-sm text-white/85">
            {gradeMeta.emoji} {gradeMeta.name}字库 · {settings.minutes} 分钟 · ❤️ ×{settings.hearts}
          </span>
        </button>

        <div className="mt-3 flex gap-3">
          <button
            onClick={() => {
              playTap();
              setGateOpen(true);
            }}
            className="flex-1 rounded-2xl bg-white px-4 py-3 font-kid text-base shadow-block active:translate-y-0.5"
          >
            👨‍👩‍👧 家长中心
          </button>
          <button
            onClick={onOpenRecords}
            className="flex-1 rounded-2xl bg-white px-4 py-3 font-kid text-base shadow-block active:translate-y-0.5"
          >
            📅 每日记录
          </button>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-ink/40">
          第一关很简单，第二关很难——读对最上面的字，
          <br />
          同音字一起消，一个字几画就得几分！
        </p>
      </div>

      {gateOpen && (
        <ParentGate
          onPass={() => {
            setGateOpen(false);
            onOpenParent();
          }}
          onCancel={() => setGateOpen(false)}
        />
      )}

      {helpOpen && (
        <Modal onClose={() => setHelpOpen(false)}>
          <h2 className="pr-8 font-kid text-2xl text-cinnabar">怎么玩？</h2>
          <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink/75">
            <li className="flex gap-2">
              <span className="text-lg">1️⃣</span>
              <span>字卡像积木一样层层叠着，只能读<strong>没有被压住</strong>的字卡。</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lg">2️⃣</span>
              <span>对着麦克风大声读出汉字。读对了，画面里所有<strong>同音的字卡一起消除</strong>（四 / 寺 / 似 读 sì 都能消）。</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lg">3️⃣</span>
              <span><strong>一个字几画就得几分</strong>：三画的字 3 分，十画的字 10 分。</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lg">4️⃣</span>
              <span>第一关热身，第二关突然变难；越往下，新字卡笔画越多，还会冒出更高年级的字。<strong>把第二关的大山全部读完，就能解锁一颗汉字星</strong> ⭐！</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lg">5️⃣</span>
              <span>读错会扣一颗 ❤️；点一下字卡可以<strong>听它的正确发音</strong>跟读。</span>
            </li>
            <li className="flex gap-2">
              <span className="text-lg">6️⃣</span>
              <span>每天总分自动记录。重试机会用完后，<strong>完成家务、写完作业</strong>可以让家长奖励新机会。</span>
            </li>
          </ol>
        </Modal>
      )}
    </div>
  );
}
