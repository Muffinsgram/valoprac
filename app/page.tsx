"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function Home() {
  const [playerInput, setPlayerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdMatch, setCreatedMatch] = useState<any>(null);
  const [previewNames, setPreviewNames] = useState<string[]>([]);

  // Ses Efektleri
  const sounds = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return { click: new Audio('/click.mp3'), start: new Audio('/match-start.mp3') };
  }, []);

  const playClick = () => { if(sounds) { sounds.click.currentTime=0; sounds.click.play().catch(()=>{}); } };

  // İsimler değiştikçe önizlemeyi güncelle
  useEffect(() => {
    const names = playerInput.split("\n").map(n => n.trim()).filter(n => n !== "");
    setPreviewNames(names);
  }, [playerInput]);

  const handleCreateMatch = async () => {
    playClick();
    if (previewNames.length < 2) { alert("En az 2 isim gir!"); return; }
    setLoading(true);

    // Yapay Bekleme (Heyecan olsun)
    await new Promise(r => setTimeout(r, 1000));

    const shuffled = [...previewNames].sort(() => Math.random() - 0.5);
    const middle = Math.ceil(shuffled.length / 2);
    
    const { data, error } = await supabase
      .from('matches')
      .insert([{ 
          team_a: shuffled.slice(0, middle), 
          team_b: shuffled.slice(middle),
          turn: 'A',
          banned_maps: []
      }]).select().single();

    setLoading(false);
    if (error) alert(error.message);
    else setCreatedMatch(data);
  };

  const copyLink = (type: 'A' | 'B' | 'SPEC') => {
    playClick();
    const baseUrl = window.location.origin + `/match/${createdMatch.id}`;
    let finalUrl = "";
    if (type === 'A') finalUrl = `${baseUrl}?token=${createdMatch.token_a}`;
    else if (type === 'B') finalUrl = `${baseUrl}?token=${createdMatch.token_b}`;
    else finalUrl = `${baseUrl}?token=${createdMatch.token_spectator}`;
    
    navigator.clipboard.writeText(finalUrl);
    alert("Bağlantı kopyalandı!");
  };

  return (
    <div className="min-h-screen bg-[#0f1923] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#ff4655] selection:text-white">
      {/* ARKA PLAN */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <Image src="https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png" alt="bg" fill className="object-cover opacity-20 blur-sm scale-110" priority />
          <div className="absolute inset-0 bg-[#0f1923]/80"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
      </div>
      
      <AnimatePresence mode="wait">
        {!createdMatch ? (
          <motion.div 
            key="form"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -100 }}
            className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* SOL PANEL: Form */}
            <div className="bg-[#1c252e] border border-gray-700 rounded-lg p-8 shadow-2xl relative overflow-hidden flex flex-col h-full">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#ff4655]"></div>
                <h1 className="text-5xl font-black italic text-white mb-2 tracking-tighter">LOBİ <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4655] to-red-500">KURULUMU</span></h1>
                <p className="text-gray-400 mb-8 text-xs font-mono tracking-[0.2em] uppercase">Turnuva Yönetim Paneli</p>
                
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Oyuncu Listesi (Her satıra bir isim)</label>
                    <textarea 
                        className="flex-1 w-full bg-[#0f1923] border border-gray-600 rounded p-4 text-white focus:border-[#ff4655] focus:ring-1 focus:ring-[#ff4655] focus:outline-none resize-none font-mono text-sm transition-all shadow-inner min-h-[300px]"
                        placeholder="Muffinsgram"
                        value={playerInput}
                        onChange={(e) => setPlayerInput(e.target.value)}
                    />
                </div>
                
                <button 
                    onClick={handleCreateMatch}
                    disabled={loading || previewNames.length < 2}
                    className="w-full mt-6 bg-[#ff4655] hover:bg-red-600 text-white font-black py-5 rounded transition-all transform hover:scale-[1.01] shadow-[0_10px_30px_rgba(255,70,85,0.2)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-lg clip-path-slant"
                >
                    {loading ? "SİSTEM BAŞLATILIYOR..." : "LİNK OLUŞTUR"}
                </button>
            </div>

            {/* SAĞ PANEL: Canlı Önizleme (GERİ GELDİ!) */}
            <div className="bg-[#1c252e]/50 border border-gray-700/50 rounded-lg p-8 backdrop-blur-md flex flex-col h-full relative">
                 <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    KADRO ({previewNames.length})
                 </h2>
                 
                 <div className="flex-1 bg-[#0f1923]/50 rounded-lg p-4 overflow-y-auto custom-scrollbar border border-white/5">
                    {previewNames.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            <p className="text-sm font-mono">Oyuncu bekleniyor...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 content-start">
                            {previewNames.map((name, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-[#1c252e] border-l-2 border-[#ff4655] p-3 rounded shadow-lg flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">
                                        {name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-bold text-sm truncate text-gray-200">{name}</span>
                                </motion.div>
                            ))}
                        </div>
                    )}
                 </div>

                 <div className="mt-4 p-4 bg-gradient-to-r from-[#ff4655]/10 to-transparent border border-[#ff4655]/20 rounded text-[#ff4655] text-xs font-bold uppercase tracking-wide">
                    * Takımlar rastgele dağıtılacaktır.
                 </div>
            </div>
          </motion.div>
        ) : (
          // --- LİNKLER EKRANI ---
          <motion.div 
            key="links"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
            className="relative z-10 w-full max-w-5xl"
          >
            <div className="text-center mb-12">
                <h1 className="text-5xl font-black text-white uppercase tracking-tighter italic drop-shadow-2xl">BAĞLANTI MERKEZİ</h1>
                <p className="text-gray-400 mt-2 font-mono text-sm tracking-widest">LİNKLERİ İLGİLİ KAPTANLARA GÖNDERİN</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* A TAKIMI */}
                <div className="bg-[#1c252e] border-t-4 border-[#ff4655] p-8 rounded shadow-2xl flex flex-col items-center group relative overflow-hidden hover:-translate-y-2 transition-transform duration-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#ff4655]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <h2 className="text-5xl font-black text-[#ff4655] mb-2 italic tracking-tighter">TEAM A</h2>
                    <p className="text-gray-500 text-xs mb-8 uppercase tracking-[0.3em]">Kırmızı Taraf</p>
                    <button onClick={() => copyLink('A')} className="relative z-10 w-full bg-[#ff4655] hover:bg-white hover:text-[#ff4655] text-white font-black py-4 rounded transition-all uppercase text-sm tracking-widest shadow-lg clip-path-button">Kaptan Linki</button>
                </div>

                {/* B TAKIMI */}
                <div className="bg-[#1c252e] border-t-4 border-[#00e1ff] p-8 rounded shadow-2xl flex flex-col items-center group relative overflow-hidden hover:-translate-y-2 transition-transform duration-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#00e1ff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <h2 className="text-5xl font-black text-[#00e1ff] mb-2 italic tracking-tighter">TEAM B</h2>
                    <p className="text-gray-500 text-xs mb-8 uppercase tracking-[0.3em]">Mavi Taraf</p>
                    <button onClick={() => copyLink('B')} className="relative z-10 w-full bg-[#00e1ff] hover:bg-white hover:text-[#00e1ff] text-black font-black py-4 rounded transition-all uppercase text-sm tracking-widest shadow-lg clip-path-button">Kaptan Linki</button>
                </div>

                {/* İZLEYİCİ */}
                <div className="bg-[#1c252e] border-t-4 border-yellow-500 p-8 rounded shadow-2xl flex flex-col items-center group relative overflow-hidden hover:-translate-y-2 transition-transform duration-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <h2 className="text-5xl font-black text-yellow-500 mb-2 italic tracking-tighter">GÖZCÜ</h2>
                    <p className="text-gray-500 text-xs mb-8 uppercase tracking-[0.3em]">Yayın / Yönetim</p>
                    <button onClick={() => copyLink('SPEC')} className="relative z-10 w-full bg-yellow-600 hover:bg-white hover:text-yellow-600 text-white font-black py-4 rounded transition-all uppercase text-sm tracking-widest shadow-lg clip-path-button">İzleyici Linki</button>
                </div>
            </div>
            
            <div className="mt-16 flex justify-center">
                 <button onClick={() => window.location.reload()} className="px-8 py-3 bg-black/40 border border-gray-600 text-gray-400 hover:text-white hover:border-white rounded text-xs font-bold uppercase transition-all hover:bg-black/60 backdrop-blur tracking-widest">
                    Yeni Lobi Kur
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}