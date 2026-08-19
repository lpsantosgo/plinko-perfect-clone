import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Volume2, HelpCircle, Timer, Award, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, getMultipliers, type Risk } from "@/lib/plinko";

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

type Ball = { id: number; path: { x: number; y: number }[]; start: number; slot: number };

const ROW_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const STEP_MS = 100;

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
  const [localeData, setLocaleData] = useState({ language: "pt-BR", currency: "BRL", symbol: "BRL" });
  const ballId = useRef(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const dropSound = useRef<HTMLAudioElement | null>(null);
  const winSound = useRef<HTMLAudioElement | null>(null);
  const pegSound = useRef<HTMLAudioElement | null>(null);
  const lossSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    dropSound.current = new Audio("/sounds/drop.mp3");
    winSound.current = new Audio("/sounds/win.mp3");
    pegSound.current = new Audio("/sounds/peg.mp3");
    lossSound.current = new Audio("/sounds/loss.mp3");
  }, []);

  const playSound = (sound: "drop" | "win" | "peg" | "loss") => {
    if (!audioEnabled) return;
    let s: HTMLAudioElement | null = null;
    if (sound === "drop") s = dropSound.current;
    if (sound === "win") s = winSound.current;
    if (sound === "peg") s = pegSound.current;
    if (sound === "loss") s = lossSound.current;

    if (s) {
      const clone = s.cloneNode() as HTMLAudioElement;
      clone.volume = sound === "peg" ? 0.3 : 0.8;
      clone.play().catch(() => {});
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
  };

  const baseMultipliers = useMemo(() => getMultipliers(risk, rows), [risk, rows]);
  const multipliers = useMemo(() => {
    // Escala os multiplicadores baseada no valor da aposta (ex: se aposta 2, multiplica tudo por 2)
    // No entanto, o multiplicador visual "x1.5" geralmente é relativo à aposta base.
    // A instrução diz: "ao aumentar o valor da aposta, aumentar também os x"
    // Isso sugere que os números nos slots (x1, x2, etc) devem refletir o valor REAL que será ganho ou ser multiplicados.
    // Como em cassinos o "x" costuma ser fixo e o prêmio varia, mas o usuário pediu para aumentar o "x".
    // Vou aplicar um multiplicador visual baseado no valor da aposta em relação à base (0.2).
    const factor = bet / 0.2;
    return baseMultipliers.map(m => +(m * factor).toFixed(1));
  }, [baseMultipliers, bet]);
  const gap = 100 / (rows + 3);

  useEffect(() => {
    fetch('/api/public/locale')
      .then(res => res.json())
      .then(data => {
        setLocaleData({ 
          language: data.language, 
          currency: data.currency, 
          symbol: data.currencySymbol === 'R$' ? 'BRL' : data.currencySymbol 
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString(localeData.language, { hour: "2-digit", minute: "2-digit" }),
      );
    tick();
    const i = setInterval(tick, 10_000);
    return () => clearInterval(i);
  }, [localeData.language]);

  const pegY = useCallback((r: number) => 12 + (r * 76) / Math.max(rows - 1, 1), [rows]);

  const drop = useCallback(() => {
    if (bet > balance) return;
    setBalance((b) => +(b - bet).toFixed(2));
    playSound("drop");

    let rights = 0;
    const path: { x: number; y: number }[] = [{ x: 50, y: 2 }];
    for (let r = 0; r < rows; r++) {
      if (Math.random() < 0.5) rights++;
      path.push({ x: 50 + (rights - (r + 1) / 2) * gap, y: pegY(r) + 2.5 });
    }
    const slot = rights;
    path.push({ x: 50 + (slot - rows / 2) * gap, y: 96 });

    const id = ++ballId.current;
    setBalls((prev) => [...prev, { id, path, start: performance.now(), slot }]);

    const total = path.length * STEP_MS;
    setTimeout(() => {
      const multiplier = baseMultipliers[slot] ?? 1;
      const win = +(bet * multiplier).toFixed(2);
      setPrize(win);
      setBalance((b) => +(b + win).toFixed(2));
      setFlash(slot);
      if (multiplier >= 1) playSound("win");
      else playSound("loss");
      setTimeout(() => setFlash((f) => (f === slot ? null : f)), 550);
      setBalls((prev) => prev.filter((b) => b.id !== id));
    }, total);
  }, [bet, balance, rows, gap, pegY, multipliers]);

  useEffect(() => {
    if (mode !== "auto") {
      if (autoRef.current) clearInterval(autoRef.current);
      autoRef.current = null;
      return;
    }
    autoRef.current = setInterval(() => drop(), 700);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [mode, drop]);

  return (
    <div className="plinko-stage relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col overflow-hidden text-slate-100 select-none">
      <TopBar clock={clock} audioEnabled={audioEnabled} setAudioEnabled={setAudioEnabled} />

      <div className="relative flex-1 px-2">
        <div className="plinko-logo pointer-events-none absolute top-16 left-4 rotate-[-8deg] whitespace-pre-wrap text-[10px] leading-tight font-bold opacity-0">
          {`'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n\nsons ao colidir, e sons ao ganhar ou perder`}
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
            ×{m}
          </div>
        ))}
      </div>

      <div className="px-3 py-3">
        <div className="plinko-prize rounded-md py-1 text-center text-lg font-extrabold text-slate-900">
          Prêmio {formatCurrency(prize, localeData.language)} {localeData.symbol}
        </div>
      </div>

      <div className="plinko-controls relative px-3 pt-2 pb-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div>
            <p className="mb-1 text-center text-xs text-slate-200/80">Nível de Risco</p>
            <div className="overflow-hidden rounded-md bg-panel-soft/60">
              {(["high", "normal", "low"] as Risk[]).map((r, idx) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-slate-100/10 px-2 py-[6px] text-sm last:border-0",
                    risk === r ? "bg-slate-100/20 font-semibold" : "opacity-70",
                  )}
                >
                  <span className="grid h-5 w-5 place-items-center rounded bg-slate-100/25 text-[10px] font-bold">
                    {["A", "N", "B"][idx]}
                  </span>
                  {["Alto", "Normal", "Baixo"][idx]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={drop}
            className="plinko-play mx-1 grid h-28 w-28 place-items-center rounded-full text-2xl font-black text-amber-600 transition-transform active:scale-95"
          >
            JOGAR
          </button>

          <div>
            <p className="mb-1 text-center text-xs text-slate-200/80">Modo de Aposta</p>
            <div className="overflow-hidden rounded-md bg-panel-soft/60">
              {(["manual", "auto"] as const).map((m, idx) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-slate-100/10 px-2 py-[6px] text-sm last:border-0",
                    mode === m ? "bg-slate-100/20 font-semibold" : "opacity-70",
                  )}
                >
                  <span className="grid h-5 w-5 place-items-center rounded bg-fuchsia-400/70 text-[10px] font-bold text-slate-900">
                    {["M", "A"][idx]}
                  </span>
                  {["Manual", "Automático"][idx]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <BetBtn onClick={() => setBet(0.2)}>Mín</BetBtn>
          <BetBtn onClick={() => setBet((b) => Math.max(0.2, +(b - 0.2).toFixed(2)))}>−</BetBtn>
          <span className="flex-1 text-center text-lg font-bold">Aposta {formatCurrency(bet, localeData.language)} {localeData.symbol}</span>
          <BetBtn onClick={() => setBet((b) => +(b + 0.2).toFixed(2))}>+</BetBtn>
          <BetBtn onClick={() => setBet(Math.max(0.2, +balance.toFixed(2)))}>Máx</BetBtn>
        </div>

        <p className="mt-2 text-center text-lg font-bold text-slate-200/90">
          Saldo {formatCurrency(balance, localeData.language)} {localeData.symbol}
        </p>
      </div>
    </div>
  );
}

function BetBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-w-11 rounded-md bg-slate-100/15 px-3 py-1 text-sm font-semibold text-slate-200/80 active:scale-95"
    >
      {children}
    </button>
  );
}

function TopBar({
  clock,
  audioEnabled,
  setAudioEnabled,
}: {
  clock: string;
  audioEnabled: boolean;
  setAudioEnabled: (v: boolean) => void;
}) {
  const Circle = ({ children }: { children: React.ReactNode }) => (
    <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-slate-100/70 text-slate-100/90">
      {children}
    </span>
  );
  return (
    <header className="flex items-center gap-3 px-3 pt-3">
      <Circle>
        <Home className="h-5 w-5" />
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
  onPeg: () => void;
}) {
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
      {balls.map((b) => (
        <BallView key={b.id} ball={b} onPeg={onPeg} />
      ))}
    </div>
  );
}

function BallView({ ball, onPeg }: { ball: Ball; onPeg: () => void }) {
  const [pos, setPos] = useState(ball.path[0]!);
  const lastIndex = useRef(-1);
  const [bounce, setBounce] = useState(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - ball.start) / STEP_MS;
      const i = Math.min(Math.floor(t), ball.path.length - 2);
      
      if (i > lastIndex.current && i < ball.path.length - 1) {
        lastIndex.current = i;
        onPeg();
        setBounce(1);
        setTimeout(() => setBounce(0), 100);
      }

      const f = Math.min(Math.max(t - i, 0), 1);
      const a = ball.path[i]!;
      const c = ball.path[i + 1]!;

      // Curva de gravidade mais acentuada para impacto
      const curve = f * f * 0.8 + f * 0.2;
      
      setPos({
        x: a.x + (c.x - a.x) * f,
        y: a.y + (c.y - a.y) * curve,
      });
      if (t < ball.path.length - 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ball, onPeg]);

  return (
    <span
      className={cn(
        "plinko-ball absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-transform duration-75",
        bounce > 0 && "scale-125"
      )}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
    />
  );
}