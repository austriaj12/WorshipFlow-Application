import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Music, 
  BookOpen, 
  ChevronRight, 
  Tv, 
  Check, 
  Layers, 
  Sparkles,
  Eye
} from 'lucide-react';
import './index.css';

// Label style helper for clean badges
const getLabelBadgeStyle = (label = '') => {
  const norm = (label || '').toUpperCase();
  if (norm.includes('VERSE')) return 'bg-sky-100 text-sky-800 border-sky-300';
  if (norm.includes('CHORUS')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (norm.includes('BRIDGE')) return 'bg-amber-100 text-amber-800 border-amber-300';
  if (norm.includes('PRE')) return 'bg-purple-100 text-purple-800 border-purple-300';
  if (norm.includes('INTRO') || norm.includes('OUTRO')) return 'bg-slate-200 text-slate-700 border-slate-300';
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
};

function LyricsDisplay() {
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [stageData, setStageData] = useState({
    text: '',
    label: '',
    slides: [],
    activeSlideIndex: 0
  });
  const [slideData, setSlideData] = useState({
    text: '',
    label: '',
    blackout: false,
    clearLyrics: false
  });
  const [playlist, setPlaylist] = useState([]);
  const [selectedSongTitle, setSelectedSongTitle] = useState('');
  const [customViewSlides, setCustomViewSlides] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    let reconnectTimeout = null;
    
    function connect() {
      setSocketStatus('connecting');
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setSocketStatus('connected');
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'stage-update') {
            setStageData(message.payload);
            // Auto reset custom song view when operator changes slides/song
            setCustomViewSlides(null);
          } else if (message.type === 'slide-update') {
            setSlideData(message.payload);
          } else if (message.type === 'playlist-update') {
            setPlaylist(message.payload || []);
          }
        } catch (err) {
          console.error('Failed parsing WS message:', err);
        }
      };
      
      ws.onclose = () => {
        setSocketStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 3000);
      };
      
      socketRef.current = ws;
    }
    
    connect();
    
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const slidesToRender = customViewSlides || stageData.slides || [];
  const activeIndex = customViewSlides ? -1 : (stageData.activeSlideIndex !== undefined ? stageData.activeSlideIndex : 0);

  // Auto scroll active slide into view
  useEffect(() => {
    if (activeIndex >= 0 && !customViewSlides) {
      const activeCard = document.getElementById(`lyrics-slide-card-${activeIndex}`);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeIndex, customViewSlides]);

  // Request/Select playlist song from bottom bar
  const handleSelectPlaylistSong = (item) => {
    if (!item.song_id) return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-command',
        payload: { command: 'select-playlist-item', songId: item.song_id }
      }));
    }
    setSelectedSongTitle(item.name);
  };

  // Resolve current active song title
  const currentSongTitle = selectedSongTitle || stageData.label || (slidesToRender.length > 0 ? (slidesToRender[0]?.label || 'Worship Song') : 'Worship Song');

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 font-sans select-none overflow-hidden pb-16">
      
      {/* --- CLEAN WHITE HEADER --- */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex-shrink-0">
            <Music className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-slate-900 truncate tracking-tight">
              {currentSongTitle}
            </h1>
            <p className="text-[10px] text-slate-500 font-mono font-semibold flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full inline-block ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {socketStatus === 'connected' ? 'Live Prompter Syncing' : 'Connecting...'}
            </p>
          </div>
        </div>

        {/* Live Status Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {slideData.blackout && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-mono font-bold text-[10px] uppercase tracking-wider animate-pulse">
              BLACKOUT
            </span>
          )}
          {slideData.clearLyrics && !slideData.blackout && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-mono font-bold text-[10px] uppercase tracking-wider">
              CLEAR
            </span>
          )}
        </div>
      </header>

      {/* --- MAIN 2-COLUMN LYRICS CONTENT --- */}
      <main className="flex-1 overflow-y-auto p-4 pb-20 scrollbar-thin">
        {slidesToRender.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {slidesToRender.map((slide, index) => {
              const isActive = index === activeIndex;

              return (
                <div
                  key={index}
                  id={`lyrics-slide-card-${index}`}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col gap-2 relative bg-white ${
                    isActive
                      ? 'border-2 border-emerald-500 bg-emerald-50/70 shadow-lg ring-4 ring-emerald-500/20 translate-y-[-1px]'
                      : 'border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Badge & Slide Number */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-mono font-extrabold uppercase tracking-wider ${getLabelBadgeStyle(slide.label)}`}>
                      {slide.label || `SLIDE ${index + 1}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isActive && (
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 font-mono flex items-center gap-1 animate-pulse">
                          ● CURRENT
                        </span>
                      )}
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        #{index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Formatted Lyrics Text */}
                  <div className="py-1">
                    <p className="text-sm md:text-base font-extrabold text-slate-900 leading-relaxed whitespace-pre-line uppercase tracking-wide font-sans">
                      {slide.text || '[ Instrumental / Blank ]'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center my-8">
            <Music className="h-12 w-12 text-slate-300 mb-3 stroke-1" />
            <h3 className="text-sm font-bold text-slate-700">No Song Selected in Presentation</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Select a song from the bottom lineup bar below or wait for the operator to trigger a presentation.
            </p>
          </div>
        )}
      </main>

      {/* --- FIXED BOTTOM LINEUP SONG SELECTOR BAR --- */}
      <footer className="fixed bottom-0 inset-x-0 bg-slate-900 text-white border-t border-slate-800 p-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none z-40">
        <div className="flex items-center gap-1 px-2 text-slate-400 text-[10px] font-mono font-bold uppercase tracking-wider flex-shrink-0 border-r border-slate-800 pr-3">
          <Layers className="h-3.5 w-3.5 text-emerald-400" />
          <span>Lineup:</span>
        </div>

        {playlist.map((item) => {
          const isSection = item.type === 'section' || (!item.song_id && !item.filepath);
          const isCurrent = stageData.label === item.name;

          if (isSection) {
            return (
              <span key={item.id} className="text-[10px] font-mono font-extrabold uppercase text-emerald-400 px-2 flex-shrink-0">
                // {item.name}
              </span>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleSelectPlaylistSong(item)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans uppercase tracking-wide flex-shrink-0 transition active:scale-95 flex items-center gap-1.5 ${
                isCurrent
                  ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              <span className="truncate max-w-[120px]">{item.name}</span>
            </button>
          );
        })}

        {playlist.length === 0 && (
          <span className="text-xs text-slate-500 italic px-2">Lineup is empty</span>
        )}
      </footer>

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LyricsDisplay />
  </React.StrictMode>
);
