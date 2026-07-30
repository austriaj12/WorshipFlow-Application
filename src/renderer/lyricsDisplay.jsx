import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Music, 
  Layers,
  RotateCcw,
  Maximize2,
  Edit3,
  X
} from 'lucide-react';
import './index.css';
import { KEYS, getSemitoneDifference, parseChordChartToSections } from '../utils/chordUtils.js';

// Label style helper for clean badges
const getLabelBadgeStyle = (label = '') => {
  const norm = (label || '').toUpperCase();
  if (norm.includes('VERSE')) return 'bg-sky-100 text-sky-800 border-sky-300';
  if (norm.includes('PRE')) return 'bg-purple-100 text-purple-800 border-purple-300';
  if (norm.includes('POST')) return 'bg-teal-100 text-teal-800 border-teal-300';
  if (norm.includes('CHORUS')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (norm.includes('REFRAIN')) return 'bg-rose-100 text-rose-800 border-rose-300';
  if (norm.includes('BRIDGE')) return 'bg-amber-100 text-amber-800 border-amber-300';
  if (norm.includes('INTERLUDE') || norm.includes('TAG') || norm.includes('VAMP')) return 'bg-indigo-100 text-indigo-800 border-indigo-300';
  if (norm.includes('INTRO') || norm.includes('OUTRO') || norm.includes('ENDING')) return 'bg-slate-200 text-slate-700 border-slate-300';
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
};

function LyricsDisplay() {
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [stageData, setStageData] = useState({
    text: '',
    label: '',
    slides: [],
    activeSlideIndex: 0,
    chordsText: ''
  });
  const [slideData, setSlideData] = useState({
    text: '',
    label: '',
    blackout: false,
    clearLyrics: false
  });
  const [playlist, setPlaylist] = useState([]);
  
  // Independent Song View states for Mobile (allows worship leader/singer to view ahead without changing projector)
  const [customViewSong, setCustomViewSong] = useState(null); // { id, title, slides, chords_text }

  // Musician Chords & Transposition states
  const [showChords, setShowChords] = useState(() => {
    try {
      return localStorage.getItem('prompter_show_chords') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [selectedKey, setSelectedKey] = useState('C');
  const [transposeSteps, setTransposeSteps] = useState(0);
  const [isEditChordsOpen, setIsEditChordsOpen] = useState(false);
  const [editingChordsText, setEditingChordsText] = useState('');

  const toggleChords = () => {
    setShowChords(prev => {
      const next = !prev;
      try {
        localStorage.setItem('prompter_show_chords', String(next));
      } catch (e) {}
      return next;
    });
  };

  // Handle Key Dropdown selection on mobile (Just like Operator Desktop)
  const handleKeySelect = (targetKey) => {
    setSelectedKey(targetKey);
    const originalKey = isCustomView ? (customViewSong?.key || 'C') : (stageData.songKey || 'C');
    const steps = getSemitoneDifference(originalKey, targetKey);
    setTransposeSteps(steps);
  };

  const handleOpenMobileEditChords = () => {
    const raw = isCustomView ? customViewSong?.chords_text : (stageData.chordsText || '');
    setEditingChordsText(raw || '');
    setIsEditChordsOpen(true);
  };

  const handleSaveMobileChords = () => {
    const activeSongId = isCustomView ? customViewSong?.id : (stageData.songId || stageData.id);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'client-update-chords',
        payload: {
          songId: activeSongId,
          chordsText: editingChordsText,
          key: selectedKey
        }
      }));
    }

    if (isCustomView) {
      setCustomViewSong(prev => prev ? { ...prev, chords_text: editingChordsText } : null);
    } else {
      setStageData(prev => ({ ...prev, chordsText: editingChordsText }));
    }

    setIsEditChordsOpen(false);
  };

  const socketRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const stageDataRef = useRef(null);
  const mainRef = useRef(null);

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
                  slides: parsedSlides,
                  chords_text: song.chords_text || ''
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
  const activeSongKey = isCustomView ? (customViewSong?.key || 'C') : (stageData.songKey || 'C');

  // Auto-sync Key dropdown value and reset transpose when switching songs
  useEffect(() => {
    setSelectedKey(activeSongKey || 'C');
    setTransposeSteps(0);
  }, [activeSongKey, stageData.songTitle, stageData.songId, customViewSong?.id]);

  // Extract presentation lyrics text for fallback auto-merging
  const presentationLyricsRaw = useMemo(() => {
    if (!slidesToRender || slidesToRender.length === 0) return '';
    return slidesToRender.map(s => s.text || '').join('\n');
  }, [slidesToRender]);

  // Parse Chords text into structured Image 1 & Image 2 sections
  const rawChordsText = isCustomView ? customViewSong?.chords_text : (stageData.chordsText || '');
  
  const parsedChordSections = useMemo(() => {
    if (!showChords || !rawChordsText) return [];
    return parseChordChartToSections(rawChordsText, transposeSteps, presentationLyricsRaw);
  }, [showChords, rawChordsText, transposeSteps, presentationLyricsRaw]);

  // Create a smart map of (Lyric line text OR section-index) -> chord line text for embedding into presentation lyrics
  const lyricToChordMap = useMemo(() => {
    if (!showChords || !parsedChordSections) return {};
    const map = {};
    parsedChordSections.forEach(sec => {
      sec.pairs.forEach((pair, pairIdx) => {
        if (pair.chords) {
          if (pair.lyrics) {
            const cleanKey = pair.lyrics.trim().toUpperCase();
            map[cleanKey] = pair.chords;
          }
          // Fallback mapping by section & index (e.g. "VERSE 1_0", "CHORUS_1")
          const secKey = `${sec.label}_${pairIdx}`;
          map[secKey] = pair.chords;
        }
      });
    });
    return map;
  }, [showChords, parsedChordSections]);

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

  // Smart Auto-scroll: Works for both Chords: ON and Chords: OFF
  useEffect(() => {
    if (activeIndex >= 0 && !isCustomView && mainRef.current) {
      const mainEl = mainRef.current;

      // 1. First slide special handling: Always scroll all the way to top 0 when operator returns to first slide!
      if (activeIndex === 0) {
        mainEl.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
        return;
      }

      // 2. Subsequent slides handling: Scroll smoothly to upper-center reading spot (not jammed against top)
      const activeEl = document.getElementById(`lyrics-active-slide-${activeIndex}`);
      if (activeEl && mainEl) {
        const activeTop = activeEl.offsetTop;
        const mainScrollTop = mainEl.scrollTop;
        const mainHeight = mainEl.clientHeight;
        const activeHeight = activeEl.offsetHeight;

        const isAbove = activeTop < mainScrollTop + 60;
        const isBelow = (activeTop + activeHeight) > (mainScrollTop + mainHeight - 90);

        if (isAbove || isBelow) {
          // Scroll to upper-center sweet spot (~80px below header, not jammed against top)
          mainEl.scrollTo({
            top: Math.max(0, activeTop - 80),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [activeIndex, isCustomView, showChords]);

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
            slides: parsedSlides,
            chords_text: item.chords_text || '',
            key: item.key || 'C'
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
    
    if (stageData.label && !/^(VERSE|CHORUS|BRIDGE|PRE-CHORUS|POST-CHORUS|REFRAIN|INTERLUDE|TAG|ENDING|INTRO|OUTRO|SLIDE)/i.test(stageData.label)) {
      return stageData.label;
    }
    
    const firstSong = playlist.find(item => item.song_id || item.name);
    if (firstSong) return firstSong.name;
    
    return stageData.label || 'WORSHIPFLOW SONG';
  }, [isCustomView, customViewSong, stageData.songTitle, stageData.label, playlist]);

  // Smart Line-by-Line AI Chord Resolver
  const getChordForLine = (sectionNormLabel, cleanLineText, textIdx, lineIdx) => {
    if (!showChords || !rawChordsText || !rawChordsText.trim() || !parsedChordSections || parsedChordSections.length === 0) return '';

    // 1. Try exact line text match across all parsed chord sections
    for (const sec of parsedChordSections) {
      for (const pair of sec.pairs) {
        if (pair.lyrics && pair.lyrics.trim().toUpperCase() === cleanLineText) {
          if (pair.chords) return pair.chords;
        }
      }
    }

    // 2. Try section-matching search
    const secNorm = sectionNormLabel.replace(/\s*\d+$/, '').trim();
    const matchedSec = parsedChordSections.find(sec => {
      const sNorm = sec.label.replace(/\s*\d+$/, '').trim();
      return sNorm === secNorm || sec.label.includes(secNorm) || secNorm.includes(sNorm);
    }) || parsedChordSections[0];

    if (matchedSec && matchedSec.pairs.length > 0) {
      const flatIndex = textIdx * 2 + lineIdx;
      const pair = matchedSec.pairs[flatIndex % matchedSec.pairs.length];
      return pair ? pair.chords : '';
    }

    return '';
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col h-[100dvh] h-screen w-full max-w-full bg-white text-slate-900 font-sans select-none overflow-hidden touch-pan-y"
    >
      
      {/* --- SLIM COMPACT RESPONSIVE HEADER FOR ALL PHONE / TABLET / IPAD DEVICES --- */}
      <header 
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        className="flex-shrink-0 bg-white border-b border-slate-200 px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between shadow-sm z-30 gap-2.5 w-full"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex-shrink-0">
            <Music className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            {/* SONG TITLE IN TOP HEADER (NO OVERLAP, TRUNCATE CLEANLY) */}
            <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 truncate tracking-tight uppercase leading-snug whitespace-nowrap">
              {currentSongTitle}
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-500 font-mono font-semibold flex items-center gap-1.5 whitespace-nowrap truncate">
              <span className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full inline-block flex-shrink-0 ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="truncate">
                {isCustomView ? (
                  <span className="text-amber-600 font-extrabold uppercase">Leader View</span>
                ) : (
                  socketStatus === 'connected' ? 'Live Sync' : 'Connecting...'
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Chords Toggle, Edit Chords & Key Selector Dropdown */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 whitespace-nowrap">
          <button
            onClick={toggleChords}
            className={`px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-black flex items-center gap-1 transition active:scale-95 border whitespace-nowrap ${
              showChords 
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="Toggle Chords Visibility for Musicians"
          >
            <Music className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
            <span>Chords: {showChords ? 'ON' : 'OFF'}</span>
          </button>

          {showChords && (
            <>
              {/* Key Selector Dropdown (Matches Operator Desktop) */}
              <select
                value={selectedKey}
                onChange={(e) => handleKeySelect(e.target.value)}
                className="bg-amber-500/10 border border-amber-500/30 text-amber-600 font-mono font-extrabold text-[10px] sm:text-xs rounded-lg px-1.5 sm:px-2 py-1 focus:outline-none cursor-pointer whitespace-nowrap"
                title="Select Musical Key for Real-time Transposition"
              >
                {KEYS.map(k => (
                  <option key={k} value={k}>Key: {k}</option>
                ))}
              </select>

              {/* Edit Chords Button on Mobile/Tablet */}
              <button
                onClick={handleOpenMobileEditChords}
                className="p-1 sm:p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 active:scale-95 flex items-center gap-1 text-[10px] font-mono font-bold flex-shrink-0"
                title="Edit Chords directly from Mobile/Tablet"
              >
                <Edit3 className="h-3.5 w-3.5 text-amber-600" />
              </button>
            </>
          )}

          {isCustomView && (
            <button
              onClick={handleReturnToLive}
              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-extrabold text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm transition active:scale-95 animate-pulse flex-shrink-0 whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Sync Live</span>
              <span className="sm:hidden">Live</span>
            </button>
          )}

          <button
            onClick={handleToggleFullscreen}
            className="p-1 sm:p-1.5 text-slate-500 hover:text-slate-900 transition active:scale-95 bg-transparent border-0 flex-shrink-0"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT AREA: CHORDS VIEW vs MASONRY PRESENTATION LYRICS --- */}
      <main ref={mainRef} className="flex-1 overflow-y-auto p-2.5 sm:p-4 pb-32 sm:pb-36 scrollbar-thin bg-white">
        {showChords && parsedChordSections.length > 0 ? (
          /* --- CHORDS: ON (LYRICS WITH CHORDS STACKED LINE-BY-LINE) --- */
          <div className="columns-1 md:columns-2 gap-3 sm:gap-4 space-y-2.5 sm:space-y-3">
            {parsedChordSections.map((sec, secIdx) => (
              <div key={secIdx} className="break-inside-avoid flex flex-col p-1 bg-transparent border-0 mb-2 sm:mb-2.5">
                <div className="flex items-center justify-between pb-0.5 mb-1 border-b border-slate-100">
                  <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase tracking-wider ${getLabelBadgeStyle(sec.label)}`}>
                    {sec.label}
                  </span>
                </div>
                <div className="space-y-2 pt-0.5">
                  {sec.pairs.map((pair, pIdx) => (
                    <div key={pIdx} className="flex flex-col mb-1.5 last:mb-0">
                      {pair.chords && (
                        <div className="font-mono text-amber-500 font-black text-[11px] sm:text-xs leading-tight whitespace-pre tracking-normal">
                          {pair.chords}
                        </div>
                      )}
                      {pair.lyrics && (
                        <p className="text-[10px] sm:text-[11px] md:text-xs font-extrabold text-slate-900 leading-tight uppercase tracking-normal font-sans">
                          {pair.lyrics}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : groupedSections.length > 0 ? (
          /* --- CHORDS: OFF (STANDARD 2-COLUMN PRESENTATION LYRICS) --- */
          <div className="columns-1 md:columns-2 gap-3 sm:gap-4 space-y-2.5 sm:space-y-3">
            {groupedSections.map((group, groupIdx) => {
              return (
                <div
                  key={groupIdx}
                  className="break-inside-avoid flex flex-col p-1 bg-transparent border-0 mb-2 sm:mb-2.5"
                >
                  {/* Section Label Header */}
                  <div className="flex items-center justify-between pb-0.5 mb-0.5 border-b border-slate-100">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase tracking-wider ${getLabelBadgeStyle(group.label)}`}>
                      {group.label}
                    </span>
                  </div>

                  {/* Section Lyrics Text */}
                  <div className="space-y-1.5 pt-0.5">
                    {group.texts.map((item, textIdx) => {
                      const isSlideActive = item.slideIndex === activeIndex;
                      const rawLines = (item.text || '').split('\n').filter(l => l.trim().length > 0);

                      return (
                        <div
                          key={textIdx}
                          id={`lyrics-active-slide-${item.slideIndex}`}
                          className={`scroll-mt-16 transition-all duration-200 flex flex-col ${
                            isSlideActive
                              ? 'p-1 rounded bg-emerald-500/10 border-l-4 border-emerald-600 pl-2'
                              : 'py-0.5 px-0.5'
                          }`}
                        >
                          {rawLines.map((lineStr, lineIdx) => (
                            <p key={lineIdx} className="text-[10px] sm:text-[11px] md:text-xs font-extrabold text-slate-900 leading-tight uppercase tracking-normal font-sans mb-1 last:mb-0">
                              {lineStr}
                            </p>
                          ))}
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

      {/* --- EDIT CHORDS MODAL FOR MOBILE / TABLET (WHITE THEME MATCHING LYRICS.HTML) --- */}
      {isEditChordsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-xl border border-slate-200 p-4 flex flex-col gap-3 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600">
                  <Music className="h-4 w-4" />
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm font-mono text-slate-900">Edit Chords - {currentSongTitle}</h3>
              </div>
              <button onClick={() => setIsEditChordsOpen(false)} className="text-slate-400 hover:text-slate-700 transition p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <textarea
              rows="12"
              value={editingChordsText}
              onChange={e => setEditingChordsText(e.target.value)}
              placeholder="Paste or type chords here..."
              className="w-full p-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg font-mono text-xs focus:border-amber-500 focus:outline-none leading-relaxed"
            ></textarea>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsEditChordsOpen(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMobileChords}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono font-extrabold text-xs rounded-lg shadow-sm transition active:scale-95"
              >
                Save Chords
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FIXED BOTTOM LINEUP BAR (ALWAYS VISIBLE ON ALL MOBILE DEVICES) --- */}
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
