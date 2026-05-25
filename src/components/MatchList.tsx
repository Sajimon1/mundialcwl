import React, { useState } from 'react';
import { Match, Prediction } from '../types';
import { Calendar, Save, CheckCircle, Clock, Search, Filter, ShieldAlert } from 'lucide-react';

interface MatchListProps {
  matches: Match[];
  predictions: Prediction[];
  currentUserId: string | null;
  onSavePrediction: (matchId: string, predA: number, predB: number) => Promise<void>;
  customAlert: (msg: string, title?: string) => Promise<void>;
}

export default function MatchList({ matches, predictions, currentUserId, onSavePrediction, customAlert }: MatchListProps) {
  const [filter, setFilter] = useState<"all" | "predictable" | "live" | "finished">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [localPreds, setLocalPreds] = useState<{ [matchId: string]: { scoreA: string; scoreB: string } }>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Synchronize initial values to state from loaded props
  const getPredictionForMatch = (matchId: string) => {
    return predictions.find(p => p.matchId === matchId);
  };

  const handleScoreChange = (matchId: string, team: 'A' | 'B', val: string) => {
    // Only allow whole positive integers or empty string representable in inputs
    if (val !== "" && !/^\d+$/.test(val)) return;
    
    setLocalPreds(prev => {
      const matchPred = prev[matchId] || {
        scoreA: getPredictionForMatch(matchId)?.predictedA?.toString() || "",
        scoreB: getPredictionForMatch(matchId)?.predictedB?.toString() || ""
      };
      return {
        ...prev,
        [matchId]: {
          ...matchPred,
          [team === 'A' ? 'scoreA' : 'scoreB']: val
        }
      };
    });
  };

  const handleSave = async (matchId: string) => {
    const pA = localPreds[matchId]?.scoreA ?? getPredictionForMatch(matchId)?.predictedA?.toString() ?? "";
    const pB = localPreds[matchId]?.scoreB ?? getPredictionForMatch(matchId)?.predictedB?.toString() ?? "";

    if (pA === "" || pB === "") {
      await customAlert("Wpisz obie prognozy bramkowe przed zapisem!", "Brak wyników");
      return;
    }

    try {
      setSavingId(matchId);
      await onSavePrediction(matchId, parseInt(pA), parseInt(pB));
      // Remove local copy since it is saved in Firebase and props updated
      setLocalPreds(prev => {
        const copy = { ...prev };
        delete copy[matchId];
        return copy;
      });
      await customAlert("Twój typ został pomyślnie zapisany!", "Typ zapisany!");
    } catch (e) {
      console.error(e);
      await customAlert("Nie udało się zapisać typu! Sprawdź czy mecz się już nie rozpoczął.", "Błąd");
    } finally {
      setSavingId(null);
    }
  };

  // Filter and search logic
  const filteredMatches = matches
    .filter(match => {
      if (filter === "predictable") return match.status === "scheduled";
      if (filter === "live") return match.status === "live";
      if (filter === "finished") return match.status === "finished";
      return true;
    })
    .filter(match => {
      const q = searchQuery.toLowerCase();
      return (
        match.teamA.toLowerCase().includes(q) ||
        match.teamB.toLowerCase().includes(q) ||
        match.group.toLowerCase().includes(q)
      );
    })
    // Sort scheduled first, sorted by date
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Formatting date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('pl-PL', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4" id="match-list-view">
      {/* Search & Filters */}
      <div className="bg-slate-900/50 border border-slate-800/85 rounded-[2.25rem] p-4 backdrop-blur-md shadow-[0_0_20px_rgba(30,58,138,0.08)] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Szukaj spotkania, grupy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border-2 border-slate-850 rounded-2xl py-2.5 pl-10 pr-4 text-slate-100 text-sm focus:outline-hidden focus:border-indigo-500 font-semibold placeholder:text-slate-600 transition"
          />
        </div>

        {/* Filters Tabs */}
        <div className="flex gap-1 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-850 shrink-0 w-full md:w-auto">
          {(["all", "predictable", "live", "finished"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`flex-1 md:flex-none text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition ${
                filter === t
                  ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
            >
              {t === "all" ? "Wszystkie" : t === "predictable" ? "Do typowania" : t === "live" ? "Na żywo" : "Zakończone"}
            </button>
          ))}
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-[2.25rem] p-16 text-center text-slate-500 text-xs font-black font-mono tracking-wider uppercase">
          BRAK SPOTKAŃ SPEŁNIAJĄCYCH KRYTERIA WYBORU.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredMatches.map(match => {
            const pred = getPredictionForMatch(match.id);
            const isFinished = match.status === "finished";
            const isLive = match.status === "live";
            const locked = match.status !== "scheduled";

            // Local input status
            const currentA = localPreds[match.id]?.scoreA ?? pred?.predictedA?.toString() ?? "";
            const currentB = localPreds[match.id]?.scoreB ?? pred?.predictedB?.toString() ?? "";
            const isDirty = (localPreds[match.id]?.scoreA !== undefined || localPreds[match.id]?.scoreB !== undefined) &&
                            (currentA !== pred?.predictedA?.toString() || currentB !== pred?.predictedB?.toString());

            return (
              <div 
                key={match.id}
                className={`bg-slate-900/50 border rounded-3xl p-5 shadow-sm flex flex-col justify-between transition-all relative overflow-hidden ${
                  isLive 
                    ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]" 
                    : locked 
                    ? "border-slate-800/80 opacity-[0.92]" 
                    : "border-slate-800 hover:border-slate-700/80 hover:shadow-[0_0_25px_rgba(99,102,241,0.05)]"
                }`}
              >
                {/* Real-time blinker marker for live games */}
                {isLive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-650 via-rose-500 to-red-650 animate-pulse" />
                )}

                <div>
                  {/* Header info */}
                  <div className="flex items-center justify-between text-[10px] font-mono mb-4 text-slate-500 select-none">
                    <span className="uppercase text-indigo-400 font-extrabold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">{match.group}</span>
                    <div className="flex items-center gap-1.5">
                      {isLive ? (
                        <div className="flex items-center gap-1 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full border border-red-500/20 font-black tracking-widest uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          NA ŻYWO
                        </div>
                      ) : isFinished ? (
                        <span className="bg-slate-950/80 text-slate-400 px-2.5 py-1 rounded-full border border-slate-800/80 font-black tracking-wider uppercase">ZAKOŃCZONY</span>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-black tracking-wider uppercase">
                          <Clock className="w-3 h-3 text-emerald-400" />
                          DO TYPOWANIA
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-4 bg-slate-950/40 p-2.5 rounded-2xl border border-slate-850">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatDate(match.date)}</span>
                  </div>

                  {/* Teams Representation & Inputs */}
                  <div className="flex items-center justify-between gap-1.5 p-3 bg-slate-950/30 border border-slate-800/80 rounded-2xl mb-4">
                    {/* Team A name */}
                    <div className="w-5/12 font-bold text-slate-200 text-sm text-right truncate">
                      {match.teamA}
                    </div>

                    {/* Score / Inputs block */}
                    <div className="flex items-center gap-2 justify-center w-2/12 shrink-0">
                      {locked ? (
                        /* Disabled result display if match locked */
                        <div className="font-mono font-black text-sm text-slate-200 bg-slate-950 border border-slate-800 shrink-0 px-3 py-1.5 rounded-xl flex items-center justify-center min-w-[70px] shadow-inner select-none">
                          {match.scoreA !== undefined ? `${match.scoreA} - ${match.scoreB}` : "TBD"}
                        </div>
                      ) : (
                        /* Inputs for Prediction */
                        <div className="flex items-center gap-1 text-slate-100 font-mono">
                          <input
                            type="text"
                            maxLength={2}
                            value={currentA}
                            onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                            disabled={!currentUserId}
                            placeholder="?"
                            className="bg-slate-950 border-2 border-slate-800 rounded-xl w-11 h-11 text-center font-black font-mono text-base focus:outline-hidden focus:border-indigo-500 text-indigo-400 disabled:opacity-50 transition shadow-inner"
                          />
                          <span className="text-slate-600 font-black text-sm">:</span>
                          <input
                            type="text"
                            maxLength={2}
                            value={currentB}
                            onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                            disabled={!currentUserId}
                            placeholder="?"
                            className="bg-slate-950 border-2 border-slate-800 rounded-xl w-11 h-11 text-center font-black font-mono text-base focus:outline-hidden focus:border-indigo-500 text-indigo-400 disabled:opacity-50 transition shadow-inner"
                          />
                        </div>
                      )}
                    </div>

                    {/* Team B name */}
                    <div className="w-5/12 font-bold text-slate-200 text-sm text-left truncate">
                      {match.teamB}
                    </div>
                  </div>
                </div>

                {/* Footer Section: Prediction status & Points */}
                <div className="mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between min-h-12">
                  <div className="text-xs">
                    {pred ? (
                      <div>
                        {locked ? (
                          <div className="text-slate-400 shrink-0 text-[11px] font-medium">
                            Twój typ: <span className="font-black text-indigo-400 font-mono bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1 rounded-lg">
                              {pred.predictedA} - {pred.predictedB}
                            </span>
                          </div>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" /> typ zapisany
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-650 font-mono text-[11px] font-bold uppercase tracking-wider">Brak typu</span>
                    )}

                    {/* Display Points Awarded */}
                    {isFinished && pred && pred.pointsEarned !== undefined && (
                      <div className="mt-2">
                        <span className={`inline-block py-1 px-3 rounded-full text-[10px] font-black font-mono shadow-inner border tracking-widest uppercase ${
                          pred.pointsEarned === 3 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-emerald-950/20" 
                            : pred.pointsEarned === 1 
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/25 shadow-sky-950/15" 
                            : "bg-slate-950 text-slate-500 border-slate-800/60"
                        }`}>
                          +{pred.pointsEarned} {pred.pointsEarned === 1 ? "punkt" : pred.pointsEarned === 3 ? "punkty" : "punktów"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!locked && currentUserId && (
                    <button
                      onClick={() => handleSave(match.id)}
                      disabled={savingId === match.id || !isDirty}
                      className={`flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer ${
                        isDirty 
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] transform active:scale-95" 
                          : "bg-slate-800/40 text-slate-500 border border-slate-800/30 cursor-not-allowed"
                      }`}
                    >
                      <Save className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                      {savingId === match.id ? "Zapis..." : "Zapisz"}
                    </button>
                  )}

                  {!currentUserId && !locked && (
                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 font-bold">
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      ZALOGUJ SIĘ
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
