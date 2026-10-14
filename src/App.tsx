import { useCallback, useState } from 'react';
import Home from './components/Home';
import GameScreen from './components/GameScreen';
import ParentCenter from './components/ParentCenter';
import Records from './components/Records';
import { getSettings, type Settings } from './lib/storage';
import { setSoundEnabled } from './lib/sound';

type View = 'home' | 'game' | 'parent' | 'records';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [settings, setSettings] = useState<Settings>(() => {
    const s = getSettings();
    setSoundEnabled(s.sound);
    return s;
  });
  // 每次从首页进入游戏时拿到最新设置
  const [gameKey, setGameKey] = useState(0);

  const refreshSettings = useCallback(() => {
    const s = getSettings();
    setSoundEnabled(s.sound);
    setSettings(s);
  }, []);

  const startGame = useCallback(() => {
    refreshSettings();
    setGameKey((k) => k + 1);
    setView('game');
  }, [refreshSettings]);

  return (
    <div className="paper-bg min-h-full text-ink">
      {view === 'home' && (
        <Home
          settings={settings}
          onStart={startGame}
          onOpenParent={() => setView('parent')}
          onOpenRecords={() => setView('records')}
        />
      )}
      {view === 'game' && <GameScreen key={gameKey} settings={settings} onHome={() => setView('home')} />}
      {view === 'parent' && (
        <ParentCenter onBack={() => setView('home')} onChanged={refreshSettings} />
      )}
      {view === 'records' && <Records onBack={() => setView('home')} />}
    </div>
  );
}
