import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Music, 
  Layers
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

  // Group consecutive slides that share the same section label (e.g. VERSE 1, CHORUS, BRIDGE)
  const groupedSections = useMemo(() => {
    if (!slidesToRender || slidesToRender.length === 0) return [];
    
    const groups = [];
    let currentGroup = null;

    slidesToRender.forEach((slide, index) => {
      const rawLabel = (slide.label || 'VERSE').trim();
      const normLabel = rawLabel.toUpperCase();

      if (currentGroup && currentGroup.normLabel === normLabel) {
        currentGroup.slideIndices.push(index);
        if (slide.text) {
          currentGroup.texts.push({ text: slide.text, slideIndex: index });
        }
      } else {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          label: rawLabel,
          normLabel: normLabel,
          slideIndices: [index],
          texts: slide.text ? [{ text: slide.text, slideIndex: index }] : []
        };
      }
    });

    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [slidesToRender]);

  // Auto scroll active section/slide into view
  useEffect(() => {
    if (activeIndex >= 0 && !customViewSlides) {
      const activeEl = document.getElementById(`lyrics-active-slide-${activeIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeIndex, customViewSlides]);

  // Select playlist song from bottom bar
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

  const currentSongTitle = selectedSongTitle || stageData.label || (slidesToRender.length > 0 ? (slidesToRender[0]?.label || 'Worship Song') : 'Worship Song');

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-slate-900 font-sans select-none overflow-hidden pb-14">
      
      {/* --- COMPRESSED CLEAN HEADER --- */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex-shrink-0">
            <Music className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs md:text-sm font-extrabold text-slate-900 truncate tracking-tight uppercase">
              {currentSongTitle}
            </h1>
            <p className="text-[9px] text-slate-500 font-mono font-semibold flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full inline-block ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {socketStatus === 'connected' ? 'Prompter Live' : 'Connecting...'}
            </p>
          </div>
        </div>

        {/* Live Status Overrides */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {slideData.blackout && (
            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[9px] uppercase tracking-wider animate-pulse">
              BLACKOUT
            </span>
          )}
          {slideData.clearLyrics && !slideData.blackout && (
            <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-mono font-bold text-[9px] uppercase tracking-wider">
              CLEAR
            </span>
          )}
        </div>
      </header>

      {/* --- COMPRESSED 2-COLUMN GROUPED LYRICS CONTENT --- */}
      <main className="flex-1 overflow-y-auto p-2.5 pb-16 scrollbar-thin bg-white">
        {groupedSections.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 items-start">
            {groupedSections.map((group, groupIdx) => {
              const isGroupActive = group.slideIndices.includes(activeIndex);

              return (
                <div
                  key={groupIdx}
                  className="flex flex-col p-1 bg-transparent border-0"
                >
                  {/* Section Label Header */}
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase tracking-wider ${getLabelBadgeStyle(group.label)}`}>
                      {group.label}
                    </span>
                    {isGroupActive && (
                      <span className="text-[9px] font-mono font-extrabold text-emerald-600 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                        ● LIVE
                      </span>
                    )}
                  </div>

                  {/* Section Lyrics Text */}
                  <div className="space-y-1.5 pt-0.5">
                    {group.texts.map((item, textIdx) => {
                      const isSlideActive = item.slideIndex === activeIndex;

                      return (
                        <div
                          key={textIdx}
                          id={`lyrics-active-slide-${item.slideIndex}`}
                          className={`transition-all duration-200 ${
                            isSlideActive
                              ? 'p-1 rounded bg-emerald-500/10 border-l-4 border-emerald-600 pl-2'
                              : 'py-0.5 px-0.5'
                          }`}
                        >
                          <p className="text-[11px] sm:text-xs md:text-sm font-extrabold text-slate-900 leading-snug whitespace-pre-line uppercase tracking-normal font-sans">
                            {item.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl p-8 text-center my-4">
            <Music className="h-8 w-8 text-slate-300 mb-2 stroke-1" />
            <h3 className="text-xs font-bold text-slate-700">No Song Selected in Presentation</h3>
            <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
              Select a song from the bottom lineup bar below or wait for the operator to trigger a presentation.
            </p>
          </div>
        )}
      </main>

      {/* --- COMPRESSED FIXED BOTTOM LINEUP BAR --- */}
      <footer className="fixed bottom-0 inset-x-0 bg-slate-900 text-white border-t border-slate-800 p-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none z-40">
        <div className="flex items-center gap-1 px-1.5 text-slate-400 text-[9px] font-mono font-bold uppercase tracking-wider flex-shrink-0 border-r border-slate-800 pr-2">
          <Layers className="h-3 w-3 text-emerald-400" />
          <span>Lineup:</span>
        </div>

        {playlist.map((item) => {
          const isSection = item.type === 'section' || (!item.song_id && !item.filepath);
          const isCurrent = stageData.label === item.name;

          if (isSection) {
            return (
              <span key={item.id} className="text-[9px] font-mono font-extrabold uppercase text-emerald-400 px-1.5 flex-shrink-0">
                // {item.name}
              </span>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleSelectPlaylistSong(item)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-sans uppercase tracking-wide flex-shrink-0 transition active:scale-95 flex items-center gap-1 ${
                isCurrent
                  ? 'bg-emerald-500 text-slate-950 shadow ring-1 ring-emerald-400/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
              }`}
            >
              <Music className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{item.name}</span>
            </button>
          );
        })}

        {playlist.length === 0 && (
          <span className="text-[10px] text-slate-500 italic px-2">Lineup is empty</span>
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
