"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

// Valorant tarzı eğik köşeler
const slantClipPath = "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)";
const buttonClipPath = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";

export default function Home() {
  const [playerInput, setPlayerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdMatch, setCreatedMatch] = useState<any>(null);
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [captains, setCaptains] = useState<{ A: string | null; B: string | null }>({ A: null, B: null });
  
  // YENİ: Ayarlar State'i
  const [settings, setSettings] = useState({
    timer: true, // Varsayılan olarak açık
  });

  const sounds = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return { click: new Audio('/click.mp3'), start: new Audio('/match-start.mp3') };
  }, []);

  const playClick = () => { if(sounds) { sounds.click.currentTime=0; sounds.click.play().catch(()=>{}); } };

  useEffect(() => {
    const names = playerInput.split("\n").map(n => n.trim()).filter(n => n !== "");
    setPreviewNames(names);
    setCaptains({ A: null, B: null });
  }, [playerInput]);

  const toggleCaptain = (name: string) => {
    playClick();
    if (captains.A === name) { setCaptains(prev => ({ ...prev, A: null })); return; }
    if (captains.B === name) { setCaptains(prev => ({ ...prev, B: null })); return; }
    if (!captains.A) { setCaptains(prev => ({ ...prev, A: name })); }
    else if (!captains.B) { setCaptains(prev => ({ ...prev, B: name })); }
    else { alert("Önce mevcut kaptanlardan birini kaldır!"); }
  };

  const handleCreateMatch = async () => {
    playClick();
    if (previewNames.length < 2) { alert("En az 2 isim gir!"); return; }
    
    if ((captains.A && !captains.B) || (!captains.A && captains.B)) {
        alert("Lütfen ya iki kaptanı da seçin ya da hiçbirini seçmeyin.");
        return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));

    let teamA: string[] = [];
    let teamB: string[] = [];

    if (captains.A && captains.B) {
        const pool = previewNames.filter(n => n !== captains.A && n !== captains.B);
        const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
        const middle = Math.ceil(shuffledPool.length / 2);
        teamA = [captains.A, ...shuffledPool.slice(0, middle)];
        teamB = [captains.B, ...shuffledPool.slice(middle)];
    } else {
        const shuffled = [...previewNames].sort(() => Math.random() - 0.5);
        const middle = Math.ceil(shuffled.length / 2);
        teamA = shuffled.slice(0, middle);
        teamB = shuffled.slice(middle);
    }
    
    const startingTeam = Math.random() < 0.5 ? 'A' : 'B';
    const initialTimerEnd = null; // Başlangıçta timer yok, ilk ban ile başlayacak (eğer açıksa)
    
    const { data, error } = await supabase
      .from('matches')
      .insert([{ 
          team_a: teamA, 
          team_b: teamB, 
          turn: startingTeam, 
          banned_maps: [],
          timer_end: initialTimerEnd,
          settings: settings // YENİ: Ayarları veritabanına kaydet
      }])
      .select().single();

    setLoading(false);
    if (error) alert(error.message);
    else setCreatedMatch(data);
  };

  const copyLink = (type: 'A' | 'B' | 'SPEC') => {
    playClick();
    if (!createdMatch) return;
    const baseUrl = window.location.origin + `/match/${createdMatch.id}`;
    let finalUrl = type === 'A' ? `${baseUrl}?token=${createdMatch.token_a}` : type === 'B' ? `${baseUrl}?token=${createdMatch.token_b}` : `${baseUrl}?token=${createdMatch.token_spectator}`;
    navigator.clipboard.writeText(finalUrl);
    alert("Bağlantı kopyalandı!");
  };

  return (
    <div className="min-h-screen bg-[#0f1923] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#ff4655] selection:text-white">
      {/* ARKA PLAN */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
          <Image src="https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png" alt="bg" fill className="object-cover opacity-20 blur-sm scale-105" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1923] via-[#0f1923]/80 to-[#0f1923]/40"></div>
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#ff4655]/20 to-transparent"></div>
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#00e1ff]/20 to-transparent"></div>
      </div>
      
      <AnimatePresence mode="wait">
        {!createdMatch ? (
          <motion.div 
            key="form"
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, transition: {duration: 0.2} }}
            className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 h-[85vh] max-h-[900px]"
          >
            {/* --- SOL PANEL: Form ve Ayarlar --- */}
            <div className="bg-[#1c252e] border-2 border-gray-800/50 rounded-xl p-6 shadow-[0_0_20px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col h-full backdrop-blur-sm group hover:border-[#ff4655]/30 transition-colors duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#ff4655]/10 to-transparent opacity-50 pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-1 h-2/3 bg-[#ff4655] shadow-[0_0_10px_#ff4655]"></div>
                
                <h1 className="text-4xl lg:text-5xl font-black italic text-white mb-1 tracking-tighter uppercase" style={{textShadow: "0 2px 10px rgba(255, 70, 85, 0.3)"}}>
                    LOBİ <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4655] to-[#ff8a95] pr-2">KURULUMU</span>
                </h1>
                <p className="text-gray-400 mb-6 text-[10px] font-mono tracking-[0.3em] uppercase border-b border-gray-700 pb-2">Turnuva Yönetim Paneli // VLR.24</p>
                
                {/* İsim Giriş Alanı */}
                <div className="flex-1 flex flex-col z-10 min-h-0">
                    <label className="text-xs font-bold text-[#ff4655] uppercase tracking-widest mb-2 flex items-center">
                        <span className="w-3 h-px bg-[#ff4655] mr-2"></span>
                        Oyuncu Listesi
                    </label>
                    <div className="flex-1 relative group/input mb-4">
                        <textarea 
                            className="w-full h-full bg-[#0f1923]/80 border-2 border-gray-700 hover:border-gray-500 rounded p-4 text-white placeholder:text-gray-600 focus:border-[#ff4655] focus:ring-0 focus:outline-none resize-none font-mono text-sm transition-all shadow-inner custom-scrollbar"
                            placeholder="Muffinsgram"
                            value={playerInput}
                            onChange={(e) => setPlayerInput(e.target.value)}
                            spellCheck={false}
                        />
                    </div>
                </div>

                {/* YENİ: AYARLAR PANELİ */}
                <div className="mb-4 bg-[#0f1923] p-4 rounded border border-gray-700">
                    <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                             <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#ff4655]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Zaman Sayacı
                             </span>
                             <span className="text-[10px] text-gray-500 font-mono mt-0.5">Her seçim için 30 saniye süre.</span>
                         </div>
                         
                         {/* Toggle Switch */}
                         <div 
                            onClick={() => { playClick(); setSettings({...settings, timer: !settings.timer}); }}
                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 relative ${settings.timer ? 'bg-[#ff4655]' : 'bg-gray-600'}`}
                         >
                             <motion.div 
                                layout
                                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                                className={`w-4 h-4 rounded-full bg-white shadow-md ${settings.timer ? 'ml-auto' : ''}`}
                             />
                         </div>
                    </div>
                    {/* Gelecekte buraya başka ayarlar eklenebilir */}
                </div>
                
                <button 
                    onClick={handleCreateMatch}
                    disabled={loading || previewNames.length < 2}
                    style={{ clipPath: slantClipPath }}
                    className="relative w-full bg-[#ff4655] hover:bg-[#e03e4d] text-white font-black py-5 transition-all transform hover:-translate-y-1 active:translate-y-0 shadow-[0_10px_20px_rgba(255,70,85,0.15)] hover:shadow-[0_15px_30px_rgba(255,70,85,0.3)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-lg overflow-hidden group/btn"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? "SİSTEM BAŞLATILIYOR..." : "LOBİYİ OLUŞTUR"}
                    </span>
                </button>
            </div>

            {/* --- SAĞ PANEL: Önizleme --- */}
            <div className="bg-[#1c252e]/80 border-2 border-gray-800/50 rounded-xl p-6 backdrop-blur-md flex flex-col h-full relative shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:border-[#00e1ff]/30 transition-colors duration-300">
                 {/* Header & Kaptan Slotları */}
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-white/10 pb-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        KADRO LİSTESİ <span className="text-gray-500 text-sm ml-1">({previewNames.length})</span>
                    </h2>
                    
                    <div className="flex gap-3 w-full sm:w-auto">
                        <div className={`flex-1 sm:flex-initial px-4 py-2 rounded text-xs font-bold border-2 transition-all ${captains.A ? 'bg-[#ff4655]/20 border-[#ff4655] text-[#ff4655] shadow-[0_0_15px_rgba(255,70,85,0.2)]' : 'border-dashed border-gray-600 text-gray-500'}`}>
                            {captains.A ? <span className="flex items-center gap-2"><span className="w-2 h-2 bg-[#ff4655]"></span>{captains.A}</span> : 'KAPTAN A [BOŞ]'}
                        </div>
                        <div className={`flex-1 sm:flex-initial px-4 py-2 rounded text-xs font-bold border-2 transition-all ${captains.B ? 'bg-[#00e1ff]/20 border-[#00e1ff] text-[#00e1ff] shadow-[0_0_15px_rgba(0,225,255,0.2)]' : 'border-dashed border-gray-600 text-gray-500'}`}>
                            {captains.B ? <span className="flex items-center gap-2"><span className="w-2 h-2 bg-[#00e1ff]"></span>{captains.B}</span> : 'KAPTAN B [BOŞ]'}
                        </div>
                    </div>
                 </div>
                 
                 {/* Oyuncu Listesi */}
                 <div className="flex-1 bg-[#0f1923]/40 rounded-lg p-1 overflow-y-auto custom-scrollbar border-2 border-black/20 relative">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.01)_10px,rgba(255,255,255,0.01)_20px)] pointer-events-none"></div>

                    {previewNames.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500/50 gap-4">
                            <div className="w-20 h-20 border-4 border-dashed border-gray-600/50 rounded-full flex items-center justify-center animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <p className="text-sm font-mono uppercase tracking-widest">Veri Girişi Bekleniyor...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 p-3 content-start relative z-10">
                            {previewNames.map((name, i) => {
                                let borderColor = "border-gray-700 group-hover:border-gray-400";
                                let bgColor = "bg-[#1c252e] group-hover:bg-[#252f3a]";
                                let textColor = "text-gray-300 group-hover:text-white";
                                let shadow = "";
                                let badge = null;

                                if (captains.A === name) {
                                    borderColor = "border-[#ff4655]";
                                    bgColor = "bg-gradient-to-r from-[#ff4655]/30 to-[#1c252e]";
                                    textColor = "text-white font-black";
                                    shadow = "shadow-[0_0_20px_rgba(255,70,85,0.3)]";
                                    badge = "A";
                                } else if (captains.B === name) {
                                    borderColor = "border-[#00e1ff]";
                                    bgColor = "bg-gradient-to-r from-[#00e1ff]/30 to-[#1c252e]";
                                    textColor = "text-white font-black";
                                    shadow = "shadow-[0_0_20px_rgba(0,225,255,0.3)]";
                                    badge = "B";
                                }

                                return (
                                    <motion.div 
                                        key={name + i}
                                        layout
                                        onClick={() => toggleCaptain(name)}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        whileHover={{ scale: 1.02, x: 2 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`${bgColor} border-l-4 ${borderColor} ${shadow} p-3 rounded-r min-h-[3.5rem] flex items-center gap-3 cursor-pointer select-none transition-all duration-200 group relative overflow-hidden`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black ${badge === 'A' ? 'bg-[#ff4655] text-white' : badge === 'B' ? 'bg-[#00e1ff] text-black' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700 group-hover:text-white'}`}>
                                            {badge || name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className={`font-bold text-sm ${textColor} break-words leading-tight`}>{name}</span>
                                        <div className="absolute inset-0 bg-[url('/scanline.png')] opacity-0 group-hover:opacity-1 mix-blend-overlay pointer-events-none transition-opacity"></div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                 </div>

                 <div className="mt-4 p-3 bg-[#ff4655]/5 border-l-2 border-[#ff4655] flex items-center gap-2 text-[#ff4655] text-[10px] font-bold uppercase tracking-wider">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    <span>İsimlere tıklayarak takım kaptanlarını belirleyebilirsin.</span>
                 </div>
            </div>
          </motion.div>
        ) : (
          // --- LİNKLER EKRANI ---
          <motion.div 
            key="links"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-5xl"
          >
            <div className="text-center mb-16 relative">
                <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]">
                    BAĞLANTI <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4655] to-[#00e1ff] pr-4">MERKEZİ</span>
                </h1>
                <p className="text-gray-400 mt-4 font-mono text-sm tracking-[0.5em] uppercase">MAÇ Başlıyor</p>
                <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent bottom-[-20px]"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 md:px-0">
                {/* TEAM A KART */}
                <div className="bg-[#1c252e] border-[3px] border-[#ff4655] p-8 rounded-xl shadow-[0_0_30px_rgba(255,70,85,0.2)] flex flex-col items-center group relative overflow-hidden hover:-translate-y-2 transition-all duration-300">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#ff4655]/20 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <h2 className="text-5xl font-black text-[#ff4655] mb-1 italic tracking-tighter drop-shadow">TEAM A</h2>
                    <div className="bg-[#ff4655]/10 px-4 py-1 rounded-full border border-[#ff4655]/30 mb-6">
                         <p className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 bg-[#ff4655] rounded-full animate-pulse"></span>
                            Kaptan: {createdMatch.team_a[0]}
                        </p>
                    </div>
                    
                    <p className="text-gray-500 text-xs mb-8 uppercase tracking-[0.3em] font-mono">İyi Oyunlar</p>
                    <button onClick={() => copyLink('A')} style={{clipPath: slantClipPath}} className="relative z-10 w-full bg-[#ff4655] hover:bg-[#ff2435] text-white font-black py-4 transition-all uppercase text-sm tracking-widest shadow-[0_5px_15px_rgba(255,70,85,0.4)] active:scale-95">Kaptan Linkini Kopyala</button>
                </div>

                {/* TEAM B KART */}
                <div className="bg-[#1c252e] border-[3px] border-[#00e1ff] p-8 rounded-xl shadow-[0_0_30px_rgba(0,225,255,0.2)] flex flex-col items-center group relative overflow-hidden hover:-translate-y-2 transition-all duration-300">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#00e1ff]/20 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <h2 className="text-5xl font-black text-[#00e1ff] mb-1 italic tracking-tighter drop-shadow">TEAM B</h2>
                    <div className="bg-[#00e1ff]/10 px-4 py-1 rounded-full border border-[#00e1ff]/30 mb-6">
                         <p className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 bg-[#00e1ff] rounded-full animate-pulse"></span>
                            Kaptan: {createdMatch.team_b[0]}
                        </p>
                    </div>
                    <p className="text-gray-500 text-xs mb-8 uppercase tracking-[0.3em] font-mono">IYI OYUNLAR</p>
                    <button onClick={() => copyLink('B')} style={{clipPath: slantClipPath}} className="relative z-10 w-full bg-[#00e1ff] hover:bg-[#00c8e4] text-[#0f1923] font-black py-4 transition-all uppercase text-sm tracking-widest shadow-[0_5px_15px_rgba(0,225,255,0.4)] active:scale-95">Kaptan Linkini Kopyala</button>
                </div>

                {/* GÖZCÜ KART */}
                <div className="bg-[#1c252e] border-[3px] border-yellow-500 p-8 rounded-xl shadow-[0_0_30px_rgba(234,179,8,0.2)] flex flex-col items-center group relative overflow-hidden hover:-translate-y-2 transition-all duration-300">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <h2 className="text-5xl font-black text-yellow-500 mb-1 italic tracking-tighter drop-shadow">GÖZCÜ</h2>
                    <div className="h-8 mb-6"></div>
                    <p className="text-gray-500 text-xs mb-8 uppercase tracking-[0.3em] font-mono">Yayın / Yönetim</p>
                    <button onClick={() => copyLink('SPEC')} style={{clipPath: slantClipPath}} className="relative z-10 w-full bg-yellow-600 hover:bg-yellow-500 text-white font-black py-4 transition-all uppercase text-sm tracking-widest shadow-[0_5px_15px_rgba(202,138,4,0.4)] active:scale-95">İzleyici Linkini Kopyala</button>
                </div>
            </div>
            
            <div className="mt-20 flex justify-center">
                 <button onClick={() => window.location.reload()} className="group relative px-8 py-4 bg-[#0f1923] border-2 border-gray-700 hover:border-white text-gray-400 hover:text-white rounded-none text-xs font-bold uppercase transition-all backdrop-blur tracking-[0.3em] overflow-hidden">
                    <span className="relative z-10">Yeni Lobi Kur</span>
                    <div className="absolute inset-0 bg-white/10 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
