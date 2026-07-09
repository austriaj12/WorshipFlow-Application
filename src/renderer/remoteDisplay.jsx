import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Music, 
  BookOpen, 
  Sliders, 
  Search, 
  Tv, 
  Check, 
  Activity, 
  Wifi, 
  WifiOff,
  ChevronRight,
  ChevronLeft,
  Eye,
  Send,
  AlertCircle
} from 'lucide-react';
import './index.css';

function RemoteDisplay() {
  const [activeTab, setActiveTab] = useState('lineup'); // 'lineup' | 'bible' | 'actions'
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [slideData, setSlideData] = useState({
    text: '',
    label: '',
    bgAsset: '',
    blackout: false,
    clearLyrics: false
  });
  const [stageData, setStageData] = useState({
    nextSlideText: '',
    nextSlideLabel: '',
    timerTime: '',
    timerActive: false,
    countdownTime: '',
    countdownActive: false
  });
  const [playlist, setPlaylist] = useState([]);
  const [slides, setSlides] = useState([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(-1);
  const [bibleQuery, setBibleQuery] = useState('');
  const [bibleTranslation, setBibleTranslation] = useState('KJV');
  const [bibleResults, setBibleResults] = useState([]);
  const [selectedPreviewVerse, setSelectedPreviewVerse] = useState(null);

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
          if (message.type === 'slide-update') {
            setSlideData(message.payload);
          } else if (message.type === 'stage-update') {
            setStageData(message.payload);
            if (message.payload.slides) {
              setSlides(message.payload.slides);
            }
            if (message.payload.activeSlideIndex !== undefined) {
              setActiveSlideIndex(message.payload.activeSlideIndex);
            }
          } else if (message.type === 'playlist-update') {
            setPlaylist(message.payload || []);
          } else if (message.type === 'remote-bible-results') {
            setBibleResults(message.payload.results || []);
          }
        } catch (err) {
          console.error('Failed parsing WS message:', err);
        }
      };
      
      ws.onclose = () => {
        setSocketStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 3000); // Auto-reconnect after 3s
      };
      
      socketRef.current = ws;
    }
    
    connect();
    
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const sendCommand = (cmd, data = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-command',
        payload: { command: cmd, ...data }
      }));
    }
  };

  const sendBibleSearch = (query) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-bible-search',
        payload: { query, translation: bibleTranslation }
      }));
    }
  };

  // Switch slides on phone/tablet
  const handleSlideSelect = (index) => {
    sendCommand('select-slide', { index });
  };

  const handlePlaylistItemSelect = (songId) => {
    sendCommand('select-playlist-item', { songId });
  };

  const handleSendScripture = (vs) => {
    sendCommand('send-scripture', { 
      text: vs.text, 
      reference: `${vs.book_name} ${vs.chapter}:${vs.verse} (${vs.translation})`
    });
  };

  const formatRemoteBgUrl = (bgAsset) => {
    if (!bgAsset) return '';
    if (bgAsset.startsWith('#')) return '';
    const cleanPath = bgAsset.replace(/^worshipflow-asset:\/\/|^file:\/\/\//, '');
    return `${window.location.protocol}//${window.location.host}/local-asset/${encodeURIComponent(cleanPath)}`;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0f19] text-slate-100 font-sans safe-bottom">
      
      {/* 1. FIXED TOP: LIVE PREVIEW HEADER */}
      <header className="flex-shrink-0 bg-[#111827]/90 border-b border-slate-800 p-3.5 flex flex-col gap-2 shadow-lg backdrop-blur-md z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400">
              {socketStatus === 'connected' ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-900/50 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-red-400 font-mono">
            <Activity className="h-3 w-3 animate-pulse" /> LIVE SCREEN
          </div>
        </div>
        
        {/* Live Output Preview Box */}
        <div className={`w-full rounded-lg p-3 text-center transition flex flex-col justify-center items-center select-none min-h-[70px] ${
          slideData.blackout 
            ? 'bg-black border border-red-600/40 text-red-500 font-bold font-mono text-xs uppercase' 
            : 'bg-[#1e293b]/40 border border-slate-800 text-white font-bold text-sm'
        }`}>
          {slideData.blackout ? (
            '● BLACKOUT ACTIVE'
          ) : (
            <>
              <p className="line-clamp-2 leading-relaxed whitespace-pre-line text-xs uppercase tracking-wide">
                {slideData.clearLyrics ? '' : (slideData.text || '[ No Live Lyrics on Screen ]')}
              </p>
              {slideData.label && !slideData.clearLyrics && (
                <span className="mt-1.5 px-2 py-0.5 rounded bg-brand/10 border border-brand/30 text-[8px] font-mono text-brand font-bold uppercase tracking-wider">
                  {slideData.label}
                </span>
              )}
            </>
          )}
        </div>
      </header>

      {/* 2. MAIN SCROLLABLE CONTENT BODY */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 scrollbar-thin">
        {activeTab === 'lineup' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Quick Overrides Row (BLACKOUT & CLEAR LYRICS) */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => sendCommand('toggle-blackout')}
                className={`py-3.5 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 border transition active:scale-95 min-h-[46px] touch-target ${
                  slideData.blackout 
                    ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-950/40 font-bold' 
                    : 'bg-[#111827] border-slate-800 text-red-500 hover:bg-slate-900/60'
                }`}
              >
                <Tv className="h-4 w-4" /> {slideData.blackout ? 'Live Screen On' : 'Blackout Screen'}
              </button>

              <button
                onClick={() => sendCommand('toggle-clear-lyrics')}
                className={`py-3.5 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 border transition active:scale-95 min-h-[46px] touch-target ${
                  slideData.clearLyrics 
                    ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-950/40 font-bold' 
                    : 'bg-[#111827] border-slate-800 text-amber-500 hover:bg-slate-900/60'
                }`}
              >
                <Eye className="h-4 w-4" /> {slideData.clearLyrics ? 'Show Lyrics' : 'Clear Lyrics'}
              </button>
            </div>

            {/* Active Lyrics Tappable Grid Cards */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Current Presentation Lyrics</h4>
              {slides.length > 0 && !slideData.blackout ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {slides.map((slide, index) => {
                    const isActive = index === activeSlideIndex;
                    const bgUrl = formatRemoteBgUrl(slide.bgAsset || (slide.style && slide.style.background));
                    
                    return (
                      <div 
                        key={index}
                        onClick={() => handleSlideSelect(index)}
                        style={{
                          backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                        className={`p-3 rounded-lg border text-center flex flex-col justify-between items-center cursor-pointer transition select-none active:scale-[0.98] min-h-[90px] relative overflow-hidden touch-target ${
                          isActive 
                            ? 'border-brand ring-2 ring-brand/35 text-white' 
                            : 'border-slate-800 text-slate-300'
                        }`}
                      >
                        {/* Dark semi-transparent overlay to ensure text is highly readable over visual slide backgrounds */}
                        <div className={`absolute inset-0 z-0 transition ${
                          isActive ? 'bg-[#0f172a]/70' : bgUrl ? 'bg-black/60' : 'bg-[#111827]'
                        }`} />

                        <div className="flex-1 flex items-center justify-center z-10 w-full">
                          <p className="text-[9px] uppercase font-bold leading-relaxed line-clamp-3 whitespace-pre-wrap text-center w-full select-none text-shadow-sm text-slate-100">
                            {slide.text}
                          </p>
                        </div>
                        {slide.label && (
                          <span className={`mt-1.5 px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider z-10 ${
                            isActive ? 'bg-brand text-slate-900 font-extrabold' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {slide.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-slate-800/60 bg-slate-900/30 text-center text-slate-500 text-xs font-medium">
                  No active slides found. Select a song from the playlist below.
                </div>
              )}
            </div>

            {/* Service Flow / Playlist Items */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Service Playlist Items</h4>
              <div className="space-y-1.5">
                {playlist.map((item) => {
                  const isCurrent = slideData.text && item.name === slideData.label; // Simple matched name highlight
                  return (
                    <div
                      key={item.id}
                      onClick={() => handlePlaylistItemSelect(item.song_id)}
                      className={`p-3 rounded-lg border cursor-pointer active:scale-[0.99] transition flex items-center justify-between gap-3 min-h-[48px] touch-target ${
                        isCurrent 
                          ? 'bg-brand/10 border-brand/40 text-brand' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Music className={`h-4 w-4 flex-shrink-0 ${isCurrent ? 'text-brand' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold truncate">{item.name}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bible' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search Input */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                sendBibleSearch(bibleQuery);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search Bible (e.g. John 3:16 or Faith)..."
                  value={bibleQuery}
                  onChange={(e) => setBibleQuery(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand min-h-[44px]"
                />
              </div>
              <button 
                type="submit"
                className="px-4 bg-brand hover:bg-brand/90 text-white font-bold rounded-lg text-xs flex items-center justify-center min-h-[44px] min-w-[70px] touch-target"
              >
                Search
              </button>
            </form>

            {/* Preview Selected Verse Drawer */}
            {selectedPreviewVerse && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 font-mono">VERSE PREVIEW</span>
                  <span className="text-xs font-bold text-emerald-300">
                    {selectedPreviewVerse.book_name} {selectedPreviewVerse.chapter}:{selectedPreviewVerse.verse}
                  </span>
                </div>
                <p className="text-xs italic leading-relaxed text-slate-300">
                  "{selectedPreviewVerse.text}"
                </p>
                <button 
                  onClick={() => handleSendScripture(selectedPreviewVerse)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-slate-900 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition min-h-[44px] touch-target"
                >
                  <Send className="h-4 w-4" /> Send to Live Projector
                </button>
              </div>
            )}

            {/* Results list */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Verses Found ({bibleResults.length})</h4>
              <div className="space-y-2">
                {bibleResults.map((vs, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setSelectedPreviewVerse(vs)}
                    className={`p-3 rounded-lg border text-left cursor-pointer active:bg-slate-800 transition space-y-1.5 ${
                      selectedPreviewVerse && selectedPreviewVerse.text === vs.text
                        ? 'bg-slate-800/80 border-emerald-500/40' 
                        : 'bg-slate-900/40 border-slate-800/80'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-brand uppercase font-mono">
                        {vs.book_name} {vs.chapter}:{vs.verse}
                      </span>
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase border border-slate-700">
                        {vs.translation}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">{vs.text}</p>
                  </div>
                ))}
                {bibleResults.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                    Search above by reference or keyword (e.g. Genesis 1:1, John 3, or Grace).
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Quick Actions Panel */}
            <div className="bg-appPanel/20 border border-slate-800 p-4 rounded-xl space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Projector Overrides</h4>
              <div className="grid grid-cols-1 gap-3">
                
                {/* BLACKOUT OVERRIDE */}
                <button
                  onClick={() => sendCommand('toggle-blackout')}
                  className={`w-full py-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition shadow-lg active:scale-95 touch-target ${
                    slideData.blackout 
                      ? 'bg-red-600 border-red-500 text-white shadow-red-950/40' 
                      : 'bg-slate-900 border-slate-800 text-red-500 hover:bg-slate-800/80'
                  }`}
                >
                  <Tv className="h-4 w-4" /> {slideData.blackout ? 'Disable Blackout' : 'Blackout Screen'}
                </button>

                {/* HIDE LYRICS OVERRIDE */}
                <button
                  onClick={() => sendCommand('toggle-clear-lyrics')}
                  className={`w-full py-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition shadow-lg active:scale-95 touch-target ${
                    slideData.clearLyrics 
                      ? 'bg-amber-600 border-amber-500 text-white shadow-amber-950/40' 
                      : 'bg-slate-900 border-slate-800 text-amber-500 hover:bg-slate-800/80'
                  }`}
                >
                  <Eye className="h-4 w-4" /> {slideData.clearLyrics ? 'Show Screen Lyrics' : 'Clear Screen Lyrics'}
                </button>
                
              </div>
            </div>

            {/* Quick Navigation Panel */}
            <div className="bg-appPanel/20 border border-slate-800 p-4 rounded-xl space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Display Transitions</h4>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => sendCommand('prev-slide')}
                  className="py-3 px-4 bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-lg text-xs active:scale-95 transition flex items-center justify-center gap-1.5 touch-target"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button 
                  onClick={() => sendCommand('next-slide')}
                  className="py-3 px-4 bg-slate-900 border border-slate-800 text-slate-300 font-bold rounded-lg text-xs active:scale-95 transition flex items-center justify-center gap-1.5 touch-target"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. FIXED BOTTOM NAVIGATION TABS */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a] border-t border-slate-800 flex items-center justify-around h-16 shadow-2xl z-40">
        
        {/* TAB 1: PRESENTATION ORDER */}
        <button 
          onClick={() => setActiveTab('lineup')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition touch-target ${
            activeTab === 'lineup' ? 'text-brand font-bold' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <Music className="h-4 w-4" />
          <span className="text-[9px] uppercase tracking-wider font-mono">Playlist</span>
        </button>

        {/* TAB 2: BIBLE SEARCH */}
        <button 
          onClick={() => setActiveTab('bible')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition touch-target ${
            activeTab === 'bible' ? 'text-brand font-bold' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span className="text-[9px] uppercase tracking-wider font-mono">Bible</span>
        </button>

        {/* TAB 3: LIVE OVERRIDES */}
        <button 
          onClick={() => setActiveTab('actions')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition touch-target ${
            activeTab === 'actions' ? 'text-brand font-bold' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span className="text-[9px] uppercase tracking-wider font-mono">Actions</span>
        </button>

      </nav>
      
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RemoteDisplay />
  </React.StrictMode>
);
