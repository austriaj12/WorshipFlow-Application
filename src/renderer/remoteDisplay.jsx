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
  Plus,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Layout,
  X,
  Compass,
  ArrowRight,
  ChevronRight,
  Send,
  Eye,
  Menu,
  ArrowLeft
} from 'lucide-react';
import './index.css';

// Abbreviations helper
const BOOK_ABBREV = {
  'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num', 'Deuteronomy': 'Deu',
  'Joshua': 'Jos', 'Judges': 'Jdg', 'Ruth': 'Rut', '1 Samuel': '1Sa', '2 Samuel': '2Sa',
  '1 Kings': '1Ki', '2 Kings': '2Ki', '1 Chronicles': '1Ch', '2 Chronicles': '2Ch',
  'Ezra': 'Ezr', 'Nehemiah': 'Neh', 'Esther': 'Est', 'Job': 'Job', 'Psalms': 'Psa', 'Proverbs': 'Pro',
  'Ecclesiastes': 'Ecc', 'Song of Solomon': 'SoS', 'Isaiah': 'Isa', 'Jeremiah': 'Jer',
  'Lamentations': 'Lam', 'Ezekiel': 'Eze', 'Daniel': 'Dan', 'Hosea': 'Hos', 'Joel': 'Joe',
  'Amos': 'Amo', 'Obadiah': 'Oba', 'Jonah': 'Jon', 'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab',
  'Zephaniah': 'Zep', 'Haggai': 'Hag', 'Zechariah': 'Zec', 'Malachi': 'Mal',
  'Matthew': 'Mat', 'Mark': 'Mar', 'Luke': 'Luk', 'John': 'Joh', 'Acts': 'Act',
  'Romans': 'Rom', '1 Corinthians': '1Co', '2 Corinthians': '2Co', 'Galatians': 'Gal',
  'Ephesians': 'Eph', 'Philippians': 'Php', 'Colossians': 'Col',
  '1 Thessalonians': '1Th', '2 Thessalonians': '2Th',
  '1 Timothy': '1Ti', '2 Timothy': '2Ti', 'Titus': 'Tit', 'Philemon': 'Phm',
  'Hebrews': 'Heb', 'James': 'Jas', '1 Peter': '1Pe', '2 Peter': '2Pe',
  '1 John': '1Jo', '2 John': '2Jo', '3 John': '3Jo', 'Jude': 'Jud', 'Revelation': 'Rev'
};

