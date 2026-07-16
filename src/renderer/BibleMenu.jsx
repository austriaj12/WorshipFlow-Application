import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, BookOpen, ChevronRight, ChevronDown, ChevronUp, Plus, Star, Clock,
  Columns2, X, Eye, ArrowLeft, ArrowRight, Hash, Type, Palette,
  AlignLeft, AlignCenter, AlignRight, Trash2, BookMarked, History, LayoutGrid, Send
} from 'lucide-react';

// Standard 66-book Bible ordering with abbreviations and testament grouping
const BIBLE_STRUCTURE = {
  'Old Testament': [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
    'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
    'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
    'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
    'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
  ],
  'New Testament': [
    'Matthew', 'Mark', 'Luke', 'John', 'Acts',
    'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
    'Ephesians', 'Philippians', 'Colossians',
    '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter',
    '1 John', '2 John', '3 John', 'Jude', 'Revelation'
  ]
};

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

const BIBLE_BOOKS_ORDER = [...BIBLE_STRUCTURE['Old Testament'], ...BIBLE_STRUCTURE['New Testament']];


export default function BibleMenu({
  addToPlaylist,
  fetchSongs,
  isLiveActive,
  onGoLiveBible,
  bibleLiveSlides,
  onExitLiveBible,
  bibleFontSize = 48,
  setBibleFontSize,
  bibleRefColor = '#ef4444',
  setBibleRefColor,
  songFont = 'Inter',
  songSize = 90,
  songWeight = 'bold',
  songColor = '#ffffff',
  songBgColor = '#000000',
  songBgOpacity = '0%',
  songAlign = 'center',
  songVertical = 'center',
  songAnimation = 'Zoom In/Out',
  songSpeed = 'Medium (0.6s)'
}) {
  // Navigation state
  const [activeSubTab, setActiveSubTab] = useState('browse'); // browse | search | favorites | history | compare
  const [translation, setTranslation] = useState('KJV');
  const [compareTranslation, setCompareTranslation] = useState('ASV');
  const [availableTranslations, setAvailableTranslations] = useState(['KJV', 'ASV', 'NIV', 'MBBTAG']);
  
  // Book/Chapter/Verse navigation
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [selectedVerses, setSelectedVerses] = useState([]); // array of verse numbers
  const [compareVerses, setCompareVerses] = useState([]); // for parallel view
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Favorites & History
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  
  // Formatting options
  const [showVerseNumbers, setShowVerseNumbers] = useState(true);
  const [mergeVerses, setMergeVerses] = useState(false); // false = one verse per slide
  
  // Live editing overrides
  const [bibleFont, setBibleFont] = useState(songFont);
  const [bibleColor, setBibleColor] = useState('#ffffff');
  const [bibleAlign, setBibleAlign] = useState(songAlign);
  const [bibleBg, setBibleBg] = useState('#000000');
  
  // Book filter for quick find
  const [bookFilter, setBookFilter] = useState('');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSeedingBible, setIsSeedingBible] = useState(false);
  
  // Refs
  const versesListRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastSelectedVerseRef = useRef(null);

  // ─── Data Loading ───────────────────────────────────────────────────
  
  // Load available translations on mount
  useEffect(() => {
    loadTranslations();
    loadFavorites();
    loadHistory();
  }, []);
  
  // Load books when translation changes and map selected book name dynamically
  useEffect(() => {
    const updateSelectedBookName = async () => {
      if (!translation) return;
      if (window.api?.getBibleBooks) {
        setIsLoading(true);
        try {
          const result = await window.api.getBibleBooks(translation);
          setBooks(result || []);
          
          if (selectedBook && books.length > 0 && result && result.length > 0) {
            const oldBookObj = books.find(b => b.book_name === selectedBook);
            if (oldBookObj) {
              const newBookObj = result.find(b => b.book_number === oldBookObj.book_number);
              if (newBookObj) {
                setSelectedBook(newBookObj.book_name);
              }
            }
          }
        } catch (err) {
          console.error('Failed to load books:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    updateSelectedBookName();
  }, [translation]);
  
  // Load chapters when book changes
  useEffect(() => {
    if (translation && selectedBook) {
      loadChapters(translation, selectedBook);
      setSelectedChapter(null);
      setVerses([]);
      setSelectedVerses([]);
    }
  }, [selectedBook, translation]);
  
  // Load verses when chapter changes
  useEffect(() => {
    if (translation && selectedBook && selectedChapter) {
      loadVerses(translation, selectedBook, selectedChapter).then(newVerses => {
        // If we had verses selected and we just changed translation, auto-update the live output!
        if (selectedVerses.length > 0 && onGoLiveBible) {
          const newSelectedVerseData = (newVerses || []).filter(v => selectedVerses.includes(v.verse));
          if (newSelectedVerseData.length > 0) {
            const style = {
              font: bibleFont, size: bibleFontSize, weight: songWeight,
              color: bibleColor, bgColor: bibleBg, bgOpacity: songBgOpacity, refColor: bibleRefColor,
              align: bibleAlign, vertical: songVertical, animation: songAnimation, speed: songSpeed
            };
            const chunkVerses = (arr, size = 3) => {
              const chunks = [];
              for (let i = 0; i < arr.length; i += size) { chunks.push(arr.slice(i, i + size)); }
              return chunks;
            };
            let slides = [];
            if (!mergeVerses) {
              slides = newSelectedVerseData.map(v => ({
                label: `${selectedBook} ${selectedChapter}:${v.verse}`,
                text: showVerseNumbers ? `${v.verse} ${v.text}` : v.text,
                style, isBible: true
              }));
            } else {
              slides = chunkVerses(newSelectedVerseData, 3).map(chunk => {
                const startV = chunk[0].verse;
                const endV = chunk[chunk.length - 1].verse;
                const label = `${selectedBook} ${selectedChapter}:${startV === endV ? startV : `${startV}-${endV}`}`;
                const text = chunk.map(v => showVerseNumbers ? `${v.verse} ${v.text}` : v.text).join('\n');
                return { label, text, style, isBible: true };
              });
            }
            // Auto go live
            onGoLiveBible(slides);
          }
        }
      });
    }
  }, [selectedChapter, translation, selectedBook]);
  
  // Load compare verses
  useEffect(() => {
    if (activeSubTab === 'compare' && compareTranslation && selectedBook && selectedChapter) {
      loadCompareVerses();
    }
  }, [activeSubTab, compareTranslation, selectedBook, selectedChapter]);

  const loadTranslations = async () => {
    if (!window.api?.getBibleTranslations) return;
    try {
      const trans = await window.api.getBibleTranslations();
      if (trans && trans.length > 0) {
        setAvailableTranslations(trans);
      }
    } catch (err) {
      console.error('Failed to load translations:', err);
    }
  };
  
  const loadBooks = async (trans) => {
    if (!window.api?.getBibleBooks) return;
    setIsLoading(true);
    try {
      const result = await window.api.getBibleBooks(trans);
      setBooks(result || []);
      if (result && result.length === 0) {
        setIsSeedingBible(true);
        // Bible data not yet seeded — wait and retry
        setTimeout(() => {
          loadBooks(trans);
          setIsSeedingBible(false);
        }, 5000);
      }
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadChapters = async (trans, book) => {
    if (!window.api?.getBibleChapters) return;
    try {
      const result = await window.api.getBibleChapters(trans, book);
      setChapters(result || []);
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  };
  
  const loadVerses = async (trans, book, chapter) => {
    if (!window.api?.getBibleVerses) return;
    try {
      const result = await window.api.getBibleVerses(trans, book, chapter);
      setVerses(result || []);
      // Add to history
      if (window.api?.addBibleHistory) {
        window.api.addBibleHistory(trans, book, chapter, 1, result?.length || 1);
        loadHistory();
      }
      return result;
    } catch (err) {
      console.error('Failed to load verses:', err);
    }
  };
  
  const loadCompareVerses = async () => {
    if (!window.api?.getBibleVerses || !selectedBook || !selectedChapter) return;
    try {
      const result = await window.api.getBibleVerses(compareTranslation, selectedBook, selectedChapter);
      setCompareVerses(result || []);
    } catch (err) {
      console.error('Failed to load compare verses:', err);
    }
  };
  
  const loadFavorites = async () => {
    if (!window.api?.getBibleFavorites) return;
    try {
      const result = await window.api.getBibleFavorites();
      setFavorites(result || []);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  };
  
  const loadHistory = async () => {
    if (!window.api?.getBibleHistory) return;
    try {
      const result = await window.api.getBibleHistory(30);
      setHistory(result || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  // ─── Verse Selection ────────────────────────────────────────────────
  
  const handleVerseClick = (verseNum, e) => {
    if (e.shiftKey && lastSelectedVerseRef.current !== null) {
      // Shift+Click: select range
      const start = Math.min(lastSelectedVerseRef.current, verseNum);
      const end = Math.max(lastSelectedVerseRef.current, verseNum);
      const range = [];
      for (let i = start; i <= end; i++) range.push(i);
      setSelectedVerses(range);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: toggle individual
      setSelectedVerses(prev => 
        prev.includes(verseNum) 
          ? prev.filter(v => v !== verseNum)
          : [...prev, verseNum].sort((a, b) => a - b)
      );
    } else {
      // Normal click: select single
      setSelectedVerses([verseNum]);
    }
    lastSelectedVerseRef.current = verseNum;
  };
  
  const selectAllVerses = () => {
    setSelectedVerses(verses.map(v => v.verse));
  };
  
  const clearSelection = () => {
    setSelectedVerses([]);
    lastSelectedVerseRef.current = null;
  };

  // ─── Search ─────────────────────────────────────────────────────────
  
  const handleSearch = async () => {
    if (!searchQuery.trim() || !window.api?.searchBibleText) return;
    setIsSearching(true);
    try {
      // Check if query looks like a reference (e.g., "John 3:16" or "Gen 1:1-5")
      const refMatch = searchQuery.match(/^(\d?\s*\w+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
      if (refMatch) {
        const [, bookPart, chapter, startVerse, endVerse] = refMatch;
        // Try to find matching book
        const matchedBook = findMatchingBook(bookPart.trim());
        if (matchedBook) {
          setSelectedBook(matchedBook);
          setSelectedChapter(parseInt(chapter));
          if (startVerse) {
            const sv = parseInt(startVerse);
            const ev = endVerse ? parseInt(endVerse) : sv;
            // Wait for verses to load then select
            setTimeout(() => {
              const range = [];
              for (let i = sv; i <= ev; i++) range.push(i);
              setSelectedVerses(range);
            }, 300);
          }
          setActiveSubTab('browse');
          setIsSearching(false);
          return;
        }
      }
      
      // Full-text keyword search
      const results = await window.api.searchBibleText(translation, searchQuery.trim());
      setSearchResults(results || []);
    } catch (err) {
      console.error('Bible search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };
  
  const findMatchingBook = (query) => {
    const q = query.toLowerCase();
    const allBooks = [...BIBLE_STRUCTURE['Old Testament'], ...BIBLE_STRUCTURE['New Testament']];
    // Exact match first
    const exact = allBooks.find(b => b.toLowerCase() === q);
    if (exact) return exact;
    // Abbreviation match
    const abbrev = Object.entries(BOOK_ABBREV).find(([, abbr]) => abbr.toLowerCase() === q);
    if (abbrev) return abbrev[0];
    // Prefix match
    const prefix = allBooks.find(b => b.toLowerCase().startsWith(q));
    if (prefix) return prefix;
    return null;
  };

  // ─── Insert to Presentation & Go Live ───────────────────────────────
  
  const getSlidesForVerses = (selectedVerseData) => {
    const style = {
      font: bibleFont,
      size: bibleFontSize,
      weight: songWeight,
      color: bibleColor,
      bgColor: bibleBg,
      refColor: bibleRefColor,
      bgOpacity: songBgOpacity,
      align: bibleAlign,
      vertical: songVertical,
      animation: songAnimation,
      speed: songSpeed
    };

    const chunkVerses = (arr, size = 3) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    if (!mergeVerses) {
      return selectedVerseData.map(v => ({
        label: `${selectedBook} ${selectedChapter}:${v.verse}`,
        text: showVerseNumbers ? `${v.verse} ${v.text}` : v.text,
        style
      }));
    } else {
      const chunks = chunkVerses(selectedVerseData, 3);
      return chunks.map(chunk => {
        const startV = chunk[0].verse;
        const endV = chunk[chunk.length - 1].verse;
        const label = `${selectedBook} ${selectedChapter}:${startV === endV ? startV : `${startV}-${endV}`}`;
        const text = chunk.map(v => showVerseNumbers ? `${v.verse} ${v.text}` : v.text).join('\n');
        return {
          label,
          text,
          style
        };
      });
    }
  };

  const handleInsertToPresentation = async () => {
    if (selectedVerses.length === 0 || !selectedBook || !selectedChapter) return;
    if (!window.api?.createSong) return;
    
    const selectedVerseData = verses.filter(v => selectedVerses.includes(v.verse));
    if (selectedVerseData.length === 0) return;
    
    const verseRange = selectedVerses.length === 1
      ? `${selectedVerses[0]}`
      : `${selectedVerses[0]}-${selectedVerses[selectedVerses.length - 1]}`;
    
    const title = `${selectedBook} ${selectedChapter}:${verseRange} (${translation})`;
    const slides = getSlidesForVerses(selectedVerseData);
    
    try {
      const contentJson = JSON.stringify(slides);
      const addedSong = await window.api.createSong({
        title,
        author: 'Bible',
        key: translation,
        tempo: 'READ',
        contentJson
      });
      
      if (fetchSongs) await fetchSongs();
      if (addToPlaylist) await addToPlaylist(addedSong.title, 'song', addedSong.id);
    } catch (err) {
      console.error('Failed to insert Bible verses to presentation:', err);
    }
  };

  const handleGoLiveScripture = () => {
    if (selectedVerses.length === 0 || !selectedBook || !selectedChapter) return;
    const selectedVerseData = verses.filter(v => selectedVerses.includes(v.verse));
    if (selectedVerseData.length === 0) return;
    
    const slides = getSlidesForVerses(selectedVerseData);
    if (onGoLiveBible) {
      onGoLiveBible(slides);
    }
  };
  
  const handleInsertSearchResult = async (result) => {
    if (!window.api?.createSong) return;
    
    const title = `${result.book_name} ${result.chapter}:${result.verse} (${result.translation})`;
    const style = {
      font: bibleFont, size: bibleFontSize, weight: songWeight,
      color: bibleColor, bgColor: bibleBg, bgOpacity: songBgOpacity, refColor: bibleRefColor,
      align: bibleAlign, vertical: songVertical, animation: songAnimation, speed: songSpeed
    };
    
    const slides = [{
      label: title,
      text: showVerseNumbers ? `${result.verse} ${result.text}` : result.text,
      style
    }];
    
    try {
      const contentJson = JSON.stringify(slides);
      const addedSong = await window.api.createSong({
        title, author: 'Bible', key: result.translation, tempo: 'READ', contentJson
      });
      if (fetchSongs) await fetchSongs();
      if (addToPlaylist) await addToPlaylist(addedSong.title, 'song', addedSong.id);
    } catch (err) {
      console.error('Failed to insert search result to flow:', err);
    }
  };

  // ─── Favorites ──────────────────────────────────────────────────────
  
  const handleToggleFavorite = async () => {
    if (!selectedBook || !selectedChapter || selectedVerses.length === 0) return;
    const sv = Math.min(...selectedVerses);
    const ev = Math.max(...selectedVerses);
    const label = `${selectedBook} ${selectedChapter}:${sv === ev ? sv : `${sv}-${ev}`} (${translation})`;
    
    // Check if already favorited
    const existing = favorites.find(f => 
      f.translation === translation && f.book_name === selectedBook && 
      f.chapter === selectedChapter && f.start_verse === sv && f.end_verse === ev
    );
    
    if (existing) {
      if (window.api?.removeBibleFavorite) {
        await window.api.removeBibleFavorite(existing.id);
      }
    } else {
      if (window.api?.addBibleFavorite) {
        await window.api.addBibleFavorite(translation, selectedBook, selectedChapter, sv, ev, label);
      }
    }
    loadFavorites();
  };
  
  const isFavorited = () => {
    if (!selectedBook || !selectedChapter || selectedVerses.length === 0) return false;
    const sv = Math.min(...selectedVerses);
    const ev = Math.max(...selectedVerses);
    return favorites.some(f => 
      f.translation === translation && f.book_name === selectedBook && 
      f.chapter === selectedChapter && f.start_verse === sv && f.end_verse === ev
    );
  };

  // ─── Navigation Helpers ─────────────────────────────────────────────
  
  const goToPrevChapter = () => {
    if (!selectedChapter || selectedChapter <= 1) return;
    setSelectedChapter(selectedChapter - 1);
  };
  
  const goToNextChapter = () => {
    if (!selectedChapter || !chapters.length) return;
    const maxChapter = Math.max(...chapters);
    if (selectedChapter < maxChapter) setSelectedChapter(selectedChapter + 1);
  };
  
  const navigateToPassage = (bookName, chapter, startVerse, endVerse) => {
    setSelectedBook(bookName);
    setTimeout(() => {
      setSelectedChapter(chapter);
      setTimeout(() => {
        const range = [];
        for (let i = startVerse; i <= endVerse; i++) range.push(i);
        setSelectedVerses(range);
      }, 200);
    }, 200);
    setActiveSubTab('browse');
  };

  // ─── Filtered Books ────────────────────────────────────────────────
  
  const getBookAbbrev = (bookName) => {
    if (!books || books.length === 0) return BOOK_ABBREV[bookName] || bookName.slice(0, 3);
    const bookObj = books.find(b => b.book_name === bookName);
    if (bookObj) {
      const englishName = BIBLE_BOOKS_ORDER[bookObj.book_number - 1];
      return BOOK_ABBREV[englishName] || bookName.slice(0, 3);
    }
    return BOOK_ABBREV[bookName] || bookName.slice(0, 3);
  };

  const getFilteredBooks = (testament) => {
    const loadedBooks = books.length > 0 ? books : [];
    const testamentBooks = loadedBooks.filter(b => {
      const isNewTestament = b.book_number >= 40;
      return testament === 'New Testament' ? isNewTestament : !isNewTestament;
    });

    let allBooks = [];
    if (testamentBooks.length > 0) {
      allBooks = testamentBooks.map(b => b.book_name);
    } else {
      allBooks = BIBLE_STRUCTURE[testament];
    }
    
    if (!bookFilter.trim()) return allBooks;
    const q = bookFilter.toLowerCase();
    return allBooks.filter(b => {
      const abbrev = getBookAbbrev(b);
      return b.toLowerCase().includes(q) || (abbrev && abbrev.toLowerCase().includes(q));
    });
  };

  // ─── Selected Verse Preview ─────────────────────────────────────────
  
  const getSelectedVerseText = () => {
    if (selectedVerses.length === 0) return '';
    const selected = verses.filter(v => selectedVerses.includes(v.verse));
    return selected.map(v => showVerseNumbers ? `${v.verse} ${v.text}` : v.text).join('\n');
  };
  
  const getSelectionLabel = () => {
    if (!selectedBook || !selectedChapter || selectedVerses.length === 0) return '';
    const sv = Math.min(...selectedVerses);
    const ev = Math.max(...selectedVerses);
    return `${selectedBook} ${selectedChapter}:${sv === ev ? sv : `${sv}-${ev}`} (${translation})`;
  };

  // ════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <section className="flex-1 flex flex-col bg-appBg overflow-hidden">
      
      {bibleLiveSlides && bibleLiveSlides.length > 0 && (
        <div className="bg-emerald-950/40 border-b border-emerald-800/40 px-4 py-2.5 flex items-center justify-between text-[11px] animate-pulse">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow shadow-emerald-500/50" />
            <span className="font-extrabold uppercase tracking-wider text-emerald-400">Live Scripture Overlay Active:</span>
            <span className="font-mono text-slate-300 font-bold">{bibleLiveSlides[0].label}</span>
          </div>
          <button 
            onClick={onExitLiveBible}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 transition text-white font-extrabold rounded text-[9px] uppercase tracking-wider"
          >
            Exit Live Scripture
          </button>
        </div>
      )}
      
      {/* ── Top Bar: Title + Translation + Sub-tabs ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-app)] bg-appPanel/50">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-brand" />
          <h2 className="text-sm font-bold text-textMain tracking-wide">Bible Menu</h2>
          
          {/* Sub-tabs */}
          <nav className="flex items-center gap-0.5 ml-4 bg-appBg/50 rounded-lg p-0.5 border border-[var(--border-app)]">
            {[
              { id: 'browse', label: 'Browse', icon: LayoutGrid },
              { id: 'search', label: 'Search', icon: Search },
              { id: 'favorites', label: 'Favorites', icon: Star },
              { id: 'history', label: 'History', icon: History },
              { id: 'compare', label: 'Compare', icon: Columns2 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition-all ${
                  activeSubTab === tab.id
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-textMuted hover:text-textMain hover:bg-appBg'
                }`}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Translation selector */}
        <div className="flex items-center gap-2">
          <select
            value={translation}
            onChange={e => setTranslation(e.target.value)}
            className="bg-appBg border border-[var(--border-app)] rounded-md px-2 py-1 text-xs text-textMain font-bold focus:outline-none focus:border-brand cursor-pointer"
          >
            {availableTranslations.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* ── Bible Styling & Formatting Bar ── */}
      <div className="flex flex-wrap items-center gap-6 px-4 py-2 border-b border-[var(--border-app)] bg-appPanel/30 text-xs">
        {/* Bible Font Size */}
        <div className="flex items-center gap-2">
          <span className="text-textMuted font-semibold font-mono uppercase tracking-wider text-[10px]">Bible Font Size:</span>
          <span className="font-mono text-brand font-bold">{bibleFontSize}px</span>
          <input
            type="range"
            min="24"
            max="120"
            value={bibleFontSize}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (setBibleFontSize) {
                setBibleFontSize(val);
                localStorage.setItem('bibleFontSize', val.toString());
              }
            }}
            className="h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-brand w-24"
          />
        </div>

        {/* Bible Reference Pill Background Color */}
        <div className="flex items-center gap-2">
          <span className="text-textMuted font-semibold font-mono uppercase tracking-wider text-[10px]">Reference Pill Color:</span>
          <span className="font-mono text-brand font-bold">{bibleRefColor}</span>
          <input
            type="color"
            value={bibleRefColor}
            onChange={(e) => {
              if (setBibleRefColor) {
                setBibleRefColor(e.target.value);
                localStorage.setItem('bibleRefColor', e.target.value);
              }
            }}
            className="h-5 w-8 bg-transparent cursor-pointer rounded border border-[var(--border-app)]"
          />
        </div>
      </div>
      
      {/* ── Seeding Notice ── */}
      {isSeedingBible && (
        <div className="px-4 py-3 bg-brand/10 border-b border-brand/30 text-xs text-brand font-semibold flex items-center gap-2">
          <div className="h-3 w-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          Loading Bible data for first time... This may take a moment.
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ════════════════════════════════════════════ */}
        {/* BROWSE TAB */}
        {/* ════════════════════════════════════════════ */}
        {activeSubTab === 'browse' && (
          <>
            {/* Column 1: Books */}
            <div className="w-[200px] min-w-[180px] border-r border-[var(--border-app)] flex flex-col bg-appPanel/30">
              <div className="p-2 border-b border-[var(--border-app)]">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-textMuted" />
                  <input
                    type="text"
                    value={bookFilter}
                    onChange={e => setBookFilter(e.target.value)}
                    placeholder="Find book..."
                    className="w-full pl-7 pr-2 py-1.5 bg-appBg border border-[var(--border-app)] rounded text-[10px] text-textMain focus:outline-none focus:border-brand placeholder:text-textMuted/50"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {['Old Testament', 'New Testament'].map(testament => {
                  const filtered = getFilteredBooks(testament);
                  if (filtered.length === 0) return null;
                  return (
                    <div key={testament}>
                      <div className="px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-textMuted/60 bg-appBg/30 border-b border-[var(--border-app)]/30 sticky top-0 z-10">
                        {testament}
                      </div>
                      {filtered.map(book => (
                        <button
                          key={book}
                          onClick={() => setSelectedBook(book)}
                          className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between transition-all border-l-2 ${
                            selectedBook === book
                              ? 'bg-brand/15 text-brand font-bold border-brand'
                              : 'text-textMain hover:bg-appBg/60 border-transparent hover:border-brand/30'
                          }`}
                        >
                          <span className="truncate">{book}</span>
                          <span className="text-[8px] text-textMuted/50 font-mono">{BOOK_ABBREV[book]}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Column 2: Chapters */}
            <div className="w-[140px] min-w-[120px] border-r border-[var(--border-app)] flex flex-col bg-appPanel/20">
              <div className="p-2 border-b border-[var(--border-app)]">
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-textMuted">
                  {selectedBook ? `${BOOK_ABBREV[selectedBook] || selectedBook} Chapters` : 'Select a Book'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
                {chapters.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1">
                    {chapters.map(ch => (
                      <button
                        key={ch}
                        onClick={() => setSelectedChapter(ch)}
                        className={`aspect-square flex items-center justify-center rounded text-[11px] font-bold transition-all ${
                          selectedChapter === ch
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-appBg/50 text-textMain hover:bg-brand/20 hover:text-brand border border-[var(--border-app)]/40'
                        }`}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-textMuted/50 text-[10px] py-8">
                    {selectedBook ? 'Loading...' : 'Select a book first'}
                  </div>
                )}
              </div>
            </div>
            
            {/* Column 3: Verses + Preview */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Verse list header */}
              <div className="px-3 py-2 border-b border-[var(--border-app)] flex items-center justify-between bg-appPanel/20">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-textMuted">
                    {selectedBook && selectedChapter 
                      ? `${selectedBook} ${selectedChapter} — ${verses.length} verses`
                      : 'Select a chapter'}
                  </span>
                  {selectedVerses.length > 0 && (
                    <span className="text-[9px] bg-brand/20 text-brand px-2 py-0.5 rounded-full font-bold">
                      {selectedVerses.length} selected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {verses.length > 0 && (
                    <>
                      <button onClick={selectAllVerses} className="text-[8px] text-textMuted hover:text-brand font-bold px-1.5 py-0.5 rounded hover:bg-brand/10 transition">
                        Select All
                      </button>
                      {selectedVerses.length > 0 && (
                        <button onClick={clearSelection} className="text-[8px] text-textMuted hover:text-red-400 font-bold px-1.5 py-0.5 rounded hover:bg-red-500/10 transition">
                          Clear
                        </button>
                      )}
                    </>
                  )}
                  {/* Chapter navigation */}
                  {selectedChapter && (
                    <div className="flex items-center gap-0.5 ml-2 border-l border-[var(--border-app)] pl-2">
                      <button onClick={goToPrevChapter} disabled={selectedChapter <= 1} className="p-0.5 rounded hover:bg-appBg disabled:opacity-30 transition">
                        <ArrowLeft className="h-3 w-3 text-textMuted" />
                      </button>
                      <span className="text-[9px] font-mono text-textMuted font-bold px-1">Ch {selectedChapter}</span>
                      <button onClick={goToNextChapter} disabled={selectedChapter >= Math.max(...(chapters.length ? chapters : [1]))} className="p-0.5 rounded hover:bg-appBg disabled:opacity-30 transition">
                        <ArrowRight className="h-3 w-3 text-textMuted" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Verses list */}
              <div ref={versesListRef} className="flex-1 overflow-y-auto scrollbar-thin">
                {verses.length > 0 ? (
                  <div className="divide-y divide-[var(--border-app)]/30">
                    {verses.map(v => {
                      const isSelected = selectedVerses.includes(v.verse);
                      return (
                        <div
                          key={v.verse}
                          onClick={(e) => handleVerseClick(v.verse, e)}
                          className={`px-4 py-2.5 cursor-pointer transition-all text-[12px] leading-relaxed flex gap-3 select-none ${
                            isSelected
                              ? 'bg-brand/15 border-l-3 border-brand'
                              : 'hover:bg-appPanel/40 border-l-3 border-transparent'
                          }`}
                        >
                          <span className={`text-[10px] font-mono font-bold min-w-[24px] text-right pt-0.5 ${
                            isSelected ? 'text-brand' : 'text-textMuted/50'
                          }`}>
                            {v.verse}
                          </span>
                          <span className={`flex-1 ${isSelected ? 'text-textMain font-medium' : 'text-textMain/80'}`}>
                            {v.text}
                          </span>
                          {isSelected && (
                            <div className="flex items-center">
                              <div className="h-2 w-2 rounded-full bg-brand" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center py-16">
                    <div className="text-center">
                      <BookOpen className="h-10 w-10 text-textMuted/20 mx-auto mb-3" />
                      <p className="text-xs text-textMuted/50">
                        {selectedBook ? 'Select a chapter to view verses' : 'Navigate using Books → Chapters → Verses'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Bottom Action Bar — visible when verses selected */}
              {selectedVerses.length > 0 && (
                <div className="border-t border-[var(--border-app)] bg-appPanel/50 px-4 py-3">
                  {/* Selection info + Preview */}
                  <div className="flex items-start gap-4 mb-3">
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1.5">
                        {getSelectionLabel()}
                      </div>
                      <div className="text-[11px] text-textMain/70 leading-relaxed max-h-[80px] overflow-y-auto scrollbar-thin bg-appBg/30 rounded-lg p-2.5 border border-[var(--border-app)]/50">
                        {getSelectedVerseText().substring(0, 300)}
                        {getSelectedVerseText().length > 300 && '...'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Options row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Show verse numbers toggle */}
                      <label className="flex items-center gap-1.5 text-[9px] text-textMuted cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showVerseNumbers}
                          onChange={() => setShowVerseNumbers(!showVerseNumbers)}
                          className="rounded h-3 w-3 accent-brand"
                        />
                        <Hash className="h-3 w-3" />
                        Verse #
                      </label>
                      
                      {/* Merge/Split toggle */}
                      <div className="flex items-center bg-appBg/50 rounded border border-[var(--border-app)] text-[9px]">
                        <button
                          onClick={() => setMergeVerses(false)}
                          className={`px-2 py-1 rounded-l font-bold transition ${
                            !mergeVerses ? 'bg-brand text-white' : 'text-textMuted hover:text-textMain'
                          }`}
                        >
                          Split
                        </button>
                        <button
                          onClick={() => setMergeVerses(true)}
                          className={`px-2 py-1 rounded-r font-bold transition ${
                            mergeVerses ? 'bg-brand text-white' : 'text-textMuted hover:text-textMain'
                          }`}
                        >
                          Merge
                        </button>
                      </div>
                      
                      {/* Favorite */}
                      <button
                        onClick={handleToggleFavorite}
                        className={`p-1.5 rounded transition ${
                          isFavorited()
                            ? 'text-yellow-400 bg-yellow-500/10'
                            : 'text-textMuted hover:text-yellow-400 hover:bg-yellow-500/10'
                        }`}
                        title={isFavorited() ? 'Remove from Favorites' : 'Add to Favorites'}
                      >
                        <Star className={`h-3.5 w-3.5 ${isFavorited() ? 'fill-yellow-400' : ''}`} />
                      </button>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGoLiveScripture}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition shadow-md"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Show Live
                      </button>
                      <button
                        onClick={handleInsertToPresentation}
                        className="px-4 py-2 bg-brand hover:bg-brand/85 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition shadow-md"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Insert to Presentation
                        <span className="text-[9px] opacity-70 ml-1">
                          ({mergeVerses ? '1 slide' : `${selectedVerses.length} slides`})
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* SEARCH TAB */}
        {/* ════════════════════════════════════════════ */}
        {activeSubTab === 'search' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search bar */}
            <div className="p-4 border-b border-[var(--border-app)]">
              <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder='Search by keyword "love" or reference "John 3:16"...'
                    className="w-full pl-10 pr-4 py-2.5 bg-appBg border border-[var(--border-app)] rounded-lg text-sm text-textMain focus:outline-none focus:border-brand placeholder:text-textMuted/40"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 bg-brand hover:bg-brand/85 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>
            </div>
            
            {/* Search results */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
              {searchResults.length > 0 ? (
                <>
                  <div className="text-[10px] text-textMuted font-bold uppercase tracking-wider mb-3">
                    {searchResults.length} results for "{searchQuery}" in {translation}
                  </div>
                  {searchResults.map((result, idx) => (
                    <div
                      key={`${result.book_name}-${result.chapter}-${result.verse}-${idx}`}
                      className="p-3 bg-appPanel/30 border border-[var(--border-app)] rounded-lg flex justify-between items-start hover:border-brand/40 transition group"
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-brand font-mono">
                            {result.book_name} {result.chapter}:{result.verse}
                          </span>
                          <span className="text-[8px] text-textMuted bg-appBg px-1.5 py-0.5 rounded font-mono">
                            {result.translation}
                          </span>
                        </div>
                        <p 
                          className="text-[11px] text-textMain/80 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: result.highlighted_text || result.text }}
                        />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => navigateToPassage(result.book_name, result.chapter, result.verse, result.verse)}
                          className="p-1.5 rounded hover:bg-appBg text-textMuted hover:text-textMain transition"
                          title="Go to passage"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleInsertSearchResult(result)}
                          className="px-2.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/40 rounded text-[10px] text-brand font-bold flex items-center gap-1 transition"
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center py-16">
                  <div className="text-center">
                    <Search className="h-10 w-10 text-textMuted/20 mx-auto mb-3" />
                    <p className="text-xs text-textMuted/50">
                      {searchQuery ? 'No results found. Try different keywords.' : 'Type a keyword or verse reference to search.'}
                    </p>
                    <p className="text-[10px] text-textMuted/30 mt-2">
                      Examples: "love one another", "John 3:16", "Gen 1:1-5"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* FAVORITES TAB */}
        {/* ════════════════════════════════════════════ */}
        {activeSubTab === 'favorites' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-app)] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                Bookmarked Passages ({favorites.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
              {favorites.length > 0 ? (
                favorites.map(fav => (
                  <div
                    key={fav.id}
                    className="p-3 bg-appPanel/30 border border-[var(--border-app)] rounded-lg flex items-center justify-between hover:border-brand/40 transition group"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => navigateToPassage(fav.book_name, fav.chapter, fav.start_verse, fav.end_verse)}
                    >
                      <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                      <div>
                        <div className="text-[11px] font-bold text-textMain">
                          {fav.label || `${fav.book_name} ${fav.chapter}:${fav.start_verse}-${fav.end_verse}`}
                        </div>
                        <div className="text-[9px] text-textMuted font-mono">{fav.translation}</div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (window.api?.removeBibleFavorite) {
                          await window.api.removeBibleFavorite(fav.id);
                          loadFavorites();
                        }
                      }}
                      className="p-1.5 rounded hover:bg-red-500/10 text-textMuted hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center py-16">
                  <div className="text-center">
                    <Star className="h-10 w-10 text-textMuted/20 mx-auto mb-3" />
                    <p className="text-xs text-textMuted/50">No bookmarked passages yet.</p>
                    <p className="text-[10px] text-textMuted/30 mt-1">Select verses and click ★ to bookmark.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* HISTORY TAB */}
        {/* ════════════════════════════════════════════ */}
        {activeSubTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-app)] flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted flex items-center gap-2">
                <History className="h-3.5 w-3.5" />
                Recent Passages ({history.length})
              </span>
              {history.length > 0 && (
                <button
                  onClick={async () => {
                    if (window.api?.clearBibleHistory) {
                      await window.api.clearBibleHistory();
                      loadHistory();
                    }
                  }}
                  className="text-[9px] text-textMuted hover:text-red-400 font-bold transition"
                >
                  Clear History
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-1.5">
              {history.length > 0 ? (
                history.map(item => (
                  <button
                    key={item.id}
                    onClick={() => navigateToPassage(item.book_name, item.chapter, item.start_verse, item.end_verse)}
                    className="w-full text-left p-2.5 bg-appPanel/20 border border-[var(--border-app)]/50 rounded-lg flex items-center gap-3 hover:border-brand/40 hover:bg-appPanel/40 transition"
                  >
                    <Clock className="h-3.5 w-3.5 text-textMuted/40 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold text-textMain truncate block">
                        {item.book_name} {item.chapter}
                      </span>
                    </div>
                    <span className="text-[8px] text-textMuted font-mono bg-appBg px-1.5 py-0.5 rounded">
                      {item.translation}
                    </span>
                    <ChevronRight className="h-3 w-3 text-textMuted/30" />
                  </button>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center py-16">
                  <div className="text-center">
                    <History className="h-10 w-10 text-textMuted/20 mx-auto mb-3" />
                    <p className="text-xs text-textMuted/50">No recent passages.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* COMPARE TAB */}
        {/* ════════════════════════════════════════════ */}
        {activeSubTab === 'compare' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-app)] flex items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">
                Parallel Comparison
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={translation}
                  onChange={e => setTranslation(e.target.value)}
                  className="bg-appBg border border-[var(--border-app)] rounded px-2 py-1 text-[10px] text-textMain font-bold focus:outline-none focus:border-brand"
                >
                  {availableTranslations.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <span className="text-textMuted text-[10px]">vs</span>
                <select
                  value={compareTranslation}
                  onChange={e => setCompareTranslation(e.target.value)}
                  className="bg-appBg border border-[var(--border-app)] rounded px-2 py-1 text-[10px] text-textMain font-bold focus:outline-none focus:border-brand"
                >
                  {availableTranslations.filter(t => t !== translation).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {selectedBook && selectedChapter && (
                <span className="text-[10px] text-brand font-bold">
                  {selectedBook} {selectedChapter}
                </span>
              )}
            </div>
            
            {selectedBook && selectedChapter && verses.length > 0 ? (
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="divide-y divide-[var(--border-app)]/30">
                  {verses.map(v => {
                    const compareV = compareVerses.find(cv => cv.verse === v.verse);
                    return (
                      <div key={v.verse} className="flex">
                        {/* Left: Primary translation */}
                        <div className="flex-1 p-3 border-r border-[var(--border-app)]/30">
                          <div className="flex gap-2">
                            <span className="text-[9px] font-mono font-bold text-brand/60 min-w-[20px]">{v.verse}</span>
                            <span className="text-[11px] text-textMain/80 leading-relaxed">{v.text}</span>
                          </div>
                        </div>
                        {/* Right: Compare translation */}
                        <div className="flex-1 p-3 bg-appPanel/10">
                          <div className="flex gap-2">
                            <span className="text-[9px] font-mono font-bold text-orange-400/60 min-w-[20px]">{v.verse}</span>
                            <span className="text-[11px] text-textMain/70 leading-relaxed italic">
                              {compareV ? compareV.text : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Columns2 className="h-10 w-10 text-textMuted/20 mx-auto mb-3" />
                  <p className="text-xs text-textMuted/50">
                    Select a book and chapter in the Browse tab first, then switch to Compare.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
