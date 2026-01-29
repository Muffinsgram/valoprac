"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useSearchParams } from "next/navigation";
// import Image from "next/image"; // <-- Bunu kaldırdık (Gerekirse kalsın ama kullanmayacağız)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const slantClip = "polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)";
const TURN_DURATION = 30; 

// --- GÜNCELLENMİŞ HARİTA LİSTESİ ---
const MAPS = [
  { id: 1, name: "Ascent", coords: "45°26'BF N 12°20'Q E", atk: 48, def: 52, img: "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png" },
  { id: 2, name: "Bind", coords: "34°2'A N 6°51'Z W", atk: 51, def: 49, img: "https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png" },
  { id: 3, name: "Haven", coords: "27°28'A N 89°38'WZ E", atk: 53, def: 47, img: "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png" },
  { id: 4, name: "Split", coords: "35°41'CD N 139°41'WX E", atk: 45, def: 55, img: "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png" },
  { id: 5, name: "Icebox", coords: "76°44'A N 148°00'Z E", atk: 52, def: 48, img: "https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png" },
  { id: 6, name: "Breeze", coords: "26°11'AG N 71°10'WY W", atk: 50, def: 50, img: "https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png" },
  { id: 7, name: "Lotus", coords: "14°07'AB N 74°53'XY E", atk: 54, def: 46, img: "https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png" },
  { id: 8, name: "Sunset", coords: "34°03'KL N 118°15'YZ W", atk: 51, def: 49, img: "https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png" },
  { id: 9, name: "Pearl", coords: "38°42'ED N 9°08'XS W", atk: 49, def: 51, img: "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png" },
  { id: 10, name: "Abyss", coords: "UNKNOWN SECTOR", atk: 50, def: 50, img: "https://static.wikia.nocookie.net/valorant/images/6/61/Abyss_Loading_Screen.png" },
];