function RemoteDisplay() {
  const [activeTab, setActiveTab] = useState('lineup'); // 'lineup' | 'library' | 'bible' | 'timers'
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [slideData, setSlideData] = useState({
    text: '',
    label: '',
    bgAsset: '',
    isBible: false,
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

  // Song Library tab states
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryResults, setLibraryResults] = useState([]);
  const [selectedLibrarySong, setSelectedLibrarySong] = useState(null);
  const [librarySongSlides, setLibrarySongSlides] = useState([]);

  // Bible tab states
  const [bibleQuery, setBibleQuery] = useState('');
  const [bibleTranslation, setBibleTranslation] = useState('KJV');
  const [bibleResults, setBibleResults] = useState([]);
  const [selectedVerses, setSelectedVerses] = useState([]); // Array of verse numbers selected
  const [bibleVersesList, setBibleVersesList] = useState([]); // List of verses in currently loaded chapter
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [searchResultsActive, setSearchResultsActive] = useState(false);

  // Dynamic Bible Explorer states
  const [bibleBooks, setBibleBooks] = useState([]);
  const [bibleChapters, setBibleChapters] = useState([]);
  const [bibleViewMode, setBibleViewMode] = useState('books'); // 'books' | 'chapters' | 'verses' | 'search'

  // Timers states
  const [timerMinutesInput, setTimerMinutesInput] = useState(5);
  const [timerSecondsInput, setTimerSecondsInput] = useState(0);

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
        // Initial load
        if (activeTab === 'bible') {
          ws.send(JSON.stringify({ type: 'remote-get-bible-books', payload: { translation: bibleTranslation } }));
        }
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
            setBibleViewMode('search');
          } else if (message.type === 'remote-song-results') {
            setLibraryResults(message.payload.results || []);
          } else if (message.type === 'remote-bible-books') {
            setBibleBooks(message.payload.books || []);
          } else if (message.type === 'remote-bible-chapters') {
            setBibleChapters(message.payload.chapters || []);
          } else if (message.type === 'remote-bible-verses') {
            setBibleVersesList(message.payload.verses || []);
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
  }, [activeTab, bibleTranslation]);

  // Request Bible Books on active tab or translation change
  useEffect(() => {
    if (activeTab === 'bible' && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-get-bible-books',
        payload: { translation: bibleTranslation }
      }));
    }
  }, [activeTab, bibleTranslation]);

  const sendCommand = (cmd, data = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-command',
        payload: { command: cmd, ...data }
      }));
    }
  };

  const sendSearch = (type, query) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: type,
        payload: { query, translation: bibleTranslation }
      }));
    }
  };

  // Trigger song search
  const handleSongSearch = (query) => {
    setLibraryQuery(query);
    sendSearch('remote-song-search', query);
  };

  // Trigger Bible search
  const handleBibleSearch = (e) => {
    if (e) e.preventDefault();
    if (!bibleQuery.trim()) return;
    sendSearch('remote-bible-search', bibleQuery);
  };

  // Select Book inside Explorer
  const handleSelectBook = (bookName) => {
    setSelectedBook(bookName);
    setSelectedChapter(1);
    setSelectedVerses([]);
    setBibleChapters([]);
    setBibleViewMode('chapters');
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-get-bible-chapters',
        payload: { translation: bibleTranslation, bookName }
      }));
    }
  };

  // Select Chapter inside Explorer
  const handleSelectChapter = (chapterNum) => {
    setSelectedChapter(chapterNum);
    setSelectedVerses([]);
    setBibleVersesList([]);
    setBibleViewMode('verses');
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'remote-get-bible-verses',
        payload: { translation: bibleTranslation, bookName: selectedBook, chapter: chapterNum }
      }));
    }
  };

  // Go live with selected Bible verses
  const handleGoLiveBible = () => {
    if (selectedVerses.length === 0 || !selectedBook) return;
    
    const sorted = [...selectedVerses].sort((a, b) => a - b);
    const startVerse = sorted[0];
    const endVerse = sorted[sorted.length - 1];
    
    sendCommand('go-live-bible-raw', {
      bookName: selectedBook,
      chapter: selectedChapter,
      startVerse,
      endVerse,
      translation: bibleTranslation
    });
  };

  // Send a library song to live
  const handleSelectPlaylistSong = (songId) => {
    sendCommand('select-playlist-item', { songId });
  };

  // Add library song to playlist lineup
  const handleAddSongToPlaylist = (song) => {
    sendCommand('add-song-to-playlist', {
      songId: song.id,
      songTitle: song.title
    });
  };

  const formatRemoteBgUrl = (bgAsset) => {
    if (!bgAsset) return '';
    if (bgAsset.startsWith('#')) return '';
    const cleanPath = bgAsset.replace(/^worshipflow-asset:\/\/|^file:\/\/\//, '');
    return `${window.location.protocol}//${window.location.host}/local-asset/${encodeURIComponent(cleanPath)}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090d16] text-slate-100 font-sans select-none overflow-hidden pb-16 safe-bottom">
      
      {/* --- PREMIUM APP-LIKE GLASSMORPHIC HEADER --- */}
      <header className="flex-shrink-0 bg-[#0d1527]/90 border-b border-slate-800/80 px-4 py-3.5 flex flex-col gap-2.5 shadow-xl backdrop-blur-lg z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 animate-pulse shadow-md shadow-emerald-500/20' : 'bg-rose-500'}`} />
            <span className="text-[10px] uppercase font-mono font-black tracking-wider text-slate-400">
              {socketStatus === 'connected' ? 'WiFi Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
        
        {/* Live Output Preview Box */}
        <div className={`w-full rounded-xl p-3 text-center transition flex flex-col justify-center items-center shadow-inner relative overflow-hidden ${
          slideData.blackout 
            ? 'bg-black border border-rose-600/40 text-rose-500 font-bold font-mono text-xs uppercase' 
            : 'bg-slate-900/40 border border-slate-800/60 text-white'
        }`}>
          {slideData.blackout ? (
            '● BLACKOUT ACTIVE'
          ) : (
            <>
              <p className="line-clamp-2 leading-relaxed whitespace-pre-line text-xs font-bold uppercase tracking-wide">
                {slideData.clearLyrics ? '' : (slideData.text || '[ Screen Clear ]')}
              </p>
              {slideData.label && !slideData.clearLyrics && (
                <span className="mt-1 px-2.5 py-0.5 rounded bg-brand/10 border border-brand/35 text-[8px] font-mono text-brand font-bold uppercase tracking-wider">
                  {slideData.label}
                </span>
              )}
            </>
          )}
        </div>
      </header>

      {/* --- SCROLLABLE MAIN CONTENT (pb-28 to clear fixed footer) --- */}
      <main className="flex-1 overflow-y-auto p-4 pb-28 space-y-4 scrollbar-thin">
        
        {/* ==================== LINEUP TAB ==================== */}
        {activeTab === 'lineup' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Quick Overrides Row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => sendCommand('toggle-blackout')}
                className={`py-3.5 px-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border transition active:scale-95 touch-target ${
                  slideData.blackout 
                    ? 'bg-rose-600 border-rose-500 text-white shadow-lg' 
                    : 'bg-slate-900 border-slate-800 text-rose-500'
                }`}
              >
                <Tv className="h-4 w-4" /> {slideData.blackout ? 'Live Screen On' : 'Blackout Screen'}
              </button>

              <button
                onClick={() => sendCommand('toggle-clear-lyrics')}
                className={`py-3.5 px-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 border transition active:scale-95 touch-target ${
                  slideData.clearLyrics 
                    ? 'bg-amber-600 border-amber-500 text-white shadow-lg' 
                    : 'bg-slate-900 border-slate-800 text-amber-500'
                }`}
              >
                <Eye className="h-4 w-4" /> {slideData.clearLyrics ? 'Show Lyrics' : 'Clear Lyrics'}
              </button>
            </div>

            {/* Active Slides Grid */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Current Presentation</h4>
              {slides.length > 0 && !slideData.blackout ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {slides.map((slide, index) => {
                    const isActive = index === activeSlideIndex;
                    const bgUrl = formatRemoteBgUrl(slide.bgAsset || (slide.style && slide.style.background));
                    
                    return (
                      <div 
                        key={index}
                        onClick={() => sendCommand('select-slide', { index })}
                        style={{
                          backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                        className={`p-3 rounded-xl border text-center flex flex-col justify-between items-center cursor-pointer transition select-none active:scale-[0.98] min-h-[90px] relative overflow-hidden touch-target ${
                          isActive 
                            ? 'border-brand ring-2 ring-brand/35 text-white' 
                            : 'border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className={`absolute inset-0 z-0 transition ${isActive ? 'bg-[#0f172a]/70' : bgUrl ? 'bg-black/60' : 'bg-slate-900/60'}`} />
                        <div className="flex-1 flex items-center justify-center z-10 w-full">
                          <p className="text-[9px] uppercase font-bold leading-relaxed line-clamp-3 whitespace-pre-wrap text-center w-full select-none text-slate-100">
                            {slide.text}
                          </p>
                        </div>
                        {slide.label && (
                          <span className={`mt-1.5 px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-wider z-10 ${isActive ? 'bg-brand text-slate-900 font-extrabold' : 'bg-slate-800 text-slate-400'}`}>
                            {slide.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-slate-800/60 bg-slate-900/10 text-center text-slate-500 text-xs">
                  No active slides found. Select an item below.
                </div>
              )}
            </div>

            {/* Lineup Presentation items list */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Service Lineup</h4>
              <div className="space-y-1.5">
                {playlist.map((item) => {
                  const isCurrent = slideData.label === item.name;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectPlaylistSong(item.song_id)}
                      className={`p-3.5 rounded-xl border cursor-pointer active:scale-[0.99] transition flex items-center justify-between gap-3 min-h-[48px] touch-target ${
                        isCurrent 
                          ? 'bg-brand/10 border-brand/40 text-brand' 
                          : 'bg-slate-900/40 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Music className={`h-4 w-4 ${isCurrent ? 'text-brand' : 'text-slate-500'}`} />
                        <span className="text-xs font-bold truncate">{item.name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== SONG LIBRARY TAB ==================== */}
        {activeTab === 'library' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search inputs */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Search Song Library..."
                value={libraryQuery}
                onChange={(e) => handleSongSearch(e.target.value)}
                className="w-full bg-[#111827] border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand min-h-[44px]"
              />
            </div>

            {/* Song details / slides overlay preview */}
            {selectedLibrarySong && (
              <div className="p-4 rounded-xl border border-brand/35 bg-brand/5 space-y-3 relative">
                <button 
                  onClick={() => setSelectedLibrarySong(null)} 
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <h3 className="text-sm font-extrabold text-brand uppercase tracking-wide">
                  {selectedLibrarySong.title}
                </h3>
                
                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleSelectPlaylistSong(selectedLibrarySong.id)}
                    className="py-2 px-3 bg-brand text-slate-900 font-bold rounded text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 min-h-[38px]"
                  >
                    <Play className="h-3.5 w-3.5" /> Cast to Live
                  </button>
                  <button 
                    onClick={() => handleAddSongToPlaylist(selectedLibrarySong)}
                    className="py-2 px-3 bg-slate-900 border border-slate-800 text-slate-200 font-bold rounded text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 min-h-[38px]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add to Lineup
                  </button>
                </div>
              </div>
            )}

            {/* Library list results */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Library Songs ({libraryResults.length})</h4>
              <div className="space-y-1.5">
                {libraryResults.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => setSelectedLibrarySong(song)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer active:bg-slate-800 transition min-h-[48px] ${
                      selectedLibrarySong?.id === song.id 
                        ? 'border-brand/40 bg-slate-800/80' 
                        : 'border-slate-800 bg-slate-900/30'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-slate-200">{song.title}</p>
                      {song.author && <p className="text-[9px] text-slate-500 font-medium truncate mt-0.5">{song.author}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </div>
                ))}
                {libraryResults.length === 0 && (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                    Search above to browse or select songs from database.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== BIBLE TAB ==================== */}
        {activeTab === 'bible' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Direct quick exit if already live with bible */}
            {slideData.isBible && (
              <button 
                onClick={() => sendCommand('control-countdown', { action: 'exit-bible' })}
                className="w-full py-3 bg-rose-950/65 border border-rose-800 text-rose-300 font-extrabold rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md animate-pulse min-h-[44px]"
              >
                <X className="h-4 w-4" /> Stop Live Scripture
              </button>
            )}

            {/* Version and Search Form */}
            <form onSubmit={handleBibleSearch} className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={bibleTranslation}
                  onChange={(e) => setBibleTranslation(e.target.value)}
                  className="bg-[#111827] border border-slate-800 rounded-lg text-xs p-2 text-slate-300 focus:outline-none col-span-1 min-h-[44px]"
                >
                  <option value="KJV">KJV</option>
                  <option value="ASV">ASV</option>
                  <option value="NIV">NIV</option>
                  <option value="MBBTAG">MBBTAG</option>
                </select>
                <div className="relative col-span-2">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Search Bible Reference..."
                    value={bibleQuery}
                    onChange={(e) => setBibleQuery(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand min-h-[44px]"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-2.5 bg-brand hover:bg-brand/90 text-slate-900 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md min-h-[44px]"
              >
                <Search className="h-4 w-4" /> Search Scripture
              </button>
            </form>

            {/* Direct Cast control drawer */}
            {selectedVerses.length > 0 && (
              <div className="p-4 rounded-xl border border-emerald-500/35 bg-emerald-950/10 space-y-3 relative shadow-lg">
                <button 
                  onClick={() => setSelectedVerses([])} 
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-widest uppercase">Bible Live Overlay</span>
                  <span className="text-xs font-bold text-emerald-300">
                    {selectedBook} {selectedChapter}:{selectedVerses[0]}
                    {selectedVerses.length > 1 ? `-${selectedVerses[selectedVerses.length - 1]}` : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={handleGoLiveBible}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition min-h-[44px]"
                  >
                    <Send className="h-4 w-4" /> Project Live
                  </button>
                  <button 
                    onClick={() => {
                      sendCommand('control-countdown', { action: 'exit-bible' });
                      setSelectedVerses([]);
                    }}
                    className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition min-h-[44px]"
                  >
                    <X className="h-4 w-4" /> Stop Live
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Books/Chapters/Verses Explorer */}
            {bibleViewMode === 'books' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Books of the Bible</h4>
                  {bibleViewMode !== 'books' && (
                    <button onClick={() => setBibleViewMode('books')} className="text-[10px] text-brand hover:underline font-bold">
                      Books
                    </button>
                  )}
                </div>
                
                {/* List of Books */}
                <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto">
                  {bibleBooks.map((bk, idx) => {
                    const abbrev = BOOK_ABBREV[bk.book_name] || bk.book_name.slice(0, 3);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectBook(bk.book_name)}
                        className="p-3 text-left bg-slate-900/30 border border-slate-800/80 rounded-xl hover:bg-slate-800 transition flex justify-between items-center min-h-[44px]"
                      >
                        <span className="text-xs font-bold text-slate-200 truncate">{bk.book_name}</span>
                        <span className="text-[9px] text-slate-500 font-mono uppercase">{abbrev}</span>
                      </button>
                    );
                  })}
                  {bibleBooks.length === 0 && (
                    <div className="col-span-2 text-center text-slate-500 text-xs py-8">
                      Loading books from database...
                    </div>
                  )}
                </div>
              </div>
            )}

            {bibleViewMode === 'chapters' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setBibleViewMode('books')}
                    className="flex items-center gap-1.5 text-xs text-brand font-bold bg-brand/5 border border-brand/20 px-3 py-1.5 rounded-lg active:scale-95 transition"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" /> Back to Books
                  </button>
                  <span className="text-xs font-bold text-slate-300 font-mono">{selectedBook}</span>
                </div>
                
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Select Chapter</h4>
                
                {/* Chapters Grid */}
                <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto">
                  {bibleChapters.map((ch, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectChapter(ch)}
                      className={`aspect-square flex items-center justify-center rounded-xl text-xs font-bold transition border min-h-[44px] ${
                        selectedChapter === ch
                          ? 'bg-brand text-slate-900 border-brand'
                          : 'bg-slate-900/30 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                  {bibleChapters.length === 0 && (
                    <div className="col-span-5 text-center text-slate-500 text-xs py-8">
                      Loading chapters...
                    </div>
                  )}
                </div>
              </div>
            )}

            {bibleViewMode === 'verses' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setBibleViewMode('chapters')}
                    className="flex items-center gap-1.5 text-xs text-brand font-bold bg-brand/5 border border-brand/20 px-3 py-1.5 rounded-lg active:scale-95 transition"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" /> Back to Chapters
                  </button>
                  <span className="text-xs font-bold text-slate-300 font-mono">{selectedBook} {selectedChapter}</span>
                </div>

                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Select Verses</h4>
                  {selectedVerses.length > 0 && (
                    <button 
                      onClick={() => setSelectedVerses([])}
                      className="text-[10px] text-rose-400 hover:underline uppercase font-bold"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {/* Verses checklist */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {bibleVersesList.map((vs, idx) => {
                    const isSelected = selectedVerses.includes(vs.verse);
                    return (
                      <div 
                        key={idx}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedVerses(selectedVerses.filter(v => v !== vs.verse));
                          } else {
                            setSelectedVerses([...selectedVerses, vs.verse]);
                          }
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex gap-3 items-start min-h-[44px] ${
                          isSelected 
                            ? 'bg-slate-800/80 border-emerald-500/40 text-emerald-400' 
                            : 'bg-slate-900/30 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className={`mt-0.5 flex-shrink-0 h-4.5 w-4.5 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-emerald-500 border-emerald-400 text-slate-900' : 'border-slate-700'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <div className="text-xs leading-relaxed">
                          <span className="font-bold text-brand mr-1.5">{vs.verse}</span>
                          {vs.text}
                        </div>
                      </div>
                    );
                  })}
                  {bibleVersesList.length === 0 && (
                    <div className="text-center text-slate-500 text-xs py-8">
                      Loading verses...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Search results list */}
            {bibleViewMode === 'search' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Verses Found</h4>
                  <button 
                    onClick={() => {
                      setBibleViewMode('books');
                      setBibleQuery('');
                    }}
                    className="text-[10px] text-brand hover:underline uppercase tracking-wide font-bold"
                  >
                    Back to Books
                  </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {bibleResults.map((vs, idx) => {
                    const isSelected = selectedVerses.includes(vs.verse) && selectedBook === vs.book_name && selectedChapter === vs.chapter;
                    return (
                      <div 
                        key={idx}
                        onClick={() => {
                          setSelectedBook(vs.book_name);
                          setSelectedChapter(vs.chapter);
                          if (isSelected) {
                            setSelectedVerses(selectedVerses.filter(v => v !== vs.verse));
                          } else {
                            setSelectedVerses([...selectedVerses, vs.verse]);
                          }
                        }}
                        className={`p-3 rounded-lg border text-left cursor-pointer active:bg-slate-800 transition space-y-1 ${
                          isSelected 
                            ? 'bg-slate-800/80 border-emerald-500/40 text-emerald-400' 
                            : 'bg-slate-900/30 border-slate-800/80'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                          <span className="text-brand">{vs.book_name} {vs.chapter}:{vs.verse}</span>
                          <span className="text-slate-500">{vs.translation}</span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-300">{vs.text}</p>
                      </div>
                    );
                  })}
                  {bibleResults.length === 0 && (
                    <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                      No search results. Check spelling or try reference (e.g. Genesis 1).
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TIMERS TAB ==================== */}
        {activeTab === 'timers' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Live Timers display card */}
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4 shadow-xl text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Real-time Timers Sync</span>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Countdown display */}
                <div className="bg-[#111827] border border-slate-800/60 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Countdown</span>
                  <p className="text-2xl font-black text-brand font-mono">
                    {stageData.countdownTime || '00:00'}
                  </p>
                  <span className={`text-[8px] font-bold uppercase ${stageData.countdownActive ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {stageData.countdownActive ? '● Running' : 'Stopped'}
                  </span>
                </div>

                {/* Count-up timer display */}
                <div className="bg-[#111827] border border-slate-800/60 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Service Timer</span>
                  <p className="text-2xl font-black text-sky-400 font-mono">
                    {stageData.timerTime || '00:00'}
                  </p>
                  <span className={`text-[8px] font-bold uppercase ${stageData.timerActive ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {stageData.timerActive ? '● Running' : 'Stopped'}
                  </span>
                </div>
              </div>
            </div>

            {/* Countdown Controls Form */}
            <div className="bg-appPanel/10 border border-slate-800 p-4 rounded-2xl space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Countdown Controls</h4>
              
              <div className="flex gap-2 items-center">
                <input 
                  type="number"
                  min="0"
                  max="120"
                  value={timerMinutesInput}
                  onChange={(e) => setTimerMinutesInput(parseInt(e.target.value) || 0)}
                  className="bg-[#111827] border border-slate-800 rounded-lg p-2.5 text-center text-sm font-bold font-mono text-slate-200 flex-1 min-h-[44px]"
                  placeholder="Min"
                />
                <span className="font-bold text-slate-500 font-mono">:</span>
                <input 
                  type="number"
                  min="0"
                  max="59"
                  value={timerSecondsInput}
                  onChange={(e) => setTimerSecondsInput(parseInt(e.target.value) || 0)}
                  className="bg-[#111827] border border-slate-800 rounded-lg p-2.5 text-center text-sm font-bold font-mono text-slate-200 flex-1 min-h-[44px]"
                  placeholder="Sec"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => sendCommand('control-countdown', { action: 'set-countdown', minutes: timerMinutesInput, seconds: timerSecondsInput })}
                  className="py-2 px-3 bg-slate-900 border border-slate-800 text-slate-200 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  Set Duration
                </button>
                <button
                  onClick={() => sendCommand('control-countdown', { action: 'exit-bible' })}
                  className="py-2 px-3 bg-slate-900 border border-slate-800 text-rose-500 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  Exit Scripture Live
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => sendCommand('control-countdown', { action: 'start-countdown' })}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Play className="h-4 w-4 fill-current" /> Start Countdown
                </button>
                <button
                  onClick={() => sendCommand('control-countdown', { action: 'stop-countdown' })}
                  className="py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Pause className="h-4 w-4 fill-current" /> Stop Countdown
                </button>
              </div>
            </div>

            {/* Service Timer Controls */}
            <div className="bg-appPanel/10 border border-slate-800 p-4 rounded-2xl space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Service Timer Controls</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => sendCommand('control-countdown', { action: 'start-timer' })}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Play className="h-4 w-4 fill-current" /> Start Timer
                </button>
                <button
                  onClick={() => sendCommand('control-countdown', { action: 'stop-timer' })}
                  className="py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <Pause className="h-4 w-4 fill-current" /> Stop Timer
                </button>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* --- GLASSMORPHIC TABS FOOTER --- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#070b12]/95 border-t border-slate-800 flex items-center justify-around h-16 shadow-2xl z-40 backdrop-blur-md">
        <button 
          onClick={() => setActiveTab('lineup')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition ${
            activeTab === 'lineup' ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <Music className="h-4.5 w-4.5" />
          <span className="text-[9px] uppercase tracking-wider font-mono">Lineup</span>
        </button>

        <button 
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition ${
            activeTab === 'library' ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <Compass className="h-4.5 w-4.5" />
          <span className="text-[9px] uppercase tracking-wider font-mono">Library</span>
        </button>

        <button 
          onClick={() => setActiveTab('bible')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition ${
            activeTab === 'bible' ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <BookOpen className="h-4.5 w-4.5" />
          <span className="text-[9px] uppercase tracking-wider font-mono">Bible</span>
        </button>

        <button 
          onClick={() => setActiveTab('timers')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition ${
            activeTab === 'timers' ? 'text-brand font-bold scale-105' : 'text-slate-500 hover:text-slate-400'
          }`}
        >
          <Clock className="h-4.5 w-4.5" />
          <span className="text-[9px] uppercase tracking-wider font-mono">Timers</span>
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
