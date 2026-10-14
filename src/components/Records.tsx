import { recentDays } from '../lib/storage';

export default function Records({ onBack }: { onBack: () => void }) {
  const week = recentDays(7);
  const month = recentDays(30);
  const maxScore = Math.max(1, ...week.map((d) => d.score));
  const total = month.reduce((s, d) => s + d.score, 0);
  const activeDays = month.filter((d) => d.score > 0).length;
  const best = month.reduce((m, d) => Math.max(m, d.score), 0);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

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
        <h1 className="font-kid text-2xl">每日战绩</h1>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-block">
          <div className="font-kid text-2xl text-cinnabar">{total}</div>
          <div className="text-[11px] text-ink/55">近30天总分</div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-block">
          <div className="font-kid text-2xl text-jade">{activeDays}</div>
          <div className="text-[11px] text-ink/55">坚持天数</div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-block">
          <div className="font-kid text-2xl text-sky">{best}</div>
          <div className="text-[11px] text-ink/55">单日最高</div>
        </div>
      </div>

      {/* 近 7 天柱状图 */}
      <section className="mt-5 rounded-[26px] bg-white p-4 shadow-block">
        <h2 className="font-kid text-lg">最近 7 天</h2>
        <div className="mt-4 flex h-40 items-end justify-between gap-2">
          {week.map((d) => {
            const date = new Date(d.date);
            const isToday = [...week].pop()?.date === d.date;
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-ink/55">{d.score > 0 ? d.score : ''}</span>
                <div
                  className={`w-full rounded-t-xl ${isToday ? 'bg-cinnabar' : 'bg-cinnabar/35'}`}
                  style={{ height: `${Math.max(d.score > 0 ? 6 : 2, (d.score / maxScore) * 110)}px` }}
                />
                <span className="text-[11px] text-ink/55">周{weekdays[date.getDay()]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 近 30 天列表 */}
      <section className="mt-5 rounded-[26px] bg-white p-4 shadow-block">
        <h2 className="font-kid text-lg">30 天明细</h2>
        <ul className="mt-2 divide-y divide-ink/5">
          {[...month].reverse().map((d) => (
            <li key={d.date} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ink/70">
                {d.date}
                {d.date === week[week.length - 1]?.date && (
                  <span className="ml-2 rounded-full bg-cinnabar/10 px-2 py-0.5 text-[10px] font-bold text-cinnabar">
                    今天
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 text-ink/55">
                <span>{d.correct} 字</span>
                <span className="font-kid text-base text-cinnabar">{d.score} 分</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
