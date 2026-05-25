import React, { useState } from 'react';
import { UserProfile, Match, Prediction } from '../types';
import { Award, Trophy, Eye, X, Check, CheckSquare } from 'lucide-react';

interface LeaderboardProps {
  users: UserProfile[];
  matches: Match[];
  predictions: Prediction[];
  currentUserId: string | null;
}

export default function Leaderboard({ users, matches, predictions, currentUserId }: LeaderboardProps) {
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserPredictions, setSelectedUserPredictions] = useState<Prediction[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  React.useEffect(() => {
    if (!selectedUser) {
      setSelectedUserPredictions([]);
      return;
    }
    
    // If it's the current user, we can just use the prop-based predictions
    if (selectedUser.uid === currentUserId) {
      setSelectedUserPredictions(predictions.filter(p => p.userId === currentUserId));
      return;
    }
    
    const fetchSelectedUserPredictions = async () => {
      setLoadingPredictions(true);
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        // Find all matches that have started (live/finished)
        const startedMatches = matches.filter(m => m.status !== "scheduled");
        const fetchedList: Prediction[] = [];
        
        await Promise.all(
          startedMatches.map(async (m) => {
            const predId = `${selectedUser.uid}_${m.id}`;
            try {
              const specDoc = await getDoc(doc(db, 'predictions', predId));
              if (specDoc.exists()) {
                fetchedList.push(specDoc.data() as Prediction);
              }
            } catch (err) {
              // Might fail due to status if rule is strictly evaluated or not exist (normal, skip)
              console.log("Could not fetch prediction doc:", predId, err);
            }
          })
        );
        setSelectedUserPredictions(fetchedList);
      } catch (err) {
        console.error("Error fetching user predictions:", err);
      } finally {
        setLoadingPredictions(false);
      }
    };
    
    fetchSelectedUserPredictions();
  }, [selectedUser, matches, predictions, currentUserId]);

  // Sort users by points desc, then username asc
  const sortedUsers = [...users].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    return a.username.localeCompare(b.username);
  });

  const getRankStyle = (index: number) => {
    if (index === 0) return { bg: "bg-amber-500/10 border-amber-500/30 text-amber-400 font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.2)]", trophy: "text-amber-400" };
    if (index === 1) return { bg: "bg-slate-300/10 border-slate-300/30 text-slate-200 font-extrabold shadow-[0_0_15px_rgba(226,232,240,0.15)]", trophy: "text-slate-300" };
    if (index === 2) return { bg: "bg-amber-700/15 border-amber-800/40 text-amber-600 font-extrabold shadow-[0_0_15px_rgba(180,83,9,0.15)]", trophy: "text-amber-600" };
    return { bg: "bg-slate-850/60 border-slate-800/50 text-slate-400 font-bold", trophy: null };
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/80 rounded-[2.25rem] p-6 backdrop-blur-md shadow-[0_0_30px_rgba(30,58,138,0.12)] relative overflow-hidden" id="leaderboard">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-3xl rounded-full" />
      
      <div className="flex items-center gap-3.5 mb-6 z-10 relative">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/25 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
          <Trophy className="w-5 h-5 shrink-0" />
        </div>
        <div>
          <h2 className="text-xl font-sans font-black tracking-tight text-slate-100 uppercase">Tabela Wyników</h2>
          <p className="text-[10px] text-slate-400 font-mono tracking-wider">KLASYFIKACJA OGÓLNA GRUPY</p>
        </div>
      </div>

      {sortedUsers.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs font-semibold font-mono tracking-wider uppercase bg-slate-950/20 rounded-2xl border border-slate-800/50">
          BRAK GRACZY W TABELI. ZAREJESTRUJ SIĘ, ABY DOŁĄCZYĆ!
        </div>
      ) : (
        <div className="space-y-3 z-10 relative">
          {sortedUsers.map((user, index) => {
            const isMe = user.uid === currentUserId;
            const rankInfo = getRankStyle(index);
            
            // Calculate user predictions made
            const userPreds = predictions.filter(p => p.userId === user.uid);
            
            return (
              <div 
                key={user.uid}
                onClick={() => setSelectedUser(user)}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer transform hover:translate-x-1 group ${
                  isMe 
                    ? "bg-indigo-950/30 border-indigo-500/40 hover:border-indigo-400 shadow-md shadow-indigo-950/20" 
                    : "bg-slate-950/30 border-slate-800/85 hover:bg-slate-950/50 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Rank badge */}
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-mono text-xs tracking-tighter shrink-0 ${rankInfo.bg}`}>
                    {rankInfo.trophy ? (
                      <Trophy className={`w-4 h-4 ${rankInfo.trophy}`} />
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <img 
                      src={user.avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png"} 
                      alt={user.username}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900 object-cover"
                    />
                    {isMe && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 border-2 border-slate-900 rounded-full" />
                    )}
                  </div>

                  {/* Name and count */}
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-slate-200 block truncate leading-tight group-hover:text-white transition">
                      {user.username} {isMe && <span className="text-[9px] text-indigo-300 font-black px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 ml-1 font-mono tracking-widest uppercase">TY</span>}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-slate-500 font-mono tracking-wide mt-0.5 block">
                        Wytypowano: <span className="text-slate-400 font-semibold">{userPreds.length}</span> meczów
                      </span>
                    )}
                  </div>
                </div>
 
                {/* Score */}
                <div className="flex items-center gap-3.5">
                  <div className="text-right shrink-0">
                    <span className={`text-xl font-black font-mono tracking-tight block ${isMe ? "text-indigo-400" : "text-slate-100"}`}>
                      {user.points}
                    </span>
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase font-mono tracking-widest block">
                      pkt
                    </span>
                  </div>
                  <div className="p-2 text-slate-500 hover:text-slate-200 group-hover:text-indigo-400 transition bg-slate-800/30 rounded-xl border border-slate-800/50 shadow-inner">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
 
      {/* Friend predictions Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#020617]/95 border border-slate-800/80 rounded-[2.25rem] w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.15)] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-indigo-500/10 flex items-center justify-between bg-slate-900/20">
              <div className="flex items-center gap-3.5">
                <img 
                  src={selectedUser.avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png"} 
                  alt={selectedUser.username}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full border-2 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                />
                <div>
                  <h3 className="font-bold text-slate-100 text-lg leading-tight">{selectedUser.username}</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase mt-0.5">Typy i statystyki • <strong className="text-indigo-400">{selectedUser.points} pkt</strong></p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded-xl border border-slate-800/80 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            {/* List of Predictions */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              <h4 className="text-[10px] uppercase tracking-widest font-mono font-black text-indigo-400/80 pb-2 border-b border-slate-800/60 flex items-center gap-2">
                🟢 ROZPOCZĘTE LUB ZAKOŃCZONE MECZE
              </h4>
              
              {loadingPredictions ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Ładowanie typów...</p>
                </div>
              ) : (() => {
                // Get matches that are NOT scheduled anymore (live or finished)
                const openMatches = matches.filter(m => m.status !== "scheduled");
                const userPreds = selectedUser.uid === currentUserId 
                  ? predictions.filter(p => p.userId === currentUserId)
                  : selectedUserPredictions;
 
                if (openMatches.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-500 text-xs font-semibold font-mono tracking-wider uppercase">
                      Żadne mecze jeszcze się nie rozpoczęły.
                    </div>
                  );
                }
 
                return openMatches.map(match => {
                  const userPrediction = userPreds.find(p => p.matchId === match.id);

                  return (
                    <div key={match.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[9px] text-slate-500 font-mono font-bold tracking-wider mb-1 uppercase">
                          {match.group} • {match.status === "finished" ? "Zakończony" : "W grze"}
                        </div>
                        <div className="text-xs font-extrabold text-slate-200 truncate flex items-center gap-1.5">
                          <span>{match.teamA}</span>
                          <span className="text-[10px] text-slate-500 font-normal">vs</span>
                          <span>{match.teamB}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">
                          Wynik meczu: <span className="font-bold text-slate-200">{match.scoreA !== undefined ? `${match.scoreA} - ${match.scoreB}` : "TBD"}</span>
                        </div>
                      </div>

                      {/* Prediction and points scored badge */}
                      <div className="text-right shrink-0">
                        {userPrediction ? (
                          <>
                            <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
                              Typ: <span className="font-black text-indigo-400">{userPrediction.predictedA} - {userPrediction.predictedB}</span>
                            </div>
                            {match.status === "finished" && userPrediction.pointsEarned !== undefined && (
                              <span className={`inline-block py-0.5 px-2 rounded-full text-[10px] font-black font-mono mt-1.5 tracking-wider ${
                                userPrediction.pointsEarned === 3 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : userPrediction.pointsEarned === 1
                                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                  : "bg-slate-800 text-slate-400"
                              }`}>
                                +{userPrediction.pointsEarned} pkt
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 py-1 px-2.5 rounded-xl font-bold uppercase tracking-wider font-mono">
                            Brak typu
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950/50 border-t border-slate-850 text-center text-[9px] text-slate-500 font-mono select-none">
              Tylko mecze ze statusem "W grze" lub "Zakończony" pokazują typy innych graczy dla sprawiedliwości.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
