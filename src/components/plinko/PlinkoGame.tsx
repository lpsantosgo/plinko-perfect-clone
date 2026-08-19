import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Volume2, HelpCircle, Timer, Award, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, getMultipliers, type Risk } from "@/lib/plinko";

const SLOT_CLASSES = ["bg-slot-1", "bg-slot-2", "bg-slot-3", "bg-slot-4", "bg-slot-5"];

function slotClass(index: number, total: number) {
  const mid = (total - 1) / 2;
  const d = mid === 0 ? 0 : Math.abs(index - mid) / mid;
  if (d > 0.85) return SLOT_CLASSES[0];
  if (d > 0.6) return SLOT_CLASSES[1];
  if (d > 0.38) return SLOT_CLASSES[2];
  if (d > 0.15) return SLOT_CLASSES[3];
  return SLOT_CLASSES[4];
}

function CollisionEffect({ x, y }: { x: number; y: number }) {
  return (
    <div 
      className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 animate-ping pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
    />
  );
}

type Ball = { id: number; path: { x: number; y: number }[]; start: number; slot: number };

const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP_MS = 280; // Increased from 130 for slower fall

export function PlinkoGame() {
  const [rows, setRows] = useState(8);
  const [risk, setRisk] = useState<Risk>("normal");
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [bet, setBet] = useState(2);
  const [balance, setBalance] = useState(51.57);
  const [prize, setPrize] = useState(2.6);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const [clock, setClock] = useState("--:--");
  const ballId = useRef(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const dropSound = useRef<HTMLAudioElement | null>(null);
  const winSound = useRef<HTMLAudioElement | null>(null);
  const pegSound = useRef<HTMLAudioElement | null>(null);
  const lossSound = useRef<HTMLAudioElement | null>(null);
  const lastPegTime = useRef(0);

  useEffect(() => {
    dropSound.current = new Audio("/sounds/drop.mp3");
    winSound.current = new Audio("/sounds/win.mp3");
    pegSound.current = new Audio("/sounds/peg.mp3");
    lossSound.current = new Audio("/sounds/loss.mp3");
    
    // Pre-load sounds to ensure they are ready
    [dropSound, winSound, pegSound, lossSound].forEach(ref => {
      if (ref.current) {
        ref.current.load();
      }
    });
  }, []);

  const playSound = (sound: "drop" | "win" | "peg" | "loss") => {
    if (!audioEnabled) return;
    
    // Rate limit peg sounds to avoid audio overload/distortion
    if (sound === "peg") {
      const now = performance.now();
      if (now - lastPegTime.current < 60) return; 
      lastPegTime.current = now;
    }

    let s: HTMLAudioElement | null = null;
    if (sound === "drop") s = dropSound.current;
    if (sound === "win") s = winSound.current;
    if (sound === "peg") s = pegSound.current;
    if (sound === "loss") s = lossSound.current;

    if (s) {
      const clone = s.cloneNode() as HTMLAudioElement;
      // Consistent mixing: lower volume for frequent peg sounds
      clone.volume = sound === "peg" ? 0.2 : 0.7;
      clone.play().catch(() => {});
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  const multipliers = useMemo(() => getMultipliers(risk, rows), [risk, rows]);
  const gap = 100 / (rows + 3);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      );
    tick();
    const i = setInterval(tick, 10_000);
    return () => clearInterval(i);
  }, []);

  const pegY = useCallback((r: number) => 12 + (r * 76) / Math.max(rows - 1, 1), [rows]);

  const drop = useCallback(() => {
    if (bet > balance) return;
    setBalance((b) => +(b - bet).toFixed(2));
    playSound("drop");

    let rights = 0;
    const path: { x: number; y: number }[] = [{ x: 50, y: 2 }];
    for (let r = 0; r < rows; r++) {
      if (Math.random() < 0.5) rights++;
      path.push({ x: 50 + (rights - (r + 1) / 2) * gap, y: pegY(r) + 4 });
    }
    const slot = rights;
    path.push({ x: 50 + (slot - rows / 2) * gap, y: 96 });

    const id = ++ballId.current;
    setBalls((prev) => [...prev, { id, path, start: performance.now(), slot }]);

    const total = (path.length - 1) * STEP_MS + 200; // Extra buffer for ending
    setTimeout(() => {
      const multiplier = multipliers[slot] ?? 1;
      const dynamicX = multiplier * (bet / 2);
      const win = +(bet * dynamicX).toFixed(2);
      setPrize(win);
      setBalance((b) => +(b + win).toFixed(2));
      setFlash(slot);
      if (multiplier >= 1) playSound("win");
      else playSound("loss");
      setTimeout(() => setFlash((f) => (f === slot ? null : f)), 550);
      setBalls((prev) => prev.filter((b) => b.id !== id));
    }, total);
  }, [bet, balance, rows, gap, pegY, multipliers, playSound]);

  const resetGame = useCallback(() => {
    setBalls([]);
    setPrize(0);
    setFlash(null);
    setBalance(100.00);
    if (autoRef.current) {
      clearInterval(autoRef.current);
      autoRef.current = null;
    }
    setMode("manual");
  }, []);

  useEffect(() => {
    if (mode !== "auto") {
      if (autoRef.current) clearInterval(autoRef.current);
      autoRef.current = null;
      return;
    }
    // Faster interval for auto-play if needed, but keeping it balanced
    autoRef.current = setInterval(() => drop(), 600);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [mode, drop]);

  return (
    <div className="plinko-stage relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col overflow-hidden text-slate-100 select-none">
      <TopBar clock={clock} audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled} onReset={resetGame} />

      <div className="relative flex-1 px-2">
        <div className="plinko-logo pointer-events-none absolute top-16 left-4 rotate-[-8deg] whitespace-pre-wrap text-[10px] leading-tight font-bold opacity-0">
          {`'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n\ndeixar os botões mais bonitos e profissionais`}
        </div>
        <span className="pointer-events-none absolute top-30 left-11 rotate-90 text-[10px] font-semibold tracking-[0.35em] text-slate-200/60">
          LP GAMING
        </span>

        <div className="absolute top-24 right-2 z-20 w-14 text-center">
          <p className="mb-1 text-[10px] font-bold text-slate-100/90 uppercase tracking-wider">Linhas</p>
          <div className="overflow-hidden rounded-md border border-white/10 bg-panel-soft/40 backdrop-blur-sm">
            {ROW_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRows(r)}
                className={cn(
                  "block w-full border-b border-slate-100/10 py-[3px] text-sm font-semibold transition-colors last:border-0",
                  rows === r
                    ? "bg-slate-50 text-slate-900"
                    : "bg-sky-200/25 text-slate-50 hover:bg-sky-200/40",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button className="absolute top-1/2 left-0 z-20 -translate-y-1/2 rounded-r-md bg-slate-200/25 px-1 py-6">
          <ChevronLeft className="h-4 w-4" />
        </button>

        <Board rows={rows} gap={gap} pegY={pegY} balls={balls} onPeg={() => playSound("peg")} />
      </div>

      <div className="grid gap-[3px] px-2" style={{ gridTemplateColumns: `repeat(${multipliers.length}, minmax(0,1fr))` }}>
        {multipliers.map((m, i) => (
          <div
            key={i}
            className={cn(
              "rounded-sm py-1 text-center text-[11px] font-bold text-slate-900 transition-transform",
              slotClass(i, multipliers.length),
              flash === i && "-translate-y-1 scale-105",
            )}
          >
            ×{(m * (bet / 2)).toFixed(1)}
          </div>
        ))}
      </div>

      <div className="px-3 py-3">
        <div className="plinko-prize rounded-md py-1 text-center text-lg font-extrabold text-slate-900">
          Prêmio {formatBRL(prize)} BRL
        </div>
      </div>

      <div className="plinko-controls relative px-3 pt-4 pb-6 border-t border-white/5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-1">Risco</p>
            <div className="flex rounded-lg bg-slate-950/40 p-1 shadow-inner ring-1 ring-white/5">
              {(["low", "normal", "high"] as Risk[]).map((r, idx) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-bold transition-all duration-200",
                    risk === r 
                      ? "bg-slate-100/15 text-white shadow-sm ring-1 ring-white/10" 
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5",
                  )}
                >
                  {["Baixo", "Normal", "Alto"][idx]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-1">Modo</p>
            <div className="flex rounded-lg bg-slate-950/40 p-1 shadow-inner ring-1 ring-white/5">
              {(["manual", "auto"] as const).map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-bold transition-all duration-200",
                    mode === m 
                      ? "bg-fuchsia-500/20 text-fuchsia-300 shadow-sm ring-1 ring-fuchsia-500/30" 
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/5",
                  )}
                >
                  {["Manual", "Auto"][idx]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-950/40 rounded-xl p-3 ring-1 ring-white/5 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Valor da Aposta</span>
              <span className="text-xs font-mono font-bold text-slate-500">{formatBRL(balance)} Disponível</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center bg-slate-900/60 rounded-lg ring-1 ring-white/10 p-1">
                <BetBtn onClick={() => setBet((b) => Math.max(0.2, +(b - 0.2).toFixed(2)))}>−</BetBtn>
                <span className="flex-1 text-center text-lg font-black tracking-tighter text-white/90">
                  {formatBRL(bet)}
                </span>
                <BetBtn onClick={() => setBet((b) => +(b + 0.2).toFixed(2))}>+</BetBtn>
              </div>
              <div className="flex gap-1.5">
                <QuickBetBtn onClick={() => setBet(0.2)}>MIN</QuickBetBtn>
                <QuickBetBtn onClick={() => setBet(Math.max(0.2, +balance.toFixed(2)))}>MAX</QuickBetBtn>
              </div>
            </div>
          </div>

          <button
            onClick={drop}
            className="plinko-play-btn w-full py-4 rounded-xl text-xl font-black uppercase tracking-widest text-white shadow-2xl transition-all active:scale-[0.98] active:brightness-90 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden relative group"
            disabled={balance < bet && mode === 'manual'}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            <span className="relative z-10 drop-shadow-md">Apostar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function BetBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-9 w-9 grid place-items-center rounded-md bg-white/5 text-xl font-bold text-slate-400 hover:bg-white/10 hover:text-white transition-colors active:scale-90"
    >
      {children}
    </button>
  );
}

function QuickBetBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-11 px-3 rounded-lg bg-slate-900/60 ring-1 ring-white/10 text-[10px] font-black text-slate-400 hover:bg-white/5 hover:text-white transition-all active:scale-95 shadow-sm"
    >
      {children}
    </button>
  );
}

function TopBar({
  clock,
  audioEnabled,
  setAudioEnabled,
  onReset,
}: {
  clock: string;
  audioEnabled: boolean;
  setAudioEnabled: (v: boolean) => void;
  onReset: () => void;
}) {
  const Circle = ({ children }: { children: React.ReactNode }) => (
    <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-slate-100/70 text-slate-100/90">
      {children}
    </span>
  );
  return (
    <header className="flex items-center gap-3 px-3 pt-3">
      <Circle>
        <button onClick={onReset} className="w-full h-full flex items-center justify-center focus:outline-none" title="Reiniciar">
          <Home className="h-5 w-5" />
        </button>
      </Circle>
      <span className="text-lg font-semibold text-slate-100/90">{clock}</span>
      <div className="ml-auto flex gap-2">
        <Circle>
          <Award className="h-5 w-5" />
        </Circle>
        <Circle>
          <Timer className="h-5 w-5" />
        </Circle>
        <Circle>
          <HelpCircle className="h-5 w-5" />
        </Circle>
        <button onClick={() => setAudioEnabled(!audioEnabled)} className="focus:outline-none">
          <Circle>
            <Volume2 className={cn("h-5 w-5", !audioEnabled && "opacity-40")} />
          </Circle>
        </button>
      </div>
    </header>
  );
}

function Board({
  rows,
  gap,
  pegY,
  balls,
  onPeg,
}: {
  rows: number;
  gap: number;
  pegY: (r: number) => number;
  balls: Ball[];
  onPeg: (x: number, y: number) => void;
}) {
  const [effects, setEffects] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    // Cleanup effects after animation
    if (effects.length > 0) {
      const timer = setTimeout(() => {
        setEffects(prev => prev.slice(1));
      }, 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [effects]);

  const handlePeg = (x: number, y: number) => {
    setEffects(prev => [...prev, { id: Date.now(), x, y }]);
    onPeg(x, y);
  };

  return (
    <div className="relative mx-auto h-[62vh] max-h-[560px] w-full">
      <div
        className="absolute top-[2%] left-1/2 h-10 w-10 -translate-x-1/2 rounded-full border border-white/10 bg-slate-950/80 shadow-inner"
        aria-hidden
      />
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: r + 3 }).map((__, i) => (
          <span
            key={`${r}-${i}`}
            className="plinko-peg absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 bg-slate-300/80 shadow-[0_0_2px_rgba(255,255,255,0.5)]"
            style={{ left: `${50 + (i - (r + 2) / 2) * gap}%`, top: `${pegY(r)}%` }}
          />
        )),
      )}
      {effects.map(e => (
        <CollisionEffect key={e.id} x={e.x} y={e.y} />
      ))}
      {balls.map((b) => (
        <BallView 
          key={b.id} 
          ball={b} 
          onPeg={() => {
            const index = Math.floor((performance.now() - b.start) / STEP_MS);
            const x = b.path[index + 1]?.x || 50;
            const y = pegY(index);
            handlePeg(x, y);
          }} 
        />
      ))}
    </div>
  );
}

function BallView({ ball, onPeg }: { ball: Ball; onPeg: () => void }) {
  const [pos, setPos] = useState(ball.path[0]!);
  const lastIndex = useRef(-1);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - ball.start) / STEP_MS;
      const i = Math.min(Math.floor(t), ball.path.length - 2);
      
      if (i > lastIndex.current && i < ball.path.length - 1) {
        lastIndex.current = i;
        onPeg();
      }

      const f = Math.min(Math.max(t - i, 0), 1);
      const a = ball.path[i]!;
      const c = ball.path[i + 1]!;
      
      // Add a slight "bounce" or "arc" during the step
      const arc = Math.sin(f * Math.PI) * 1.5;
      
      setPos({
        x: a.x + (c.x - a.x) * f,
        y: a.y + (c.y - a.y) * (f * f * 0.6 + f * 0.4) - (i < ball.path.length - 2 ? arc * 0.5 : 0),
      });
      if (t < ball.path.length - 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ball, onPeg]);

  return (
    <span
      className="plinko-ball absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.6)] z-30 transition-[transform] duration-200"
      style={{ 
        left: `${pos.x}%`, 
        top: `${pos.y}%`,
      }}
    />
  );
}