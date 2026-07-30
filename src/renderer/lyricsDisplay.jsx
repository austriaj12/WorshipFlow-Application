import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Music, 
  Layers,
  RotateCcw,
  Maximize2
} from 'lucide-react';
import './index.css';

// Label style helper for clean badges
const getLabelBadgeStyle = (label = '') => {
  const norm = (label || '').toUpperCase();
  if (norm.includes('VERSE')) return 'bg-sky-100 text-sky-800 border-sky-300';
  if (norm.includes('PRE')) return 'bg-purple-100 text-purple-800 border-purple-300';
  if (norm.includes('POST')) return 'bg-teal-100 text-teal-800 border-teal-300';
  if (norm.includes('CHORUS')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (norm.includes('BRIDGE')) return 'bg-amber-100 text-amber-800 border-amber-300';
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
  
  // Independent Song View states for Mobile (allows worship leader/singer to view ahead without changing projector)
  const [customViewSong, setCustomViewSong] = useState(null); // { id, title, slides }

  const socketRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const stageDataRef = useRef(null);

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
            const prev = stageDataRef.current;
            const next = message.payload;

            // ONLY clear custom view if operator actually changed slide or song on desktop!
            if (prev && (prev.activeSlideIndex !== next.activeSlideIndex || prev.songTitle !== next.songTitle)) {
              setCustomViewSong(null);
            }

            setStageData(next);
            stageDataRef.current = next;
          } else if (message.type === 'slide-update') {
            setSlideData(message.payload);
          } else if (message.type === 'playlist-update') {
            setPlaylist(message.payload || []);
          } else if (message.type === 'remote-song-detail') {
            const song = message.payload?.song;
            if (song) {
              try {
                let parsedSlides = [];
                if (typeof song.content_json === 'string') {
                  parsedSlides = JSON.parse(song.content_json || '[]');
                } else if (Array.isArray(song.content_json)) {
                  parsedSlides = song.content_json;
                } else if (Array.isArray(song.slides)) {
                  parsedSlides = song.slides;
                }
                setCustomViewSong({
                  id: song.id,
                  title: song.title || song.name || 'Worship Song',
                  slides: parsedSlides
                });
              } catch (e) {
                console.error('Failed parsing custom song JSON:', e);
              }
            }
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

  const isCustomView = !!customViewSong;
  const slidesToRender = isCustomView ? customViewSong.slides : (stageData.slides || []);
  const activeIndex = isCustomView ? -1 : (stageData.activeSlideIndex !== undefined ? stageData.activeSlideIndex : 0);

  // Group consecutive slides that share the same section label (e.g. VERSE 1, CHORUS, POST-CHORUS, BRIDGE)
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

  // Auto scroll active section/slide into view when in live mode
  useEffect(() => {
    if (activeIndex >= 0 && !isCustomView) {
      const activeEl = document.getElementById(`lyrics-active-slide-${activeIndex}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeIndex, isCustomView]);

  // Select playlist song from bottom bar for INDEPENDENT viewing on mobile (Does NOT change Projector!)
  const handleSelectPlaylistSong = (item) => {
    if (!item) return;

    // 1. INSTANT LOCAL PARSE if content_json is attached to the playlist item
    if (item.content_json) {
      try {
        const parsedSlides = typeof item.content_json === 'string'
          ? JSON.parse(item.content_json)
          : item.content_json;
        if (Array.isArray(parsedSlides) && parsedSlides.length > 0) {
          setCustomViewSong({
            id: item.song_id || item.id,
            title: item.name || item.song_title || 'Worship Song',
            slides: parsedSlides
          });
        }
      } catch (err) {
        console.error('Failed parsing instant playlist content_json:', err);
      }
    }

    // 2. Fetch from backend WebSocket to ensure fresh song content
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-get-song',
        payload: { songId: item.song_id, songTitle: item.name }
      }));
    }
  };

  const handleReturnToLive = () => {
    setCustomViewSong(null);
  };

  // Touch Swipe Gesture handler for fast Next/Previous song navigation
  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;

    // Minimum horizontal swipe distance of 50px
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const playableItems = playlist.filter(item => item.song_id || item.type === 'song' || item.name);
      if (playableItems.length === 0) return;

      const activeTitle = isCustomView ? customViewSong.title : (stageData.songTitle || stageData.label);
      const curIdx = playableItems.findIndex(item => item.name === activeTitle);

      if (deltaX < 0) {
        // Swipe Left -> Next Song in lineup
        const nextIdx = curIdx >= 0 ? (curIdx + 1) % playableItems.length : 0;
        handleSelectPlaylistSong(playableItems[nextIdx]);
      } else {
        // Swipe Right -> Previous Song in lineup
        const prevIdx = curIdx > 0 ? curIdx - 1 : playableItems.length - 1;
        handleSelectPlaylistSong(playableItems[prevIdx]);
      }
    }
  };

  // Toggle Fullscreen View
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Resolve Song Title for Header (ALWAYS displays the real Song Title, NOT section badges)
  const currentSongTitle = useMemo(() => {
    if (isCustomView && customViewSong) return customViewSong.title;
    if (stageData.songTitle) return stageData.songTitle;
    
    if (playlist && playlist.length > 0) {
      const activeItem = playlist.find(item => item.name === stageData.label);
      if (activeItem) return activeItem.name;
    }
    
    if (stageData.label && !/^(VERSE|CHORUS|BRIDGE|PRE-CHORUS|POST-CHORUS|INTRO|OUTRO|SLIDE)/i.test(stageData.label)) {
      return stageData.label;
    }
    
    const firstSong = playlist.find(item => item.song_id || item.name);
    if (firstSong) return firstSong.name;
    
    return stageData.label || 'WORSHIPFLOW SONG';
  }, [isCustomView, customViewSong, stageData.songTitle, stageData.label, playlist]);

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col h-screen w-screen bg-white text-slate-900 font-sans select-none overflow-hidden pb-14 touch-pan-y"
    >
      
      {/* --- COMPRESSED CLEAN HEADER --- */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between shadow-sm z-30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex-shrink-0">
            <Music className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            {/* SONG TITLE IN TOP HEADER */}
            <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 truncate tracking-tight uppercase">
              {currentSongTitle}
            </h1>
            <p className="text-[9px] text-slate-500 font-mono font-semibold flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full inline-block ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {isCustomView ? (
                <span className="text-amber-600 font-bold">Independent Leader View</span>
              ) : (
                socketStatus === 'connected' ? 'Prompter Live Sync' : 'Connecting...'
              )}
            </p>
          </div>
        </div>

        {/* Sync Live Button & Fullscreen Toggle */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isCustomView && (
            <button
              onClick={handleReturnToLive}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm transition active:scale-95 animate-pulse"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Sync Live</span>
            </button>
          )}
          <button
            onClick={handleToggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* --- MAIN 2-COLUMN MASONRY GROUPED LYRICS CONTENT (NATURAL TOP-TO-BOTTOM COLUMN FLOW, NO GAPS) --- */}
      <main className="flex-1 overflow-y-auto p-3 pb-16 scrollbar-thin bg-white">
        {groupedSections.length > 0 ? (
          <div className="columns-1 md:columns-2 gap-4 space-y-4">
            {groupedSections.map((group, groupIdx) => {
              const isGroupActive = group.slideIndices.includes(activeIndex);

              return (
                <div
                  key={groupIdx}
                  className="break-inside-avoid flex flex-col p-1.5 bg-transparent border-0 mb-3"
                >
                  {/* Section Label Header */}
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase tracking-wider ${getLabelBadgeStyle(group.label)}`}>
                      {group.label}
                    </span>
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
          const isCurrent = isCustomView ? customViewSong.title === item.name : currentSongTitle === item.name;

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
              title="View lyrics independently on mobile (Does not affect projector)"
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
