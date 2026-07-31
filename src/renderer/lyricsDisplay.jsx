import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Music, 
  Layers,
  RotateCcw,
  Maximize2,
  Edit3,
  FileText,
  StickyNote,
  Trash2,
  X
} from 'lucide-react';
import './index.css';
import { KEYS, getSemitoneDifference, parseChordChartToSections, parseLineToWordBlocks, isFlatKey } from '../utils/chordUtils.js';

// Label style helper for clean badges
const getLabelBadgeStyle = (label = '') => {
  const norm = label.toUpperCase();
  if (norm.includes('VERSE')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (norm.includes('CHORUS') && !norm.includes('PRE') && !norm.includes('POST')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (norm.includes('PRE-CHORUS')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (norm.includes('POST-CHORUS')) return 'bg-emerald-50 text-emerald-800 border-emerald-300';
  if (norm.includes('BRIDGE')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (norm.includes('INTRO')) return 'bg-slate-100 text-slate-700 border-slate-300';
  if (norm.includes('OUTRO')) return 'bg-slate-100 text-slate-700 border-slate-300';
  if (norm.includes('INTERLUDE') || norm.includes('TURNAROUND')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
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
  const isCustomView = !!customViewSong;

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

  // Leader Notes state
  const [leaderNotes, setLeaderNotes] = useState('');
  const [isEditNotesOpen, setIsEditNotesOpen] = useState(false);
  const [editingNotesText, setEditingNotesText] = useState('');

  const activeSongId = isCustomView ? (customViewSong?.id || customViewSong?.title) : (stageData.songId || stageData.id || stageData.songTitle || stageData.label);

  // Load Leader Notes from localStorage whenever active song changes
  useEffect(() => {
    if (!activeSongId) {
      setLeaderNotes('');
      return;
    }
    try {
      const saved = localStorage.getItem(`worshipflow_notes_${activeSongId}`);
      setLeaderNotes(saved || '');
    } catch (e) {
      setLeaderNotes('');
    }
  }, [activeSongId]);

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

  const handleOpenMobileEditNotes = () => {
    setEditingNotesText(leaderNotes || '');
    setIsEditNotesOpen(true);
  };

  const handleSaveMobileNotes = () => {
    if (activeSongId) {
      try {
        localStorage.setItem(`worshipflow_notes_${activeSongId}`, editingNotesText);
      } catch (e) {}
    }
    setLeaderNotes(editingNotesText);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'client-update-notes',
        payload: {
          songId: activeSongId,
          notes: editingNotesText
        }
      }));
    }

    setIsEditNotesOpen(false);
  };

  const handleDeleteMobileNotes = () => {
    if (window.confirm("Are you sure you want to delete the leader notes for this song?")) {
      if (activeSongId) {
        try {
          localStorage.removeItem(`worshipflow_notes_${activeSongId}`);
        } catch (e) {}
      }
      setLeaderNotes('');
      setEditingNotesText('');

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'client-update-notes',
          payload: {
            songId: activeSongId,
            notes: ''
          }
        }));
      }

      setIsEditNotesOpen(false);
    }
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

  // Raw chords text from custom view or active presentation stageData
  const rawChordsText = isCustomView ? customViewSong?.chords_text : (stageData.chordsText || '');

  // Detect if the active musical key is a Flat Key (e.g. Db, Eb, F, Gb, Ab, Bb)
  const preferFlats = useMemo(() => isFlatKey(selectedKey || activeSongKey), [selectedKey, activeSongKey]);

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

  // Unified Sequential Sections (Preserves exact chronological order of Intro, Verses, Post-Chorus, Turnaround, Bridge, Outro)
  const unifiedSequentialSections = useMemo(() => {
    if (!showChords || !rawChordsText || !rawChordsText.trim()) {
      return (groupedSections || []).map(g => ({ type: 'lyrics', group: g }));
    }

    const parsedChords = parseChordChartToSections(rawChordsText, transposeSteps, '', preferFlats);
    if (!parsedChords || parsedChords.length === 0) {
      return (groupedSections || []).map(g => ({ type: 'lyrics', group: g }));
    }

    // Index presentation lyrics by base norm label (e.g. "VERSE" -> [Verse1Group, Verse2Group])
    const lyricGroupsMap = {};
    const usedGroupIndices = new Set();

    (groupedSections || []).forEach((group, gIdx) => {
      const baseNorm = group.normLabel.replace(/[\d\s]+$/, '').trim().toUpperCase();
      if (!lyricGroupsMap[baseNorm]) lyricGroupsMap[baseNorm] = [];
      lyricGroupsMap[baseNorm].push({ group, gIdx });
      if (!lyricGroupsMap[group.normLabel]) lyricGroupsMap[group.normLabel] = [];
      lyricGroupsMap[group.normLabel].push({ group, gIdx });
    });

    const unified = [];

    parsedChords.forEach(cSec => {
      const cNorm = cSec.label.replace(/[\d\s]+$/, '').trim().toUpperCase();
      const matchedGroups = lyricGroupsMap[cNorm] || lyricGroupsMap[cSec.label.toUpperCase()];
      const hasLyrics = cSec.pairs.some(p => p.lyrics && p.lyrics.trim());

      if (matchedGroups && matchedGroups.length > 0) {
        // Render matching presentation lyrics sections with overlaid chords
        matchedGroups.forEach(({ group, gIdx }) => {
          if (!usedGroupIndices.has(gIdx)) {
            usedGroupIndices.add(gIdx);
            unified.push({
              type: 'lyrics',
              group,
              chordLines: cSec.pairs.map(p => p.chords).filter(Boolean)
            });
          }
        });
      } else if (!hasLyrics) {
        // Standalone instrumental chord section (Intro, Post-Chorus, Turnaround, Outro)
        unified.push({
          type: 'instrumental',
          sec: cSec
        });
      }
    });

    // Append any remaining presentation lyrics sections that were not in chord chart
    (groupedSections || []).forEach((group, gIdx) => {
      if (!usedGroupIndices.has(gIdx)) {
        unified.push({
          type: 'lyrics',
          group,
          chordLines: []
        });
      }
    });

    return unified;
  }, [showChords, rawChordsText, transposeSteps, preferFlats, groupedSections]);

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
        {unifiedSequentialSections.length > 0 ? (
          <div className="flex flex-col">
            <div className="columns-1 md:columns-2 gap-3 sm:gap-4 space-y-2.5 sm:space-y-3">
              {unifiedSequentialSections.map((uItem, uIdx) => {
                if (uItem.type === 'instrumental') {
                  const sec = uItem.sec;
                  return (
                    <div key={uIdx} className="break-inside-avoid flex flex-col p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 mb-2 sm:mb-2.5 shadow-sm">
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-amber-200/50">
                        <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase tracking-wider ${getLabelBadgeStyle(sec.label)}`}>
                          {sec.label} (Instrumental / Chords)
                        </span>
                      </div>
                      <div className="space-y-1 pt-0.5 font-mono text-amber-700 font-black text-[11px] sm:text-xs leading-relaxed">
                        {sec.pairs.map((p, pIdx) => (
                          <div key={pIdx}>{p.chords}</div>
                        ))}
                      </div>
                    </div>
                  );
                }

                const group = uItem.group;
                const chordLines = uItem.chordLines || [];

                return (
                  <div
                    key={uIdx}
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
                            {rawLines.map((lineStr, lineIdx) => {
                              const assignedChord = (showChords && chordLines.length > 0) ? (chordLines[lineIdx % chordLines.length] || '') : '';
                              const blocks = (showChords && assignedChord) ? parseLineToWordBlocks(assignedChord, lineStr) : [];

                              if (showChords && blocks.length > 0) {
                                return (
                                  <div key={lineIdx} className="flex flex-wrap items-end mb-1.5 last:mb-0">
                                    {blocks.map((b, bIdx) => (
                                      <div key={bIdx} className="inline-flex flex-col items-start whitespace-pre">
                                        <span className="font-mono text-amber-600 font-black text-[11px] sm:text-xs leading-none h-[1.15em] select-none">
                                          {b.chord || ' '}
                                        </span>
                                        <span className="text-[10px] sm:text-[11px] md:text-xs font-extrabold text-slate-900 leading-tight uppercase font-sans">
                                          {b.text}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }

                              return (
                                <p key={lineIdx} className="text-[10px] sm:text-[11px] md:text-xs font-extrabold text-slate-900 leading-tight uppercase tracking-normal font-sans mb-1 last:mb-0">
                                  {lineStr}
                                </p>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* LEADER NOTES CARD AT THE BOTTOM OF THE SONG SECTIONS */}
            {leaderNotes && leaderNotes.trim() && (
              <div className="mt-6 mb-2 p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-slate-900 font-sans shadow-sm break-inside-avoid">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-500/20">
                  <div className="flex items-center gap-2 font-mono font-black text-xs uppercase text-amber-700 tracking-wider">
                    <FileText className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span>Leader Notes / Service Cues</span>
                  </div>
                  <button 
                    onClick={handleOpenMobileEditNotes}
                    className="p-1 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-500/20 transition active:scale-95"
                    title="Edit Notes"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs sm:text-sm font-semibold whitespace-pre-wrap leading-relaxed text-slate-800 font-sans">
                  {leaderNotes}
                </p>
              </div>
            )}
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

      {/* Floating Action Button (FAB) for Leader Notes */}
      <button
        onClick={handleOpenMobileEditNotes}
        className="fixed bottom-14 right-3 z-40 p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg border border-emerald-400/30 active:scale-95 transition flex items-center justify-center"
        title="Open Worship Leader Notes"
      >
        <FileText className="h-4 w-4" />
      </button>

      {/* --- ULTRA-MODERN MINIMALIST LEADER NOTES MODAL --- */}
      {isEditNotesOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl border border-slate-100 shadow-2xl p-5 flex flex-col gap-4">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">Leader Notes</h3>
                  <p className="text-[11px] font-medium text-slate-400 mt-1 truncate max-w-[220px]">{currentSongTitle}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditNotesOpen(false)} 
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Textarea Input */}
            <textarea
              rows="6"
              value={editingNotesText}
              onChange={e => setEditingNotesText(e.target.value)}
              placeholder="Add leader notes, arrangement cues, or key changes for this song..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl font-sans text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition leading-relaxed resize-none"
            ></textarea>

            {/* Modal Footer Actions */}
            <div className="flex justify-between items-center pt-2">
              {leaderNotes && leaderNotes.trim() ? (
                <button
                  onClick={handleDeleteMobileNotes}
                  className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition active:scale-95 border border-rose-100"
                  title="Delete Leader Notes"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditNotesOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMobileNotes}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
                >
                  Save Notes
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

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