export default function MatchPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const userToken = searchParams.get('token'); 

  const [matchData, setMatchData] = useState<any>(null);
  const [myRole, setMyRole] = useState<'A' | 'B' | 'SPECTATOR'>('SPECTATOR');
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [isMuted, setIsMuted] = useState(false);
  const isProcessingRef = useRef(false);
  const prevBannedCountRef = useRef(0);

  const sounds = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return { 
        click: new Audio('/click.mp3'), 
        ban: new Audio('/ban.mp3'),
        lock: new Audio('/match-start.mp3'),
        tick: new Audio('/tick.mp3') 
    };
  }, []);
  
  const playSound = (type: 'click' | 'ban' | 'lock' | 'tick') => {
      if(!sounds || isMuted) return;
      sounds[type].currentTime = 0;
      sounds[type].play().catch(()=>{});
  };

  useEffect(() => {
    if (!id) return;
    const fetchMatch = async () => {
      const { data } = await supabase.from('matches').select('*').eq('id', id).single();
      if (data) {
        setMatchData(data);
        prevBannedCountRef.current = data.banned_maps ? data.banned_maps.length : 0;
        
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
        const newBannedCount = payload.new.banned_maps ? payload.new.banned_maps.length : 0;
        if (newBannedCount > prevBannedCountRef.current && !isProcessingRef.current) {
            playSound('ban');
        }
        prevBannedCountRef.current = newBannedCount;
        isProcessingRef.current = false;
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, userToken]); 

  useEffect(() => {
    if (matchData?.selected_side) {
        playSound('lock');
        const count = myRole === 'SPECTATOR' ? 500 : 200;
        confetti({ particleCount: count, spread: 160, origin: { y: 0.6 }, colors: ['#ff4655', '#ffffff', '#00e1ff'] });
    }
  }, [matchData?.selected_side]);

  const { team_a, team_b, banned_maps: bannedMaps, turn, captain_a_index, captain_b_index, selected_side, timer_end, settings } = matchData || {};
  
  const isTimerEnabled = settings?.timer !== false;
  const safeBannedMaps = useMemo(() => bannedMaps || [], [bannedMaps]);
  const remainingMaps = MAPS.filter((m) => !safeBannedMaps.includes(m.id));
  const isFinished = remainingMaps.length === 1;
  const isMyTurn = !isFinished && myRole === turn;
  const isWaitingStart = !timer_end && safeBannedMaps.length === 0;

  const actionLog = useMemo(() => {
    if (!matchData) return [];
    return safeBannedMaps.map((mapId: number, index: number) => {
        const teamName = index % 2 === 0 
            ? (matchData.turn === 'A' ? 'TEAM B' : 'TEAM A') 
            : (matchData.turn === 'A' ? 'TEAM A' : 'TEAM B');
        const mapName = MAPS.find(m => m.id === mapId)?.name;
        return { team: teamName, mapName, index };
    });
  }, [safeBannedMaps, matchData]);

  // --- AUTO BAN ---
  useEffect(() => {
    if (!isTimerEnabled || !timer_end || isFinished || matchData?.selected_side) {
        setTimeLeft(TURN_DURATION); return; 
    }
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const end = new Date(timer_end).getTime();
        const diff = Math.ceil((end - now) / 1000);
        if (diff <= 0) {
            setTimeLeft(0); clearInterval(interval);
            if (isMyTurn && !isProcessingRef.current) {
                const randomMap = remainingMaps[Math.floor(Math.random() * remainingMaps.length)];
                if (randomMap) handleBan(randomMap.id); 
            }
        } else {
            setTimeLeft(diff);
            if(diff <= 5 && diff > 0) playSound('tick');
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [matchData, isMyTurn, remainingMaps, timer_end, isTimerEnabled]);

  const handleBan = async (mapId: number) => {
    if (safeBannedMaps.includes(mapId) || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    playSound('ban'); 

    const newTimerEnd = isTimerEnabled ? new Date(new Date().getTime() + TURN_DURATION * 1000).toISOString() : null;
    const nextTurn = turn === 'A' ? 'B' : 'A';

    setMatchData((prev: any) => {
        const newData = { ...prev, banned_maps: [...prev.banned_maps, mapId], turn: nextTurn, timer_end: newTimerEnd };
        prevBannedCountRef.current = newData.banned_maps.length; 
        return newData;
    }); 
    
    try { 
        await supabase.from('matches').update({ banned_maps: [...safeBannedMaps, mapId], turn: nextTurn, timer_end: newTimerEnd }).eq('id', id); 
    } catch (error) { 
        isProcessingRef.current = false; 
    }
  };

  const changeCaptain = async (team: 'A' | 'B', index: number) => {
    if (myRole !== team) return;
    if (team === 'A') await supabase.from('matches').update({ captain_a_index: index }).eq('id', id);
    else await supabase.from('matches').update({ captain_b_index: index }).eq('id', id);
  };

  const handleSideSelect = async (side: 'ATTACK' | 'DEFENSE') => {
      if (isFinished && !selected_side && myRole === turn) {
          await supabase.from('matches').update({ selected_side: side }).eq('id', id);
      }
  };

  const CrownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-yellow-400 drop-shadow"><path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" /></svg>;

  if (!matchData) return <div className="min-h-screen bg-[#0f1923] flex items-center justify-center text-white font-mono animate-pulse">VERİLER YÜKLENİYOR...</div>;

  const isSideSelectPhase = isFinished && !selected_side;
  const isMyTurnToPickSide = isSideSelectPhase && myRole === turn; 
  const pickerTeam = turn; 
  const sideA = selected_side ? (pickerTeam === 'A' ? selected_side : (selected_side === 'ATTACK' ? 'DEFENSE' : 'ATTACK')) : null;
  const sideB = sideA ? (sideA === 'ATTACK' ? 'DEFENSE' : 'ATTACK') : null;

  return (
    <div className="min-h-screen bg-[#0f1923] text-white font-sans overflow-hidden flex flex-col relative selection:bg-[#ff4655] selection:text-white">
       
       <div className="absolute inset-0 z-0 pointer-events-none">
           <AnimatePresence mode="wait">
               <motion.div key={isFinished ? 'finished' : 'veto'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
                   {/* DÜZELTME: <Image> YERİNE <img> KULLANILDI */}
                   <img src={isFinished ? remainingMaps[0].img : "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png"} alt="bg" className={cn("object-cover w-full h-full transition-all duration-1000", isFinished ? "opacity-30 blur-sm scale-105" : "opacity-10 grayscale")} />
               </motion.div>
           </AnimatePresence>
           <div className="absolute inset-0 bg-gradient-to-t from-[#0f1923] via-[#0f1923]/80 to-[#0f1923]/40"></div>
           {isMyTurn && <div className={cn("absolute inset-0 border-[8px] z-50 pointer-events-none opacity-50", turn === 'A' ? "border-[#ff4655]" : "border-[#00e1ff]", (!isWaitingStart && isTimerEnabled) && "animate-pulse")}></div>}
       </div>

       {/* HEADER */}
       <header className="relative z-20 h-24 flex justify-between items-center px-8 border-b border-white/10 bg-[#1c252e]/90 backdrop-blur-md shadow-2xl">
          {myRole === 'SPECTATOR' && (<div className="absolute top-0 left-0 bg-yellow-500 text-black font-black text-[10px] px-3 py-1 rounded-br z-50 animate-pulse">CANLI İZLEYİCİ MODU</div>)}
          {!isFinished && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-800">
                {isWaitingStart ? (<motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="h-full w-full bg-yellow-400 shadow-[0_0_10px_#facc15]" />) : !isTimerEnabled ? (<div className="h-full w-full bg-gray-600/50"></div>) : (<motion.div initial={{ width: "100%" }} animate={{ width: `${(timeLeft / TURN_DURATION) * 100}%` }} transition={{ ease: "linear", duration: 1 }} className={cn("h-full shadow-[0_0_10px_currentColor]", timeLeft <= 10 ? "bg-red-500 text-red-500" : "bg-white text-white")} />)}
            </div>
          )}
          <div className="flex flex-col w-1/3 relative group">
             <div className="flex items-center gap-3">
                <span className="text-4xl font-black italic text-[#ff4655] tracking-tighter drop-shadow pr-2">TEAM A</span>
                {sideA && <span className={cn("text-[10px] px-3 py-1 rounded font-black uppercase border tracking-widest", sideA === 'ATTACK' ? "bg-[#ff4655] text-white border-white" : "bg-[#0f1923] text-gray-400 border-gray-600")}>{sideA === 'ATTACK' ? 'SALDIRI' : 'SAVUNMA'}</span>}
             </div>
             <motion.div initial={{ width: 0 }} animate={{ width: turn === 'A' ? '100%' : '20%' }} className={cn("h-1 mt-2 transition-all duration-500", turn === 'A' ? "bg-[#ff4655] shadow-[0_0_15px_#ff4655]" : "bg-gray-700")} />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 top-0 transform translate-y-[-10%] flex flex-col items-center">
             <div className="bg-[#0f1923] px-16 py-6 pb-8 clip-path-polygon shadow border-b-4 border-gray-700 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>
                 <div className="text-center relative z-10">
                     {!isFinished ? (
                         <>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mb-1">HARİTA ELEME</p>
                            {isWaitingStart ? ( <div className="flex items-center justify-center gap-2 animate-pulse"><span className="w-2 h-2 rounded-full bg-yellow-400"></span><p className="text-xl font-black uppercase tracking-widest italic text-yellow-400">{turn === myRole ? "BAŞLAMAK İÇİN BANLA" : `TAKIM ${turn} BEKLENİYOR`}</p></div> ) : ( <div className="flex items-center justify-center gap-2"><span className={cn("w-2 h-2 rounded-full", turn === 'A' ? "bg-[#ff4655]" : "bg-[#00e1ff]")}></span><p className={cn("text-2xl font-black uppercase tracking-widest italic", turn === 'A' ? "text-[#ff4655]" : "text-[#00e1ff]")}>{turn === myRole ? "SEÇİM SENDE" : `SIRA: TAKIM ${turn}`}</p></div> )}
                         </>
                     ) : (
                        <p className="text-2xl font-black uppercase tracking-widest text-green-400 drop-shadow">{selected_side ? "HAZIRLIK" : "HARİTA SEÇİLDİ"}</p>
                     )}
                 </div>
             </div>
             <AnimatePresence>
                 {!isFinished && !isWaitingStart && isTimerEnabled && timeLeft <= 10 && ( <motion.div key={timeLeft} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 10 }} exit={{ opacity: 0 }} className="text-6xl font-black italic text-red-500 drop-shadow z-50 absolute top-24">{timeLeft}</motion.div> )}
             </AnimatePresence>
          </div>
          <div className="flex flex-col w-1/3 items-end relative group">
             <div className="flex items-center gap-3 flex-row-reverse">
                <span className="text-4xl font-black italic text-[#00e1ff] tracking-tighter drop-shadow pr-2">TEAM B</span>
                {sideB && <span className={cn("text-[10px] px-3 py-1 rounded font-black uppercase border tracking-widest", sideB === 'ATTACK' ? "bg-[#ff4655] text-white border-white" : "bg-[#0f1923] text-gray-400 border-gray-600")}>{sideB === 'ATTACK' ? 'SALDIRI' : 'SAVUNMA'}</span>}
             </div>
             <motion.div initial={{ width: 0 }} animate={{ width: turn === 'B' ? '100%' : '20%' }} className={cn("h-1 mt-2 transition-all duration-500", turn === 'B' ? "bg-[#00e1ff] shadow-[0_0_15px_#00e1ff]" : "bg-gray-700")} />
          </div>
       </header>

       <div className="flex flex-1 overflow-hidden relative z-10">
          <div className="w-72 hidden xl:flex flex-col justify-between bg-gradient-to-r from-[#1c252e] to-[#1c252e]/50 border-r border-white/5 p-6 backdrop-blur-sm">
             <div>
                 <div className="text-[#ff4655] font-black text-sm uppercase tracking-widest mb-4 border-b border-[#ff4655]/20 pb-2">Kadro A</div>
                 <div className="space-y-2">
                    {team_a && team_a.map((player: string, i: number) => { const isCaptain = i === captain_a_index; return ( <div key={i} onClick={() => changeCaptain('A', i)} className={cn("relative group flex items-center gap-4 p-3 rounded transition-all", isCaptain ? "bg-[#ff4655]/20 border-l-2 border-[#ff4655]" : "hover:bg-white/5 border-l-2 border-transparent", myRole === 'A' ? "cursor-pointer" : "cursor-default")}> <div className="w-8 h-8 flex items-center justify-center bg-[#2c353e] font-black text-xs shadow text-white rounded skew-x-[-10deg] border border-gray-600 group-hover:border-[#ff4655] transition-colors">{player.charAt(0)}</div> <span className={cn("font-bold text-sm uppercase truncate flex-1 tracking-wide", isCaptain ? "text-white" : "text-gray-400 group-hover:text-white")}>{player}</span> {isCaptain && <CrownIcon />} </div> ) })}
                 </div>
             </div>
             <div className="mt-8 bg-black/40 p-4 rounded border border-white/10 font-mono text-[10px] h-64 overflow-hidden flex flex-col relative">
                 <div className="text-gray-500 font-bold uppercase tracking-widest mb-2 border-b border-gray-700 pb-1 flex justify-between"> <span>SYSTEM LOG</span> <span className={cn("w-2 h-2 rounded-full", isWaitingStart ? "bg-yellow-400" : isTimerEnabled ? "bg-green-500 animate-pulse" : "bg-gray-500")}></span> </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col-reverse gap-2"> {actionLog.map((log, i) => ( <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2 items-center"> <span className="text-gray-600">[{i + 1}]</span> <span className={cn("font-bold", log.team?.includes('A') ? "text-[#ff4655]" : "text-[#00e1ff]")}>{log.team}</span> <span className="text-gray-400">BANNED</span> <span className="text-white font-bold">{log.mapName?.toUpperCase()}</span> </motion.div> ))} {isWaitingStart && <div className="text-yellow-500/50 italic animate-pulse">WAITING FOR START...</div>} </div>
                 <button onClick={() => setIsMuted(!isMuted)} className="absolute bottom-2 right-2 text-gray-500 hover:text-white transition-colors"> {isMuted ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>} </button>
             </div>
          </div>

          <div className="flex-1 relative flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar">
              <AnimatePresence>
              {isSideSelectPhase && (
                  <motion.div initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(10px)" }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60">
                      <div className="mb-8 relative group w-96 aspect-video rounded-xl overflow-hidden border-4 border-white shadow-[0_0_50px_rgba(255,255,255,0.2)]"> 
                          {/* DÜZELTME: <Image> YERİNE <img> KULLANILDI */}
                          <img src={remainingMaps[0].img} alt={remainingMaps[0].name} className="object-cover w-full h-full" /> 
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40"> <h1 className="text-6xl font-black italic text-white drop-shadow-lg uppercase tracking-widest">{remainingMaps[0].name}</h1> </div> 
                      </div>
                      <h2 className="text-2xl font-bold text-gray-400 tracking-widest mb-8"> {isMyTurnToPickSide ? <span className="text-[#00e1ff] animate-pulse">TARAFINI SEÇ</span> : `TAKIM ${turn} TARAF SEÇİYOR...`} </h2>
                      <div className="flex gap-12"> <button onClick={() => handleSideSelect('ATTACK')} disabled={!isMyTurnToPickSide} className="w-48 h-16 bg-[#ff4655] hover:bg-white hover:text-[#ff4655] text-white font-black text-2xl skew-x-[-20deg] transition-all disabled:opacity-20 disabled:cursor-not-allowed"> <span className="skew-x-[20deg] block">SALDIRI</span> </button> <button onClick={() => handleSideSelect('DEFENSE')} disabled={!isMyTurnToPickSide} className="w-48 h-16 bg-[#00e1ff] hover:bg-white hover:text-[#00e1ff] text-black font-black text-2xl skew-x-[-20deg] transition-all disabled:opacity-20 disabled:cursor-not-allowed"> <span className="skew-x-[20deg] block">SAVUNMA</span> </button> </div>
                  </motion.div>
              )}
              </AnimatePresence>

              {/* SONUÇ EKRANI */}
              {isFinished && selected_side && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px]">
                       <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: "spring" }} className="mb-12 text-center">
                           <p className="text-[#ff4655] font-bold tracking-[0.5em] text-sm mb-2 uppercase">Savaş Alanı</p>
                           <h1 className="text-8xl md:text-9xl font-black italic text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] tracking-tighter uppercase" style={{ WebkitTextStroke: "1px rgba(255,255,255,0.3)" }}>{remainingMaps[0].name}</h1>
                       </motion.div>

                       {myRole === 'SPECTATOR' ? (
                           <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }} className="flex flex-col md:flex-row items-center gap-8 md:gap-24 pointer-events-auto">
                                <div className="flex flex-col items-center group">
                                    <span className="text-gray-400 text-xs font-mono tracking-widest mb-1">TEAM A</span>
                                    <div className={cn("relative px-12 py-8 bg-[#1c252e] border-t-4 border-b-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] transform -skew-x-12", sideA === 'ATTACK' ? "border-[#ff4655]" : "border-[#00e1ff]")}>
                                        <div className={cn("absolute inset-0 opacity-20", sideA === 'ATTACK' ? "bg-[#ff4655]" : "bg-[#00e1ff]")}></div>
                                        <div className="transform skew-x-12 text-center">
                                            <h2 className={cn("text-6xl font-black italic tracking-tighter drop-shadow-lg", sideA === 'ATTACK' ? "text-[#ff4655]" : "text-[#00e1ff]")}>{sideA === 'ATTACK' ? "SALDIRI" : "SAVUNMA"}</h2>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-px h-32 bg-gradient-to-b from-transparent via-white/20 to-transparent hidden md:block"></div>
                                <div className="flex flex-col items-center group">
                                    <span className="text-gray-400 text-xs font-mono tracking-widest mb-1">TEAM B</span>
                                    <div className={cn("relative px-12 py-8 bg-[#1c252e] border-t-4 border-b-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] transform skew-x-12", sideB === 'ATTACK' ? "border-[#ff4655]" : "border-[#00e1ff]")}>
                                        <div className={cn("absolute inset-0 opacity-20", sideB === 'ATTACK' ? "bg-[#ff4655]" : "bg-[#00e1ff]")}></div>
                                        <div className="transform -skew-x-12 text-center">
                                            <h2 className={cn("text-6xl font-black italic tracking-tighter drop-shadow-lg", sideB === 'ATTACK' ? "text-[#ff4655]" : "text-[#00e1ff]")}>{sideB === 'ATTACK' ? "SALDIRI" : "SAVUNMA"}</h2>
                                        </div>
                                    </div>
                                </div>
                           </motion.div>
                       ) : (
                           <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8">
                                <div className={cn("px-16 py-6 transform -skew-x-12 border-l-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-[#1c252e]", (myRole === 'A' ? sideA : sideB) === 'ATTACK' ? "border-[#ff4655]" : "border-[#00e1ff]")}>
                                    <div className="transform skew-x-12 text-center">
                                        <p className="text-gray-400 text-xs font-bold tracking-[0.4em] uppercase mb-1">BAŞLANGIÇ</p>
                                        <h2 className={cn("text-5xl font-black italic tracking-tighter", (myRole === 'A' ? sideA : sideB) === 'ATTACK' ? "text-[#ff4655]" : "text-[#00e1ff]")}>{(myRole === 'A' ? sideA : sideB) === 'ATTACK' ? "SALDIRI" : "SAVUNMA"}</h2>
                                    </div>
                                </div>
                           </motion.div>
                       )}
                  </div>
              )}

              <motion.div className={cn("grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6", isFinished ? "opacity-20 pointer-events-none blur-sm transition-all duration-1000" : "opacity-100")}>
                  {MAPS.map((map, index) => {
                      const isBanned = safeBannedMaps.includes(map.id);
                      const showHover = isMyTurn && !isBanned;
                      return (
                          <motion.div key={map.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.05 }} onClick={() => isMyTurn && handleBan(map.id)} className={cn("relative aspect-[16/9] group transition-all duration-300 overflow-hidden", isBanned ? "cursor-not-allowed" : showHover ? "cursor-pointer z-10 scale-[1.03] shadow-[0_10px_30px_rgba(0,0,0,0.5)]" : "opacity-70 hover:opacity-100")} style={{ clipPath: slantClip }}>
                              {/* DÜZELTME: <Image> YERİNE <img> KULLANILDI */}
                              <img src={map.img} alt={map.name} className={cn("object-cover w-full h-full transition-transform duration-700", isBanned ? "grayscale contrast-125" : "group-hover:scale-110")} />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                              {!isBanned && <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><div className="bg-black/60 backdrop-blur px-2 py-1 rounded text-[8px] font-mono border border-white/10"><span className="text-[#ff4655]">ATK %{map.atk}</span> <span className="text-gray-500">/</span> <span className="text-[#00e1ff]">DEF %{map.def}</span></div></div>}
                              <div className="absolute bottom-0 left-0 w-full p-4"> <h3 className={cn("text-2xl font-black italic uppercase tracking-tighter transition-colors pr-2", isBanned ? "text-gray-500 line-through decoration-red-500/50" : "text-white")}>{map.name}</h3> <p className="text-[9px] text-gray-400 font-mono tracking-widest opacity-0 group-hover:opacity-100 transition-opacity -mt-1">{map.coords}</p> </div>
                              <div className={cn("absolute inset-0 border-[3px] transition-colors pointer-events-none", isBanned ? "border-red-900/30" : showHover ? "border-[#ff4655] shadow-[inset_0_0_20px_rgba(255,70,85,0.3)]" : "border-transparent group-hover:border-white/20")}></div>
                              <AnimatePresence> {isBanned && <motion.div initial={{ scale: 2, opacity: 0, rotate: -45 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"><div className="border-[6px] border-red-500 px-4 py-1 rounded shadow-[0_0_30px_#ff4655]"><span className="text-red-500 font-black text-4xl uppercase tracking-widest drop-shadow-md">BANNED</span></div></motion.div>} </AnimatePresence>
                              {showHover && <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"><div className="bg-[#ff4655] text-white font-bold text-sm uppercase px-6 py-2 tracking-widest clip-path-polygon transform hover:scale-110 transition-transform shadow-lg">YASAKLA</div></div>}
                          </motion.div>
                      )
                  })}
              </motion.div>
          </div>

          <div className="w-72 hidden xl:flex flex-col bg-gradient-to-l from-[#1c252e] to-[#1c252e]/50 border-l border-white/5 p-6 backdrop-blur-sm items-end">
             <div className="text-[#00e1ff] font-black text-sm uppercase tracking-widest mb-4 border-b border-[#00e1ff]/20 pb-2 w-full text-right">Kadro B</div>
             <div className="space-y-2 w-full">
                {team_b && team_b.map((player: string, i: number) => { const isCaptain = i === captain_b_index; return ( <div key={i} onClick={() => changeCaptain('B', i)} className={cn("relative group flex flex-row-reverse items-center gap-4 p-3 rounded transition-all", isCaptain ? "bg-[#00e1ff]/20 border-r-2 border-[#00e1ff]" : "hover:bg-white/5 border-r-2 border-transparent", myRole === 'B' ? "cursor-pointer" : "cursor-default")}> <div className="w-8 h-8 flex items-center justify-center bg-[#2c353e] font-black text-xs shadow text-white rounded skew-x-[-10deg] border border-gray-600 group-hover:border-[#00e1ff] transition-colors">{player.charAt(0)}</div> <span className={cn("font-bold text-sm uppercase truncate flex-1 text-right tracking-wide", isCaptain ? "text-white" : "text-gray-400 group-hover:text-white")}>{player}</span> {isCaptain && <CrownIcon />} </div> ) })}
             </div>
          </div>
       </div>
    </div>
  );
}
