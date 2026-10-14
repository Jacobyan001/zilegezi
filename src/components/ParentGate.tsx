import { useMemo, useState } from 'react';

/** 家长门槛：两位数加减法（孩子不易通过） */
export default function ParentGate({
  onPass,
  onCancel,
  title = '家长中心',
  desc = '请完成一道计算题，确认是家长在操作',
}: {
  onPass: () => void;
  onCancel: () => void;
  title?: string;
  desc?: string;
}) {
  const quiz = useMemo(() => {
    const a = 12 + Math.floor(Math.random() * 60);
    const b = 11 + Math.floor(Math.random() * 40);
    const plus = Math.random() > 0.4;
    return {
      a,
      b,
      op: plus ? '+' : '-',
      answer: plus ? a + b : a - b,
    };
  }, []);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    if (Number(value) === quiz.answer) {
      onPass();
    } else {
      setWrong(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-xs animate-dropInCenter rounded-[28px] bg-paper p-6 text-center shadow-block-lg">
        <div className="text-4xl">🔒</div>
        <div className="mt-1 font-kid text-xl">{title}</div>
        <p className="mt-1 text-xs text-ink/55">{desc}</p>
        <div className="mt-4 font-kid text-3xl">
          {quiz.a} {quiz.op} {quiz.b} = ?
        </div>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          autoFocus
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className={`mt-4 w-full rounded-2xl border-2 bg-white px-4 py-3 text-center font-kid text-2xl shadow-block outline-none ${
            wrong ? 'border-cinnabar' : 'border-transparent'
          } focus:border-jade`}
          placeholder="答案"
        />
        {wrong && <div className="mt-2 text-sm text-cinnabar">答案不对，再算一算～</div>}
        <button
          onClick={submit}
          className="mt-4 w-full rounded-2xl bg-jade px-4 py-3 font-kid text-lg text-white shadow-block active:translate-y-0.5"
        >
          确认
        </button>
        <button onClick={onCancel} className="mt-2 text-sm text-ink/45">
          取消
        </button>
      </div>
    </div>
  );
}
