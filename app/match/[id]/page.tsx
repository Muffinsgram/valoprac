"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// Harita Listesi
const MAPS = [
  { id: 1, name: "Ascent", coords: "ITALY", img: "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04bca4185552/splash.png" },
  { id: 2, name: "Bind", coords: "MOROCCO", img: "https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png" },
  { id: 3, name: "Haven", coords: "BHUTAN", img: "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png" },
  { id: 4, name: "Split", coords: "JAPAN", img: "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png" },
  { id: 5, name: "Icebox", coords: "RUSSIA", img: "https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8eb2120fe648/splash.png" },
  { id: 6, name: "Breeze", coords: "ATLANTIC", img: "https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png" },
  { id: 7, name: "Lotus", coords: "INDIA", img: "https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png" },
  { id: 8, name: "Sunset", coords: "USA", img: "https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png" },
  { id: 9, name: "Pearl", coords: "PORTUGAL", img: "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png" },
  { id: 10, name: "Abyss", coords: "UNKNOWN", img: "https://media.valorant-api.com/maps/224b0a95-48b9-f703-1a86-c27704272847/splash.png" },
];

export default function MatchPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const userToken = searchParams.get('token'); 

  const [matchData, setMatchData] = useState<any>(null);
  const [myRole, setMyRole] = useState<'A' | 'B' | 'SPECTATOR'>('SPECTATOR');

  // Ses Efektleri
  const sounds = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return { click: new Audio('/click.mp3'), ban: new Audio('/ban.mp3') };
  }, []);
  const playClick = () => { if(sounds) { sounds.click.currentTime=0; sounds.click.play().catch(()=>{}); } };
  const playBan = () => { if(sounds) { sounds.ban.currentTime=0; sounds.ban.play().catch(()=>{}); } };

  useEffect(() => {
    if (!id) return;
    const fetchMatch = async () => {
      const { data } = await supabase.from('matches').select('*').eq('id', id).single();
      if (data) {
        setMatchData(data);
        if (userToken === data.token_a) setMyRole('A');
        else if (userToken === data.token_b) setMyRole('B');
        else setMyRole('SPECTATOR');
      }
    };
    fetchMatch();
    const channel = supabase.channel('match-room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, 
      (payload) => {
        setMatchData(payload.new);
        if (payload.new.banned_maps && matchData?.banned_maps) {
            if (payload.new.banned_maps.length > matchData.banned_maps.length) playBan();
            else playClick();
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, userToken]); 

  // Konfeti (İzleyicide daha büyük patlasın)
  useEffect(() => {
    if (matchData?.selected_side) {
        const count = myRole === 'SPECTATOR' ? 500 : 200;
        confetti({ particleCount: count, spread: 160, origin: { y: 0.6 }, colors: ['#ff4655', '#ffffff', '#00e1ff'] });
    }
  }, [matchData?.selected_side]);

  if (!matchData) return <div className="min-h-screen bg-[#0f1923] flex items-center justify-center"><div className="text-[#ff4655] font-black text-4xl animate-pulse tracking-widest uppercase">CONNECTING...</div></div>;

  const { team_a, team_b, banned_maps: bannedMaps, turn, captain_a_index, captain_b_index, selected_side } = matchData;
  const safeBannedMaps = bannedMaps || [];
  const remainingMaps = MAPS.filter((m) => !safeBannedMaps.includes(m.id));
  const isFinished = remainingMaps.length === 1;

  const isMyTurn = !isFinished && myRole === turn;
  const isSideSelectPhase = isFinished && !selected_side;
  const isMyTurnToPickSide = isSideSelectPhase && myRole === turn; 
  const pickerTeam = turn; 

  // --- TARAF BELİRLEME ---
  // A Takımının Tarafı
  const sideA = selected_side ? (pickerTeam === 'A' ? selected_side : (selected_side === 'ATTACK' ? 'DEFENSE' : 'ATTACK')) : null;
  // B Takımının Tarafı (A'nın tam tersi)
  const sideB = sideA ? (sideA === 'ATTACK' ? 'DEFENSE' : 'ATTACK') : null;

  // --- ACTIONS ---
  const handleBan = async (mapId: number) => {
    if (!isMyTurn || safeBannedMaps.includes(mapId)) return;
    setMatchData((prev: any) => ({ ...prev, banned_maps: [...prev.banned_maps, mapId] })); 
    playClick(); 
    await supabase.from('matches').update({
      banned_maps: [...safeBannedMaps, mapId],
      turn: turn === 'A' ? 'B' : 'A'
    }).eq('id', id);
  };

  const changeCaptain = async (team: 'A' | 'B', index: number) => {
    if (myRole !== team) return;
    setMatchData((prev: any) => ({ ...prev, [team === 'A' ? 'captain_a_index' : 'captain_b_index']: index }));
    if (team === 'A') await supabase.from('matches').update({ captain_a_index: index }).eq('id', id);
    else await supabase.from('matches').update({ captain_b_index: index }).eq('id', id);
  };

  const handleSideSelect = async (side: 'ATTACK' | 'DEFENSE') => {
      if (!isMyTurnToPickSide) return;
      setMatchData((prev: any) => ({ ...prev, selected_side: side }));
      await supabase.from('matches').update({ selected_side: side }).eq('id', id);
  };

  const CrownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-yellow-400 drop-shadow"><path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" /></svg>;

  return (
    <div className="min-h-screen bg-[#0f1923] text-white font-sans overflow-hidden flex flex-col relative selection:bg-[#ff4655] selection:text-white">
       
       {/* 1. ARKA PLAN KATMANI */}
       <div className="absolute inset-0 z-0 pointer-events-none">
           {isFinished ? (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} className="w-full h-full">
                   <Image src={remainingMaps[0].img} alt="bg" fill className="object-cover opacity-30 blur-sm scale-105" priority />
                   <div className="absolute inset-0 bg-gradient-to-t from-[#0f1923] via-[#0f1923]/70 to-transparent"></div>
               </motion.div>
           ) : (
             <div className="absolute inset-0 bg-[url('https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png')] bg-cover bg-center opacity-10 grayscale"></div>
           )}
           <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
       </div>

       {/* 2. HEADER */}
       <header className="relative z-20 h-20 flex justify-between items-center px-6 border-b border-white/10 bg-[#1c252e]/80 backdrop-blur-md">
          {/* TEAM A */}
          <div className="flex flex-col w-1/4">
             <div className="flex items-center gap-2">
                <span className="text-3xl font-black italic text-[#ff4655] tracking-tighter drop-shadow-lg">TEAM A</span>
                {sideA && <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold uppercase border animate-in slide-in-from-left-4 fade-in duration-500", sideA === 'ATTACK' ? "bg-[#ff4655] text-white border-white" : "bg-[#0f1923] text-gray-400 border-gray-600")}>{sideA}</span>}
             </div>
             <motion.div initial={{ width: 0 }} animate={{ width: turn === 'A' ? '100%' : '0%' }} className="h-1 bg-[#ff4655] mt-1 shadow-[0_0_10px_#ff4655]" />
          </div>

          {/* MID STATUS */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0">
             <div className="bg-[#1c252e] px-12 py-3 clip-path-polygon shadow-2xl border-b-2 border-white/10">
                 <div className="text-center">
                     {!isFinished ? (
                         <>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">MAP VETO</p>
                            <p className={cn("text-xl font-black uppercase tracking-widest", turn === 'A' ? "text-[#ff4655]" : "text-[#00e1ff]")}>
                                {turn === myRole ? "SIRA SENDE" : `SIRA: TAKIM ${turn}`}
                            </p>
                         </>
                     ) : (
                        <p className="text-xl font-black uppercase tracking-widest text-green-400">
                            {selected_side ? "HAZIRLIK" : "HARİTA SEÇİLDİ"}
                        </p>
                     )}
                 </div>
             </div>
          </div>

          {/* TEAM B */}
          <div className="flex flex-col w-1/4 items-end">
             <div className="flex items-center gap-2 flex-row-reverse">
                <span className="text-3xl font-black italic text-[#00e1ff] tracking-tighter drop-shadow-lg">TEAM B</span>
                {sideB && <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold uppercase border animate-in slide-in-from-right-4 fade-in duration-500", sideB === 'ATTACK' ? "bg-[#ff4655] text-white border-white" : "bg-[#0f1923] text-gray-400 border-gray-600")}>{sideB}</span>}
             </div>
             <motion.div initial={{ width: 0 }} animate={{ width: turn === 'B' ? '100%' : '0%' }} className="h-1 bg-[#00e1ff] mt-1 shadow-[0_0_10px_#00e1ff]" />
          </div>
       </header>

       {/* 3. MAIN CONTENT */}
       <div className="flex flex-1 overflow-hidden relative z-10">
          
          {/* SOL PANEL (TAKIM A) */}
          <div className="w-64 hidden md:flex flex-col bg-[#1c252e]/60 border-r border-white/5 p-4 backdrop-blur-sm">
             <div className="space-y-1 mt-4">
                {team_a && team_a.map((player: string, i: number) => {
                    const isCaptain = i === captain_a_index;
                    return (
                        <div key={i} onClick={() => changeCaptain('A', i)} 
                            className={cn("flex items-center gap-3 p-3 rounded transition-all border-l-4", 
                            isCaptain ? "bg-[#ff4655]/10 border-[#ff4655]" : "hover:bg-white/5 border-transparent",
                            myRole === 'A' ? "cursor-pointer" : "cursor-default"
                        )}>
                            <div className="w-6 h-6 flex items-center justify-center bg-[#ff4655] font-black text-[10px] shadow text-white clip-path-slant">{player.charAt(0)}</div>
                            <span className={cn("font-bold text-xs uppercase truncate flex-1", isCaptain ? "text-white" : "text-gray-400")}>{player}</span>
                            {isCaptain && <CrownIcon />}
                        </div>
                    )
                })}
             </div>
          </div>

          {/* ORTA ALAN */}
          <div className="flex-1 relative flex flex-col p-4 md:p-8 overflow-y-auto">
              
              {/* TARAF SEÇİMİ MODALI */}
              <AnimatePresence>
              {isSideSelectPhase && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl"
                  >
                      <h2 className="text-4xl font-black text-white italic tracking-tighter mb-8 drop-shadow-2xl">
                         {isMyTurnToPickSide ? "AVANTAJ SİZDE: TARAF SEÇİN" : `TAKIM ${turn} SEÇİM YAPIYOR...`}
                      </h2>
                      <div className="flex gap-8">
                          <button onClick={() => handleSideSelect('ATTACK')} disabled={!isMyTurnToPickSide} className="group w-56 h-72 bg-[#ff4655] relative overflow-hidden rounded hover:scale-105 transition-transform disabled:opacity-50 border-4 border-transparent hover:border-white shadow-[0_0_30px_#ff4655]">
                              <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-white/20 -rotate-45 group-hover:text-white/40 transition-colors">ATK</span>
                              <div className="absolute bottom-6 left-0 w-full text-center font-black text-3xl text-white tracking-widest">SALDIRI</div>
                          </button>
                          <button onClick={() => handleSideSelect('DEFENSE')} disabled={!isMyTurnToPickSide} className="group w-56 h-72 bg-[#00e1ff] relative overflow-hidden rounded hover:scale-105 transition-transform disabled:opacity-50 border-4 border-transparent hover:border-white shadow-[0_0_30px_#00e1ff]">
                              <span className="absolute inset-0 flex items-center justify-center text-4xl font-black text-black/20 -rotate-45 group-hover:text-black/40 transition-colors">DEF</span>
                              <div className="absolute bottom-6 left-0 w-full text-center font-black text-3xl text-black tracking-widest">SAVUNMA</div>
                          </button>
                      </div>
                  </motion.div>
              )}
              </AnimatePresence>

              {/* --- SONUÇ EKRANI (İzleyici ve Oyuncu İçin Özelleştirilmiş) --- */}
              {isFinished && selected_side && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center">
                       <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                           <h1 className="text-[100px] leading-none font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-2xl tracking-tighter text-center">
                               {remainingMaps[0].name.toUpperCase()}
                           </h1>
                       </motion.div>

                       {/* İZLEYİCİ GÖRÜNÜMÜ: İki tarafı da göster */}
                       {myRole === 'SPECTATOR' ? (
                           <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }} className="mt-16 flex gap-12">
                               <div className={cn("w-64 py-8 border-t-8 bg-black/60 backdrop-blur-md text-center shadow-2xl clip-path-slant", sideA === 'ATTACK' ? "border-[#ff4655]" : "border-[#00e1ff]")}>
                                   <p className="text-white text-xs font-bold uppercase mb-2 tracking-[0.2em]">TEAM A START</p>
                                   <h2 className={cn("text-5xl font-black italic", sideA === 'ATTACK' ? "text-[#ff4655]" : "text-[#00e1ff]")}>
                                       {sideA === 'ATTACK' ? "ATK" : "DEF"}
                                   </h2>
                               </div>
                               <div className="w-[1px] bg-white/20 h-32 self-center"></div>
                               <div className={cn("w-64 py-8 border-t-8 bg-black/60 backdrop-blur-md text-center shadow-2xl clip-path-slant", sideB === 'ATTACK' ? "border-[#ff4655]" : "border-[#00e1ff]")}>
                                   <p className="text-white text-xs font-bold uppercase mb-2 tracking-[0.2em]">TEAM B START</p>
                                   <h2 className={cn("text-5xl font-black italic", sideB === 'ATTACK' ? "text-[#ff4655]" : "text-[#00e1ff]")}>
                                       {sideB === 'ATTACK' ? "ATK" : "DEF"}
                                   </h2>
                               </div>
                           </motion.div>
                       ) : (
                           // OYUNCU GÖRÜNÜMÜ: Sadece kendi tarafını göster
                           <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} 
                               className={cn("mt-12 px-20 py-10 border-4 transform -skew-x-12 shadow-[0_0_100px_rgba(0,0,0,0.5)] backdrop-blur-md",
                                   (myRole === 'A' ? sideA : sideB) === 'ATTACK' ? "bg-[#ff4655]/90 border-[#ff4655]" : "bg-[#00e1ff]/90 border-[#00e1ff]"
                               )}>
                               <div className="transform skew-x-12 text-center">
                                   <p className={cn("font-bold uppercase tracking-[0.3em] text-sm mb-2", (myRole === 'A' ? sideA : sideB) === 'ATTACK' ? "text-white" : "text-black")}>BAŞLANGIÇ TARAFINIZ</p>
                                   <h2 className={cn("text-8xl font-black uppercase italic tracking-tighter", (myRole === 'A' ? sideA : sideB) === 'ATTACK' ? "text-white" : "text-black")}>
                                       {(myRole === 'A' ? sideA : sideB) === 'ATTACK' ? "SALDIRI" : "SAVUNMA"}
                                   </h2>
                               </div>
                           </motion.div>
                       )}
                  </div>
              )}

              {/* HARİTA LİSTESİ */}
              <motion.div 
                className={cn("grid grid-cols-2 lg:grid-cols-5 gap-4", isFinished ? "opacity-0 pointer-events-none" : "opacity-100")}
                animate={isFinished ? { y: 100, opacity: 0 } : { y: 0, opacity: 1 }}
              >
                  {MAPS.map((map, index) => {
                      const isBanned = safeBannedMaps.includes(map.id);
                      const showHover = isMyTurn && !isBanned;
                      return (
                          <motion.div 
                            key={map.id} 
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                            onClick={() => handleBan(map.id)}
                            className={cn("relative aspect-video bg-[#1c252e] border border-white/10 overflow-hidden group transition-all duration-200",
                                isBanned ? "grayscale opacity-25" : 
                                showHover ? "border-[#ff4655] shadow-[0_0_20px_rgba(255,70,85,0.4)] scale-105 z-10 cursor-pointer" : "opacity-80 hover:opacity-100"
                            )}
                          >
                              <Image src={map.img} alt={map.name} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
                              <div className="absolute bottom-0 w-full p-3 bg-gradient-to-t from-black/90 to-transparent text-center">
                                  <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">{map.name}</h3>
                              </div>
                              {isBanned && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><span className="text-red-500 font-black text-3xl uppercase -rotate-12 border-4 border-red-500 px-2 opacity-80">BAN</span></div>}
                              {showHover && <div className="absolute inset-0 bg-[#ff4655]/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-white font-black text-xl uppercase tracking-widest border-2 border-white px-4 py-1">YASAKLA</span></div>}
                          </motion.div>
                      )
                  })}
              </motion.div>
          </div>

          {/* SAĞ PANEL (TAKIM B) */}
          <div className="w-64 hidden md:flex flex-col bg-[#1c252e]/60 border-l border-white/5 p-4 backdrop-blur-sm items-end">
             <div className="space-y-1 mt-4 w-full">
                {team_b && team_b.map((player: string, i: number) => {
                    const isCaptain = i === captain_b_index;
                    return (
                        <div key={i} onClick={() => changeCaptain('B', i)} 
                            className={cn("group flex flex-row-reverse items-center gap-3 p-3 rounded transition-all border-r-4", 
                            isCaptain ? "bg-[#00e1ff]/10 border-[#00e1ff]" : "hover:bg-white/5 border-transparent",
                            myRole === 'B' ? "cursor-pointer" : "cursor-default"
                        )}>
                            <div className="w-6 h-6 flex items-center justify-center bg-[#00e1ff] font-black text-[10px] shadow text-black clip-path-slant">{player.charAt(0)}</div>
                            <span className={cn("font-bold text-xs uppercase truncate flex-1 text-right", isCaptain ? "text-white" : "text-gray-400")}>{player}</span>
                            {isCaptain && <CrownIcon />}
                        </div>
                    )
                })}
             </div>
          </div>
       </div>
    </div>
  );
}