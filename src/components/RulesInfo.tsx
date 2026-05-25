import React from 'react';
import { Award, CheckCircle, HelpCircle, ShieldAlert } from 'lucide-react';

export default function RulesInfo() {
  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2.25rem] p-6 backdrop-blur-md shadow-[0_0_35px_rgba(245,158,11,0.05)] relative overflow-hidden" id="rules-card">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
      
      <div className="flex items-center gap-3.5 mb-4 z-10 relative">
        <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <Award className="w-5 h-5 shrink-0" />
        </div>
        <div>
          <h2 className="text-lg font-sans font-black tracking-tight text-slate-100 uppercase">System Punktacji</h2>
          <p className="text-[10px] text-slate-400 font-mono tracking-wider">ZASADY ROZLICZANIA TYPÓW</p>
        </div>
      </div>

      <p className="text-slate-400 text-xs leading-relaxed mb-6 z-10 relative max-w-2xl">
        Rywalizuj ze znajomymi typując dokładne wyniki meczów. Punkty są naliczane automatycznie po zakończeniu meczu i zatwierdzeniu wyniku przez administratora.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 z-10 relative">
        <div className="flex items-start gap-3 p-4 bg-slate-950/30 border border-slate-800/80 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono font-black text-sm shrink-0 border border-emerald-500/20 shadow-sm">
            3
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide font-sans">Dokładny Wynik</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Wytypowałeś np. <span className="text-emerald-400 font-bold font-mono">2 - 1</span> i mecz zakończył się wynikiem <span className="text-emerald-400 font-bold font-mono">2 - 1</span>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-slate-950/30 border border-slate-800/80 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-mono font-black text-sm shrink-0 border border-sky-500/20 shadow-sm">
            1
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide font-sans">Rezultat</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-sans">
              Wytypowałeś np. <span className="text-sky-400 font-bold font-mono">1 - 0</span> (wygrana A) a mecz skończył się <span className="text-sky-400 font-bold font-mono">3 - 1</span>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-slate-950/30 border border-slate-800/80 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-mono font-black text-sm shrink-0 border border-rose-500/20 shadow-sm">
            0
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wide font-sans">Inny kierunek</h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Błędny kierunek zwycięstwa lub brak zapisanego typu przed pierwszym gwizdkiem arbitra.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/15 text-[11px] text-slate-400 z-10 relative flex items-start gap-3 leading-relaxed">
        <ShieldAlert className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-500 uppercase tracking-wider font-bold">Blokada Typowania:</strong> Typowanie każdego meczu jest możliwe <span className="text-slate-100 font-semibold font-sans">wyłącznie do momentu jego planowanego rozpoczęcia</span>. Po pierwszym gwizdku typy grupy zostaną opublikowane dla przejrzystości rozgrywek.
        </div>
      </div>
    </div>
  );
}
