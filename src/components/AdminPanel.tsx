import React, { useState } from 'react';
import { Match, UserProfile, Prediction } from '../types';
import { PlusCircle, Edit3, Settings, Save, Sparkles, RefreshCw, Trash2, Calendar } from 'lucide-react';

interface AdminPanelProps {
  matches: Match[];
  predictions: Prediction[];
  users: UserProfile[];
  onAddMatch: (newMatch: Omit<Match, "id">) => Promise<void>;
  onUpdateMatch: (matchId: string, updatedFields: Partial<Match>) => Promise<void>;
  onDeleteMatch: (matchId: string) => Promise<void>;
  onRecalculateScores: () => Promise<void>;
  customAlert: (msg: string, title?: string) => Promise<void>;
  customConfirm: (msg: string, title?: string) => Promise<boolean>;
}

export default function AdminPanel({
  matches,
  predictions,
  users,
  onAddMatch,
  onUpdateMatch,
  onDeleteMatch,
  onRecalculateScores,
  customAlert,
  customConfirm
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"add" | "manage">("add");
  
  // State for Add Match form
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [group, setGroup] = useState("Grupa C");
  const [date, setDate] = useState("");
  
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  // Score update staging
  const [scoreAEdit, setScoreAEdit] = useState<{ [id: string]: string }>({});
  const [scoreBEdit, setScoreBEdit] = useState<{ [id: string]: string }>({});
  const [statusEdit, setStatusEdit] = useState<{ [id: string]: "scheduled" | "live" | "finished" }>({});

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamA || !teamB || !group || !date) {
      await customAlert("Proszę uzupełnić wszystkie pola meczu!", "Brak pól");
      return;
    }

    try {
      setAdding(true);
      // Construct a valid ISO date
      const isoDate = new Date(date).toISOString();
      await onAddMatch({
        teamA,
        teamB,
        group,
        date: isoDate,
        status: "scheduled"
      });
      // Reset form
      setTeamA("");
      setTeamB("");
      setDate("");
      await customAlert("Mecz został pomyślnie dodany do terminarza!", "Sukces!");
    } catch (err) {
      console.error(err);
      await customAlert("Błąd podczas dodawania meczu!", "Błąd");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const sA = scoreAEdit[matchId] ?? match.scoreA?.toString() ?? "";
    const sB = scoreBEdit[matchId] ?? match.scoreB?.toString() ?? "";
    const status = statusEdit[matchId] ?? match.status;

    const fields: Partial<Match> = { status };

    if (status === "finished") {
      if (sA === "" || sB === "") {
        await customAlert("Wpisz ostateczny wynik meczu przed zakończeniem!", "Błąd");
        return;
      }
      fields.scoreA = parseInt(sA);
      fields.scoreB = parseInt(sB);
    } else if (status === "live") {
      if (sA !== "" && sB !== "") {
        fields.scoreA = parseInt(sA);
        fields.scoreB = parseInt(sB);
      }
    }

    try {
      setUpdatingId(matchId);
      await onUpdateMatch(matchId, fields);
      await customAlert("Wynik i status meczu zostały pomyślnie zapisane!", "Mecz zaktualizowany!");
    } catch (e) {
      console.error(e);
      await customAlert("Błąd zapisywania zmian!", "Błąd");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRecalculate = async () => {
    const confirmed = await customConfirm(
      "Czy na pewno chcesz przeliczyć punkty dla wszystkich graczy? Przeanalizuje to wszystkie zapisane predykcje i zaktualizuje tabelę liderów!",
      "Przeliczanie punktów"
    );
    if (!confirmed) {
      return;
    }

    try {
      setRecalculating(true);
      await onRecalculateScores();
      await customAlert("Tabela wyników została pomyślnie zaktualizowana!", "Sukces!");
    } catch (err) {
      console.error(err);
      await customAlert("Błąd podczas przeliczania punktów!", "Błąd");
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2.25rem] p-6 backdrop-blur-md shadow-[0_0_30px_rgba(217,119,6,0.05)] relative overflow-hidden" id="admin-panel">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800/80 z-10 relative">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/25 shadow-[0_0_15px_rgba(217,119,6,0.15)]">
            <Settings className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <h2 className="text-xl font-sans font-black tracking-tight text-slate-100 uppercase">Panel Administratora</h2>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">STAN KOLEJEK & PUNKTY GRACZY</p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto">
          {/* Global Standings recalculate button */}
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] text-white font-black uppercase text-[10px] tracking-wider rounded-2xl cursor-pointer transition transform active:scale-95 w-full sm:w-auto"
          >
            {recalculating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {recalculating ? "PRZELICZANIE..." : "Przelicz punkty graczy"}
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex p-1 gap-1.5 mb-6 bg-slate-950/60 rounded-2xl border border-slate-850">
        <button
          onClick={() => setActiveTab("add")}
          className={`flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-3 rounded-xl transition cursor-pointer ${
            activeTab === "add"
              ? "bg-slate-800 text-slate-100 shadow-inner border border-slate-700/50"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          Dodaj nowy mecz
        </button>
        <button
          onClick={() => setActiveTab("manage")}
          className={`flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-3 rounded-xl transition cursor-pointer ${
            activeTab === "manage"
              ? "bg-slate-800 text-slate-100 shadow-inner border border-slate-700/50"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Edit3 className="w-4 h-4 shrink-0" />
          Lista meczów ({matches.length})
        </button>
      </div>

      {/* Tab: Add Match */}
      {activeTab === "add" && (
        <form onSubmit={handleAddSubmit} className="space-y-4 z-10 relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-amber-500 uppercase tracking-widest mb-1.5 font-mono">Drużyna A (Gospodarz)</label>
              <input
                type="text"
                required
                placeholder="np. Polska, Argentyna"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                className="w-full bg-slate-950/80 border-2 border-slate-851 rounded-2xl px-4 py-3 text-slate-100 text-sm focus:outline-hidden focus:border-amber-550 font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-amber-500 uppercase tracking-widest mb-1.5 font-mono">Drużyna B (Gość)</label>
              <input
                type="text"
                required
                placeholder="np. Francja, Brazylia"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                className="w-full bg-slate-950/80 border-2 border-slate-851 rounded-2xl px-4 py-3 text-slate-100 text-sm focus:outline-hidden focus:border-amber-550 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-amber-500 uppercase tracking-widest mb-1.5 font-mono">Grupa / Faza Turnieju</label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full bg-slate-950/85 border-2 border-slate-851 rounded-2xl px-4 py-3 text-slate-100 text-sm focus:outline-hidden focus:border-amber-550 font-bold"
              >
                <option value="Grupa A">Grupa A</option>
                <option value="Grupa B">Grupa B</option>
                <option value="Grupa C">Grupa C</option>
                <option value="Grupa D">Grupa D</option>
                <option value="Grupa E">Grupa E</option>
                <option value="Grupa F">Grupa F</option>
                <option value="Grupa G">Grupa G</option>
                <option value="Grupa H">Grupa H</option>
                <option value="1/8 Finału">1/8 Finału</option>
                <option value="Ćwierćfinał">Ćwierćfinał</option>
                <option value="Półfinał">Półfinał</option>
                <option value="Finał">Finał</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-amber-500 uppercase tracking-widest mb-1.5 font-mono flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Data i godzina meczu
              </label>
              <input
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950/80 border-2 border-slate-851 rounded-2xl px-4 py-2.5 text-slate-100 text-sm focus:outline-hidden focus:border-amber-550 font-mono font-semibold"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={adding}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition duration-200 cursor-pointer"
            >
              {adding ? "Dodawanie..." : "Dodaj mecz do terminarza"}
            </button>
          </div>
        </form>
      )}

      {/* Tab: Manage Matches */}
      {activeTab === "manage" && (
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 z-10 relative">
          {matches.length === 0 ? (
            <div className="text-center py-10 text-slate-550 text-xs font-black font-mono tracking-wider uppercase">
              Brak meczów w bazie. Dodaj najpierw mecz.
            </div>
          ) : (
            matches.map(match => {
              const currentStatus = statusEdit[match.id] ?? match.status;
              const currentScoreA = scoreAEdit[match.id] ?? match.scoreA?.toString() ?? "";
              const currentScoreB = scoreBEdit[match.id] ?? match.scoreB?.toString() ?? "";

              return (
                <div key={match.id} className="p-4 bg-slate-950/40 rounded-2xl border border-slate-855 flex flex-col lg:flex-row gap-4 items-center justify-between">
                  {/* Left Column: Match details info */}
                  <div className="text-center lg:text-left min-w-0">
                    <span className="text-[9px] font-mono font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/15 uppercase">{match.group}</span>
                    <h4 className="text-sm font-extrabold text-slate-100 truncate mt-1.5">
                      {match.teamA} vs {match.teamB}
                    </h4>
                    <p className="text-[10px] text-slate-450 mt-1 font-mono">
                      {new Date(match.date).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Middle Column: Scores editing & status select */}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {/* Status selection dropdown */}
                    <select
                      value={currentStatus}
                      onChange={(e) => setStatusEdit(prev => ({ ...prev, [match.id]: e.target.value as any }))}
                      className="bg-slate-900 border border-slate-800 rounded-xl text-xs py-2 px-3 text-slate-200 font-bold"
                    >
                      <option value="scheduled">Planowany</option>
                      <option value="live">W grze</option>
                      <option value="finished">Zakończony</option>
                    </select>

                    {/* Inputs for match actual score */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="0"
                        value={currentScoreA}
                        disabled={currentStatus === "scheduled"}
                        onChange={(e) => setScoreAEdit(prev => ({ ...prev, [match.id]: e.target.value }))}
                        className="bg-slate-950 border border-slate-800 rounded-xl text-center font-black font-mono text-sm w-10 h-9 text-indigo-400 disabled:opacity-40"
                      />
                      <span className="text-slate-600 font-black">:</span>
                      <input
                        type="text"
                        placeholder="0"
                        value={currentScoreB}
                        disabled={currentStatus === "scheduled"}
                        onChange={(e) => setScoreBEdit(prev => ({ ...prev, [match.id]: e.target.value }))}
                        className="bg-slate-950 border border-slate-800 rounded-xl text-center font-black font-mono text-sm w-10 h-9 text-indigo-400 disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {/* Right Column: Actions (Save, Delete) */}
                  <div className="flex gap-2 shrink-0 w-full lg:w-auto justify-end">
                    <button
                      onClick={() => handleUpdate(match.id)}
                      disabled={updatingId === match.id}
                      className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-sm shadow-indigo-950"
                    >
                      <Save className="w-3.5 h-3.5 shrink-0" />
                      {updatingId === match.id ? "Zapis..." : "Zapisz"}
                    </button>
                    <button
                      onClick={async () => {
                        const confirmed = await customConfirm(`Czy na pewno usunąć mecz ${match.teamA} vs ${match.teamB}?`, "Usuwanie meczu");
                        if (confirmed) {
                          try {
                            await onDeleteMatch(match.id);
                            await customAlert("Mecz został pomyślnie usunięty!", "Usunięto!");
                          } catch (err: any) {
                            console.error("Błąd usuwania meczu:", err);
                            await customAlert(`Nie udało się usunąć meczu: ${err.message || err}`, "Błąd");
                          }
                        }
                      }}
                      className="flex items-center justify-center bg-[#1e0a0f] hover:bg-rose-600 border border-rose-950 hover:border-rose-500 text-rose-500 hover:text-white p-2.5 rounded-xl transition cursor-pointer"
                      title="Usuń mecz"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
