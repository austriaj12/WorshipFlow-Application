import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import appLogo from './logo.png';
import BibleMenu from './BibleMenu';
import { KEYS, getSemitoneDifference, transposeChordChart } from '../utils/chordUtils.js';
import { metronomeEngine } from '../utils/metronomeEngine';
import { 
  useLibraryStore, 
  usePresentationStore, 
  useLiveOutputStore,
  useStageLayoutStore
} from './store';
import { 
  Search, 
  Music, 
  BookOpen, 
  Image, 
  Play, 
  Pause, 
  ChevronRight, 
  Volume2, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Trash2, 
  Plus, 
  Grid3X3,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Edit,
  Save,
  Film,
  Settings,
  FolderOpen,
  Folder,
  CornerUpLeft,
  ArrowUp,
  Monitor,
  Clock,
  Layout,
  FileText,
  Sliders,
  GripVertical,
  Trash,
  Square,
  Wifi,
  Smartphone,
  Tv,
  Repeat,
  VolumeX
} from 'lucide-react';
import QRCode from 'qrcode';

// URL.parse polyfill for older Electron contexts
if (typeof URL.parse !== 'function') {
  URL.parse = function(url, base) {
    try {
      return new URL(url, base);
    } catch (e) {
      return null;
    }
  };
}

const formatBgPath = (pathStr) => {
  if (!pathStr) return '';
  let str = pathStr.toString().trim();
  if (str.startsWith('#') || str.startsWith('rgb') || str.startsWith('hsl') || str === 'transparent') {
    return str;
  }
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('worshipflow-asset://')) {
    return str;
  }
  // Strip any accidental multiple file:/// or file:// prefixes (e.g. file:///file:///)
  while (str.toLowerCase().startsWith('file:/')) {
    str = str.replace(/^file:\/+/i, '');
  }
  const cleanPath = str.replace(/\\/g, '/');
  return `file:///${cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath}`;
};

const formatSecondsToMinSec = (totalSeconds) => {
  const secs = Math.max(0, parseInt(totalSeconds, 10) || 0);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const sharedVideoCache = {};

const getOrCreateSharedVideo = (src) => {
  if (!src) return null;
  const formatted = formatBgPath(src);
  if (!sharedVideoCache[formatted]) {
    const video = document.createElement('video');
    video.src = formatted;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.position = 'absolute';
    video.style.width = '0px';
    video.style.height = '0px';
    video.style.pointerEvents = 'none';
    video.style.opacity = '0';
    document.body.appendChild(video);
    
    video.play().catch(() => {});
    sharedVideoCache[formatted] = video;
  }
  return sharedVideoCache[formatted];
};

const SharedVideoCanvas = ({ className, style, src, maxResWidth = 240, fps = 12 }) => {
  const canvasRef = React.useRef(null);
  const [isVisible, setIsVisible] = React.useState(true);

  // IntersectionObserver: Only render when thumbnail is visible on screen
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { threshold: 0.05 });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!isVisible) return;

    let animationFrameId;
    let lastRenderTime = 0;
    const interval = 1000 / fps;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    const video = getOrCreateSharedVideo(src);
    if (!video) return;

    let isTabActive = !document.hidden;

    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = (now) => {
      animationFrameId = requestAnimationFrame(render);

      if (!isTabActive) return;
      if (now - lastRenderTime < interval) return;
      lastRenderTime = now;

      if (video && video.src && !video.paused && !video.ended && video.videoWidth > 0) {
        const targetW = maxResWidth;
        const targetH = Math.round(maxResWidth * (video.videoHeight / video.videoWidth || 0.5625));

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        ctx.drawImage(video, 0, 0, targetW, targetH);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [src, maxResWidth, fps, isVisible]);

  return <canvas ref={canvasRef} className={className} style={style} />;
};

const PPTIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM9 13h2a2 2 0 1 1 0 4H10v2H9v-6zm1 3h1a1 1 0 1 0 0-2h-1v2z"/>
  </svg>
);

const PDFIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM8 13h1.5a1.5 1.5 0 1 1 0 3H9v2H8v-5zm4 0h1.2c1 0 1.8.8 1.8 1.8v1.4c0 1-.8 1.8-1.8 1.8H12v-5zm3.5 0H17v1h-1v1h1v1h-1v2h-1v-5h1.5zM9 14v1h.5a.5.5 0 0 0 0-1H9zm4 0v3h.2c.4 0 .8-.3.8-.8v-1.4c0-.4-.4-.8-.8-.8H13z"/>
  </svg>
);

const isBgColor = (bg) => {
  if (!bg) return false;
  return bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl');
};

// Lazy-load video thumbnails only when they scroll into the viewport.
// Using IntersectionObserver prevents crashing from loading dozens of videos at once.
function LazyVideoThumbnail({ src }) {
  const containerRef = React.useRef(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-950 relative">
      {visible ? (
        <>
          <video
            src={src}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover opacity-80"
            onLoadedMetadata={(e) => { e.target.currentTime = 0.5; }}
          />
          <span className="absolute top-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[5px] text-[#E2E8F0] font-mono font-bold uppercase tracking-wider leading-none">
            VIDEO
          </span>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center flex-col gap-1">
          <span className="text-[8px] text-slate-500 font-mono font-bold uppercase">VIDEO</span>
        </div>
      )}
    </div>
  );
}

function OperatorDashboard() {
  // Global Top Navigation Tabs
  const [activeHeaderTab, setActiveHeaderTab] = useState('presentation'); 
  const [countdownSubTab, setCountdownSubTab] = useState('countdown'); // 'countdown' | 'timer'

  // Remote Sync modal states
  const [isRemoteSyncOpen, setIsRemoteSyncOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteQrData, setRemoteQrData] = useState('');
  const [lyricsUrl, setLyricsUrl] = useState('');
  const [lyricsQrData, setLyricsQrData] = useState('');
  const [remoteSyncTab, setRemoteSyncTab] = useState('remote'); // 'remote' | 'lyrics'

  // Local Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  
  // Custom aspect ratio configs (CSS flexible previews)
  const [aspectRatio, setAspectRatio] = useState('video'); // 'video' (16:9) | '[4/3]' (4:3)

  // Projector Window Status state
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Zustand Store Hooks
  const { 
    songs, 
    loading: libraryLoading, 
    selectedSong, 
    fetchSongs, 
    searchSongs, 
    selectSong, 
    saveSong, 
    deleteSong 
  } = useLibraryStore();

  const { 
    playlist, 
    fetchPlaylist, 
    addToPlaylist, 
    removeFromPlaylist, 
    reorderPlaylist,
    clearPlaylist,
    importPlaylist
  } = usePresentationStore();

  const { 
    activeSlideText, 
    activeSlideLabel, 
    activeBgAsset, 
    activeSlideStyle,
    blackout, 
    clearLyrics, 
    setLiveSlide, 
    setBlackout, 
    setClearLyrics 
  } = useLiveOutputStore();

  const { stageLayout, setStageLayout, setRightPanels, setLeftWidthPct } = useStageLayoutStore();

  // Local Reactive Lists
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaList, setMediaList] = useState([]);
  
  // Collapsible Background Panel state
  const [isBgPanelCollapsed, setIsBgPanelCollapsed] = useState(() => localStorage.getItem('isBgPanelCollapsed') === 'true');

  // Media Player states
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [mediaLoop, setMediaLoop] = useState(true);
  const [mediaVolume, setMediaVolume] = useState(100);
  const operatorMediaRef = React.useRef(null);

  // Local Directory Scanner & Resizable Splitter states
  const [bgDirectoryPath, setBgDirectoryPath] = useState(() => localStorage.getItem('bgDirectoryPath') || '');
  const [pathInputVal, setPathInputVal] = useState(bgDirectoryPath);
  const [bgPanelHeight, setBgPanelHeight] = useState(() => parseInt(localStorage.getItem('bgPanelHeight')) || 320); // default higher to support form checklist
  const [isResizingBgPanel, setIsResizingBgPanel] = useState(false);
  const [selectedSlideIndexes, setSelectedSlideIndexes] = useState([0]);
  const [thumbnailScale, setThumbnailScale] = useState(() => parseInt(localStorage.getItem('thumbnailScale') || '50'));
  const [slidePreviewSize, setSlidePreviewSize] = useState(() => parseInt(localStorage.getItem('slidePreviewSize') || '100'));

  useEffect(() => {
    setPathInputVal(bgDirectoryPath);
  }, [bgDirectoryPath]);

  useEffect(() => {
    localStorage.setItem('thumbnailScale', String(thumbnailScale));
  }, [thumbnailScale]);

  useEffect(() => {
    localStorage.setItem('slidePreviewSize', String(slidePreviewSize));
  }, [slidePreviewSize]);

  // Strict double-action confirmation lifecycle states & background form states
  const [bgType, setBgType] = useState('color'); // 'color' | 'image' | 'video'
  const [bgColorInput, setBgColorInput] = useState('#000000');
  const [bgHeight, setBgHeight] = useState(100);
  const [applyToTarget, setApplyToTarget] = useState('active'); // 'active' | 'selected' | 'all'
  const [presentationFilePath, setPresentationFilePath] = useState(null);
  const [isFileDropdownOpen, setIsFileDropdownOpen] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const [checklistSlideIndexes, setChecklistSlideIndexes] = useState([]);
  const [stagedBgAsset, setStagedBgAsset] = useState(null); // null = nothing selected, "" = no background, string = file path
  const [bgActionStatus, setBgActionStatus] = useState('idle'); // 'idle' | 'success'
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [isAddingSectionInline, setIsAddingSectionInline] = useState(false);
  const [newSectionNameInline, setNewSectionNameInline] = useState('');

  // Slide Transition Hotspot State
  const [hoveredTransitionGap, setHoveredTransitionGap] = useState(null); // index of the gap being hovered

  // Live Output Preview Monitor Background Crossfade States
  const [previewCurrentBg, setPreviewCurrentBg] = useState({ src: '', type: 'none' });
  const [previewPrevBg, setPreviewPrevBg] = useState({ src: '', type: 'none' });
  const [previewIsCrossfading, setPreviewIsCrossfading] = useState(false);

  // Right-click context menu for playlist items
  const [playlistContextMenu, setPlaylistContextMenu] = useState(null); // { x, y, itemId, itemName, itemIndex }

  // Countdown State
  const [countdownMinutes, setCountdownMinutes] = useState(5);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [countdownTitle, setCountdownTitle] = useState("The service is about to start");
  const [countdownSubtext, setCountdownSubtext] = useState("Please take your seats");
  const [countdownMode, setCountdownMode] = useState("duration"); // "duration" | "target" | "current"
  
  // Live Screen State Trackers (Separate from current selectedSong dashboard view)
  const [liveSong, setLiveSong] = useState(null);
  const [liveSlides, setLiveSlides] = useState([]);
  const [liveActiveIndex, setLiveActiveIndex] = useState(0);
  const [bibleLiveSlides, setBibleLiveSlides] = useState(null);
  const [savedPresentationState, setSavedPresentationState] = useState(null);
  const [restoreSlideIndex, setRestoreSlideIndex] = useState(null);
  const [countdownTargetTime, setCountdownTargetTime] = useState("10:30");
  const [countdownShowOn, setCountdownShowOn] = useState("both"); // "both" | "main" | "stage"
  const [countdownOvertime, setCountdownOvertime] = useState(false);
  const [countdownTitleSize, setCountdownTitleSize] = useState(56);
  const [countdownTimeSize, setCountdownTimeSize] = useState(160);
  const [countdownSubtextSize, setCountdownSubtextSize] = useState(36);
  const [countdownBgColor, setCountdownBgColor] = useState("#000000");
  const [countdownBgMedia, setCountdownBgMedia] = useState(null); // image or video path
  const [countdownTextColor, setCountdownTextColor] = useState("#ffffff");
  const [countdownActive, setCountdownActive] = useState(false);
  const [bibleFontSize, setBibleFontSize] = useState(() => parseInt(localStorage.getItem('bibleFontSize') || '48'));
  const [bibleRefColor, setBibleRefColor] = useState(() => localStorage.getItem('bibleRefColor') || '#ef4444');

  // Count-up Timer State
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerTitle, setTimerTitle] = useState("Service Timer");
  const [timerShowOn, setTimerShowOn] = useState("both"); // "both" | "main" | "stage"
  const [timerTitleSize, setTimerTitleSize] = useState(56);
  const [timerTimeSize, setTimerTimeSize] = useState(160);
  const [timerBgColor, setTimerBgColor] = useState("#000000");
  const [timerBgMedia, setTimerBgMedia] = useState(null);
  const [timerTextColor, setTimerTextColor] = useState("#ffffff");
  const [timerActive, setTimerActive] = useState(false);

  // Modal Controllers
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('appearance'); // Default to appearance tab

  // Chords & Lead Sheet states for Add/Edit Song Modals
  const [newSongChordsRaw, setNewSongChordsRaw] = useState('');
  const [editSongChordsRaw, setEditSongChordsRaw] = useState('');
  const [songModalTab, setSongModalTab] = useState('lyrics'); // 'lyrics' | 'chords'

  // Song Musical Key & Tempo states
  const [newSongKey, setNewSongKey] = useState('C');
  const [editSongKey, setEditSongKey] = useState('C');

  // Metronome Click Track & Section Voice Cue states
  const [newSongBpm, setNewSongBpm] = useState(120);
  const [newSongTimeSignature, setNewSongTimeSignature] = useState('4/4');
  const [newSongEnableClick, setNewSongEnableClick] = useState(false);
  const [newSongEnableVoiceCues, setNewSongEnableVoiceCues] = useState(false);
  const [newSongVoiceGender, setNewSongVoiceGender] = useState('female');

  const [editSongBpm, setEditSongBpm] = useState(120);
  const [editSongTimeSignature, setEditSongTimeSignature] = useState('4/4');
  const [editSongEnableClick, setEditSongEnableClick] = useState(false);
  const [editSongEnableVoiceCues, setEditSongEnableVoiceCues] = useState(false);
  const [editSongVoiceGender, setEditSongVoiceGender] = useState('female');

  const [metronomeActive, setMetronomeActive] = useState(false);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(-1);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(() => localStorage.getItem('metronomeAudioDevice') || '');
  const lastSpokenSectionRef = React.useRef(''); // tracks songId::section::firstSlideIdx

  const handleKeyChange = (targetKey, isAddModal) => {
    const currentKey = isAddModal ? newSongKey : editSongKey;
    const semitones = getSemitoneDifference(currentKey, targetKey);

    if (isAddModal) {
      setNewSongKey(targetKey);
      if (semitones !== 0 && newSongChordsRaw) {
        setNewSongChordsRaw(prev => transposeChordChart(prev, semitones));
      }
    } else {
      setEditSongKey(targetKey);
      if (semitones !== 0 && editSongChordsRaw) {
        setEditSongChordsRaw(prev => transposeChordChart(prev, semitones));
      }
    }
  };

  // Appearance / Custom Theme states matching UI specs
  const [appearanceMode, setAppearanceMode] = useState(() => localStorage.getItem('appearanceMode') || 'Dark');
  
  const [lightBg, setLightBg] = useState(() => localStorage.getItem('lightBg') || '#F8FAFC');
  const [lightFg, setLightFg] = useState(() => localStorage.getItem('lightFg') || '#0F172A');
  const [lightAccent, setLightAccent] = useState(() => localStorage.getItem('lightAccent') || '#4F46E5');

  const [darkBg, setDarkBg] = useState(() => localStorage.getItem('darkBg') || '#121212');
  const [darkFg, setDarkFg] = useState(() => localStorage.getItem('darkFg') || '#F1F5F9');
  const [darkAccent, setDarkAccent] = useState(() => localStorage.getItem('darkAccent') || '#6366F1');

  const [lightPreset, setLightPreset] = useState('Default Light');
  const [darkPreset, setDarkPreset] = useState('Default Dark');

  // Auto-update State variables
  const [appVersion, setAppVersion] = useState('1.0.4');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  // Live Output preview animation states
  const [livePreviewFading, setLivePreviewFading] = useState(false);
  const [previewDisplayedText, setPreviewDisplayedText] = useState('');
  const prevLiveTextRef = React.useRef('');

  const [previewLayerA, setPreviewLayerA] = useState({ src: '', type: 'none', opacity: 1, zIndex: 20 });
  const [previewLayerB, setPreviewLayerB] = useState({ src: '', type: 'none', opacity: 0, zIndex: 10 });
  const previewActiveLayerRef = React.useRef('A');
  const previewCurrentBgSrcRef = React.useRef('');

  useEffect(() => {
    if (window.api && window.api.getAppVersion) {
      window.api.getAppVersion().then(v => setAppVersion(v));
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.api || !window.api.checkUpdate) return;
    setCheckingUpdates(true);
    setUpdateInfo(null);
    try {
      const res = await window.api.checkUpdate();
      if (res && res.success) {
        setUpdateInfo(res);
      } else {
        alert(res?.error || 'Failed to check for updates.');
      }
    } catch (e) {
      alert('Error checking for updates: ' + e.message);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.api || !window.api.installUpdate || !updateInfo || !updateInfo.downloadUrl) return;
    setUpdating(true);
    setUpdateProgress(0);
    
    // Set up progress listener
    if (window.api.onUpdateProgress) {
      window.api.onUpdateProgress((progress) => {
        setUpdateProgress(progress);
      });
    }

    try {
      const res = await window.api.installUpdate(updateInfo.downloadUrl, updateInfo.fileName);
      if (res && !res.success) {
        alert('Update installation failed: ' + res.error);
        setUpdating(false);
      }
    } catch (e) {
      alert('Error installing update: ' + e.message);
      setUpdating(false);
    }
  };

  // Animate the live output preview in the operator panel whenever the slide text changes (2-Phase Exit & Entrance Sequence)
  useEffect(() => {
    if (activeSlideText === prevLiveTextRef.current) return;

    const anim = activeSlideStyle?.animation || 'Fade Out';
    const isInstant = anim === 'None' || anim === 'Instant';

    if (isInstant || !activeSlideText) {
      prevLiveTextRef.current = activeSlideText;
      setPreviewDisplayedText(activeSlideText || '');
      setLivePreviewFading(false);
      return;
    }

    const totalMs = activeSlideStyle?.speed
      ? parseFloat(activeSlideStyle.speed.toString().match(/\d+(\.\d+)?/)?.[0] || 0.6) * 1000
      : 600;
    const halfMs = Math.max(40, totalMs / 2);

    // Phase 1: Current text slide plays exit transition
    setLivePreviewFading(true);

    // Phase 2: After exit transition finishes (opacity 0), switch to new slide text and play entrance transition
    const t = setTimeout(() => {
      prevLiveTextRef.current = activeSlideText;
      setPreviewDisplayedText(activeSlideText || '');
      setLivePreviewFading(false);
    }, halfMs);

    return () => clearTimeout(t);
  }, [activeSlideText, clearLyrics, blackout]);

  // One-time check to migrate old storage keys to new premium theme defaults
  useEffect(() => {
    const cachedLight = localStorage.getItem('lightBg');
    const cachedDark = localStorage.getItem('darkBg');
    
    if (cachedLight === '#EEEEEE' || !cachedLight) {
      setLightBg('#F8FAFC');
      setLightFg('#0F172A');
      setLightAccent('#4F46E5');
    }
    if (cachedDark === '#0B0F19' || cachedDark === '#101010' || !cachedDark) {
      setDarkBg('#121212');
      setDarkFg('#F1F5F9');
      setDarkAccent('#6366F1');
    }
  }, []);

  // Text Styling toolbar states (shared across Add/Edit workflows)
  const [songFont, setSongFont] = useState('Inter');
  const [songSize, setSongSize] = useState(90);
  const [songWeight, setSongWeight] = useState('bold'); // Default bold weight settings
  const [songLineHeight, setSongLineHeight] = useState(1.4);
  const [songLetterSpacing, setSongLetterSpacing] = useState(0);
  const [songColor, setSongColor] = useState('#ffffff');
  const [songBgColor, setSongBgColor] = useState('#000000');
  const [songBgOpacity, setSongBgOpacity] = useState('0%');
  const [songAlign, setSongAlign] = useState('center');
  const [songVertical, setSongVertical] = useState('center');
  const [songAnimation, setSongAnimation] = useState('Fade Out');
  const [songSpeed, setSongSpeed] = useState('0.6');
  const [songBgHeight, setSongBgHeight] = useState(100);
  const [songBgWidth, setSongBgWidth] = useState(100);
  const [songBgRadius, setSongBgRadius] = useState(4);

  // Form Cursor/Focus synchronization indexes for real-time preview highlight
  const [activeAddPreviewIdx, setActiveAddPreviewIdx] = useState(0);
  const [activeEditPreviewIdx, setActiveEditPreviewIdx] = useState(0);

  // Add Song Form states
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongSlidesRaw, setNewSongSlidesRaw] = useState('');
  const [addSlideStyleOverrides, setAddSlideStyleOverrides] = useState({});

  // Edit Song Form states
  const [editSongTitle, setEditSongTitle] = useState('');
  const [editSongSlidesRaw, setEditSongSlidesRaw] = useState('');
  const [editSlideStyleOverrides, setEditSlideStyleOverrides] = useState({});

  // Floating Audio track details
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [volume, setVolume] = useState(80);

  // Right-click context menu state for song library items
  const [contextMenu, setContextMenu] = useState(null); // { x: number, y: number, songId: number }

  const [stageActive, setStageActive] = useState(false);
  const [stageServerUrl, setStageServerUrl] = useState(null);
  const [stageMessage, setStageMessage] = useState('');
  const [typedMessage, setTypedMessage] = useState('');
  const [previewClockTime, setPreviewClockTime] = useState('');

  const [stageShowClock, setStageShowClock] = useState(true);
  const [stageShowSlideIndex, setStageShowSlideIndex] = useState(false);
  const [stageShowNextPreview, setStageShowNextPreview] = useState(true);
  const [stageTextStyle, setStageTextStyle] = useState('Upper-case Bold');
  const [stageLeftWidthPct, setStageLeftWidthPctState] = useState(parseFloat(localStorage.getItem('stageLayout_leftWidthPct') || '75'));
  const [stagePanelVisibility, setStagePanelVisibility] = useState({ nextLyrics: true, message: true, scripture: true, presenterNotes: true });
  const [stagePanelHeights, setStagePanelHeights] = useState({ nextLyrics: 35, message: 35, scripture: 15, presenterNotes: 15 });
  const [stageUpNextFontSize, setStageUpNextFontSize] = useState(parseInt(localStorage.getItem('stageUpNextFontSize') || '20'));
  const [stageMainFontSize, setStageMainFontSize] = useState(() => parseInt(localStorage.getItem('stageMainFontSize') || '90'));
  const [stageLabelFontSize, setStageLabelFontSize] = useState(() => parseInt(localStorage.getItem('stageLabelFontSize') || '18'));
  const [stageTopLineColor, setStageTopLineColor] = useState(() => localStorage.getItem('stageTopLineColor') || '#334155');
  const [stageMiddleLineColor, setStageMiddleLineColor] = useState(() => localStorage.getItem('stageMiddleLineColor') || '#0284c7');
  const [stageMainLineColor, setStageMainLineColor] = useState(() => localStorage.getItem('stageMainLineColor') || '#7dd3fc');
  const [stageUpNextLineColor, setStageUpNextLineColor] = useState(() => localStorage.getItem('stageUpNextLineColor') || '#f97316');

  useEffect(() => {
    localStorage.setItem('stageTopLineColor', stageTopLineColor);
  }, [stageTopLineColor]);
  useEffect(() => {
    localStorage.setItem('stageMiddleLineColor', stageMiddleLineColor);
  }, [stageMiddleLineColor]);
  useEffect(() => {
    localStorage.setItem('stageMainLineColor', stageMainLineColor);
  }, [stageMainLineColor]);
  useEffect(() => {
    localStorage.setItem('stageUpNextLineColor', stageUpNextLineColor);
  }, [stageUpNextLineColor]);

  const [displays, setDisplays] = useState([]);
  const [selectedProjectorDisplay, setSelectedProjectorDisplay] = useState(() => {
    const saved = localStorage.getItem('selectedProjectorDisplay');
    return saved !== null ? (saved === 'auto' ? 'auto' : parseInt(saved)) : 1;
  });
  const [selectedStageDisplay, setSelectedStageDisplay] = useState(() => {
    const saved = localStorage.getItem('selectedStageDisplay');
    return saved !== null ? (saved === 'auto' ? 'auto' : parseInt(saved)) : 2;
  });

  useEffect(() => {
    if (selectedProjectorDisplay !== undefined && selectedProjectorDisplay !== null) {
      localStorage.setItem('selectedProjectorDisplay', selectedProjectorDisplay);
    }
  }, [selectedProjectorDisplay]);

  useEffect(() => {
    if (selectedStageDisplay !== undefined && selectedStageDisplay !== null) {
      localStorage.setItem('selectedStageDisplay', selectedStageDisplay);
    }
  }, [selectedStageDisplay]);

  const fetchDisplays = async () => {
    if (window.api && window.api.getDisplays) {
      try {
        const list = await window.api.getDisplays();
        setDisplays(list || []);
        
        // Only set initial defaults if user hasn't selected a display or if list is non-empty
        if (list && list.length > 0) {
          const hasSavedProj = localStorage.getItem('selectedProjectorDisplay') !== null;
          const hasSavedStage = localStorage.getItem('selectedStageDisplay') !== null;

          if (!hasSavedProj) {
            const secondary = list.find(d => !d.isPrimary);
            if (secondary) {
              setSelectedProjectorDisplay(secondary.index);
            } else {
              setSelectedProjectorDisplay(list[0].index);
            }
          }
          if (!hasSavedStage) {
            const secondary = list.find(d => !d.isPrimary);
            const stageTarget = secondary ? list.find(d => d.index !== secondary.index) : list[0];
            if (stageTarget) {
              setSelectedStageDisplay(stageTarget.index);
            } else {
              setSelectedStageDisplay(list[0].index);
            }
          }
        }
      } catch (err) {
        console.error('Failed to get displays:', err);
      }
    }
  };

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setPreviewClockTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshWindowStatuses = async () => {
    if (window.api) {
      try {
        const active = await window.api.getProjectorStatus();
        setIsLiveActive(active);
      } catch (err) {
        console.error('Failed to get projector status:', err);
      }
      try {
        const activeStage = await window.api.getStageStatus();
        setStageActive(activeStage);
      } catch (err) {
        console.error('Failed to get stage status:', err);
      }
    }
    if (window.stageServer) {
      try {
        const urlResult = await window.stageServer.getUrl();
        setStageServerUrl(urlResult?.url || null);
      } catch (err) {
        console.error('Failed to get stage server URL:', err);
      }
    }
  };



  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Initialize store lists and check live status on mount
  useEffect(() => {
    fetchSongs();
    // Retry fetch shortly after mount in case the preload bridge wasn't ready yet
    setTimeout(() => fetchSongs(), 500);
    setTimeout(() => fetchSongs(), 1500);
    fetchPlaylist();
    loadLocalBackgrounds();
    refreshWindowStatuses();
    refreshWindowStatuses();
    fetchDisplays();

    if (window.api && window.api.notifyAppReady) {
      window.api.notifyAppReady();
    }

    // Listen for display changes and refresh
    window.addEventListener('focus', fetchDisplays);
    const displayInterval = setInterval(fetchDisplays, 3000);
    
    if (window.api && window.api.onDisplaysChanged) {
      window.api.onDisplaysChanged(() => {
        fetchDisplays();
      });
    }

    if (window.api && window.api.onProjectorStatusChange) {
      window.api.onProjectorStatusChange((status) => {
        setIsLiveActive(status);
      });
    }

    return () => {
      window.removeEventListener('focus', fetchDisplays);
      clearInterval(displayInterval);
    };
  }, []);

  useEffect(() => {
    loadLocalBackgrounds();
  }, [bgDirectoryPath]);

  const handleToggleProjector = async () => {
    if (window.api && window.api.toggleProjector) {
      try {
        const active = await window.api.toggleProjector(selectedProjectorDisplay);
        setIsLiveActive(active);
      } catch (err) {
        console.error('Failed to toggle projector screen:', err);
      }
    }
  };

  const loadLocalBackgrounds = async (dirPath = bgDirectoryPath) => {
    if (window.api && window.api.readDirectory) {
      try {
        const result = await window.api.readDirectory(dirPath);
        if (result) {
          setBgDirectoryPath(result.currentPath);
          localStorage.setItem('bgDirectoryPath', result.currentPath);
          setMediaList(result.items || []);
        }
      } catch (err) {
        console.error('Failed to load local backgrounds:', err);
      }
    }
  };

  const handleApplyBackground = async () => {
    if (!selectedSong) return;
    const currentSlides = getSlidesArray();
    if (!currentSlides || currentSlides.length === 0) return;

    let targetBg = '';
    if (bgType === 'color') {
      targetBg = bgColorInput || '#000000';
    } else {
      if (stagedBgAsset === null) return;
      targetBg = stagedBgAsset;
    }

    const isColor = bgType === 'color';
    const assetPath = isColor ? '' : targetBg;

    let updatedSlides;
    if (applyToTarget === 'active') {
      updatedSlides = currentSlides.map((slide, idx) => {
        if (selectedSlideIndexes.includes(idx)) {
          const currentStyle = slide.style || {};
          return {
            ...slide,
            bgAsset: assetPath,
            style: {
              ...currentStyle,
              background: targetBg,
              bgHeight: `${bgHeight}%`
            }
          };
        }
        return slide;
      });
    } else if (applyToTarget === 'selected') {
      updatedSlides = currentSlides.map((slide, idx) => {
        if (checklistSlideIndexes.includes(idx)) {
          const currentStyle = slide.style || {};
          return {
            ...slide,
            bgAsset: assetPath,
            style: {
              ...currentStyle,
              background: targetBg,
              bgHeight: `${bgHeight}%`
            }
          };
        }
        return slide;
      });
    } else {
      updatedSlides = currentSlides.map((slide) => {
        const currentStyle = slide.style || {};
        return {
          ...slide,
          bgAsset: assetPath,
          style: {
            ...currentStyle,
            background: targetBg,
            bgHeight: `${bgHeight}%`
          }
        };
      });
    }

    setBgActionStatus('success');
    setTimeout(() => setBgActionStatus('idle'), 1500);

    const contentJson = JSON.stringify(updatedSlides);
    const updatedSongObj = {
      ...selectedSong,
      bgAsset: applyToTarget === 'all' ? assetPath : (selectedSong.bg_asset || selectedSong.bgAsset || ''),
      bg_asset: applyToTarget === 'all' ? assetPath : (selectedSong.bg_asset || selectedSong.bgAsset || ''),
      contentJson,
      content_json: contentJson
    };

    // Optimistically update selectedSong in store so slide cards reflect the new background immediately
    useLibraryStore.setState({ selectedSong: updatedSongObj });

    try {
      await saveSong({
        id: selectedSong.id,
        title: selectedSong.title,
        author: selectedSong.author || 'WorshipFlow',
        key: selectedSong.key || '',
        tempo: selectedSong.tempo || '',
        bgAsset: updatedSongObj.bgAsset,
        contentJson,
        content_json: contentJson
      });
      
      const activeSlide = updatedSlides[activeSlideIndex];
      if (activeSlide) {
        const rawBg = getEffectiveSlideBg(activeSlide, updatedSlides, updatedSongObj);
        const bgPath = formatBgPath(rawBg);
        const effectiveStyle = {
          ...(activeSlide.style || {}),
          animation: songAnimation || activeSlide.style?.animation || 'Fade Out',
          speed: songSpeed || activeSlide.style?.speed || '0.6'
        };
        const isImportMedia = selectedSong.author === 'PowerPoint Import' || selectedSong.author === 'PDF Import' || selectedSong.author === 'Media';
        setLiveSlide(
          isImportMedia ? '' : activeSlide.text,
          activeSlide.label,
          bgPath,
          effectiveStyle
        );
      }
    } catch (err) {
      console.error('Failed to apply background mutation:', err);
    }
  };

  const handleOpenRemoteSync = async () => {
    if (window.stageServer && window.stageServer.getRemoteUrl) {
      try {
        const res = await window.stageServer.getRemoteUrl();
        setRemoteUrl(res.url);
        
        const lyricsLink = res.url.replace('/remote.html', '/lyrics.html');
        setLyricsUrl(lyricsLink);

        const qrData = await QRCode.toDataURL(res.url, {
          width: 256,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        setRemoteQrData(qrData);

        const lQrData = await QRCode.toDataURL(lyricsLink, {
          width: 256,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        setLyricsQrData(lQrData);

        setIsRemoteSyncOpen(true);
      } catch (err) {
        console.error('Failed to generate remote sync QR:', err);
        alert('Could not open remote control server URL: ' + err.message);
      }
    } else {
      alert('Remote sync API not available in this environment.');
    }
  };

  const handleNewPresentation = async () => {
    // If playlist has items and there's no saved file path, offer to save first
    if (playlist && playlist.length > 0) {
      const choice = await window.api?.showMessageBox?.({
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Presentation',
        message: 'Do you want to save the current presentation before starting a new one?',
        detail: presentationFilePath
          ? `Current file: ${presentationFilePath}`
          : 'The current presentation has not been saved.'
      });
      // Cancel
      if (choice === undefined || choice === 2) return;
      // Save
      if (choice === 0) {
        await handleSavePresentation();
      }
      // Don't Save falls through
    }
    await clearPlaylist();
    selectSong(null);
    setPresentationFilePath(null);
    setSearchQuery('');
    setActiveHeaderTab('presentation');
  };

  const handleOpenPresentation = async () => {
    if (!window.api || !window.api.openPresentation) return;
    try {
      const res = await window.api.openPresentation();
      if (res && res.success && res.playlistData) {
        await importPlaylist(res.playlistData);
        setPresentationFilePath(res.filePath);
        setSearchQuery('');
        setActiveHeaderTab('presentation');
        if (res.playlistData.length > 0 && res.playlistData[0].song_id) {
          selectSong(res.playlistData[0].song_id);
        }
      } else if (res && res.error) {
        alert("Failed to load presentation: " + res.error);
      }
    } catch (err) {
      alert("Error loading presentation: " + err.message);
    }
  };

  const handleImportPowerPoint = async () => {
    if (!window.api || !window.api.importPowerPoint) return;
    try {
      const res = await window.api.importPowerPoint();
      if (res && res.success && res.song) {
        await fetchSongs();
        selectSong(res.song.id);
        await addToPlaylist(res.song.title, 'song', res.song.id);
      }
    } catch (err) {
      alert("Failed to import PowerPoint: " + err.message);
    }
  };

  const getMediaType = (url) => {
    if (!url) return 'unknown';
    const cleanUrl = url.toLowerCase().split('?')[0];
    if (/\.(mp4|webm|mov|avi)$/i.test(cleanUrl)) return 'video';
    if (/\.(jpg|jpeg|png|webp|gif)$/i.test(cleanUrl)) return 'image';
    if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(cleanUrl)) return 'audio';
    return 'unknown';
  };

  const detectPlaylistItemType = (item) => {
    if (item.type === 'section') return 'Section';
    const song = songs.find(s => s.id === item.song_id);
    if (!song) return 'Song';
    if (song.author === 'PowerPoint Import') return 'PowerPoint';
    if (song.author === 'PDF Import') return 'PDF';
    if (song.author === 'Media') {
      const mediaType = song.key || 'media';
      return mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    }
    return 'Song';
  };

  const handleAddMediaClick = async () => {
    if (!window.api || !window.api.selectLocalFile) return;
    try {
      const filePath = await window.api.selectLocalFile();
      if (!filePath) return;

      let fileSize = 0;
      if (window.api.getFileSize) {
        fileSize = await window.api.getFileSize(filePath);
      }
      const sizeMB = fileSize / (1024 * 1024);
      if (sizeMB > 300) {
        alert(`Import Failed: Media file size (${sizeMB.toFixed(1)}MB) exceeds the 300MB safety limit to prevent lag.`);
        return;
      }

      const filename = filePath.split(/[\\/]/).pop();
      const extension = filename.split('.').pop().toLowerCase();
      
      const type = getMediaType(filePath);
      if (type === 'unknown') {
        alert("Unsupported media type: Please select an Image, Video, or Audio file.");
        return;
      }

      // Format clean path
      const formattedPath = formatBgPath(filePath);

      // Create slide content schema representing this media item
      const contentJson = JSON.stringify([{
        label: type.toUpperCase(),
        text: '',
        bgAsset: formattedPath,
        style: {
          background: formattedPath,
          animation: 'Instant',
          speed: 'Fast (0.3s)'
        }
      }]);

      const saved = await window.api.saveSong({
        title: filename,
        author: 'Media',
        key: type, // Store media type in key column
        tempo: '',
        contentJson
      });

      if (saved) {
        await fetchSongs();
        selectSong(saved.id);

        // Add to presentations flow lineup
        await addToPlaylist(saved.title, 'song', saved.id);
      }
    } catch (err) {
      console.error('Failed to import media file:', err);
      alert('Failed to import media: ' + err.message);
    }
  };

  const handleImportPDF = async () => {
    if (!window.api || !window.api.importPDF) return;
    try {
      // Step 1: Main opens dialog, returns file path + outputDir
      const res = await window.api.importPDF();
      if (!res || !res.success) return;
      
      if (res.needsRendering) {
        // Step 2: Render PDF pages in browser context (DOMMatrix/Canvas available here)
        const pdfjsLib = await import('pdfjs-dist');
        // Use bundled worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url
        ).toString();

        const fileUrl = `file:///${res.filePath.replace(/\\/g, '/')}`;
        // pdfjs expects an object with a `url` property for remote/local files
        const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // 2x for high resolution
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          pages.push(canvas.toDataURL('image/png'));
        }

        // Step 3: Send rendered PNGs back to main to save to disk + DB
        const saveRes = await window.api.savePdfPages({ title: res.title, outputDir: res.outputDir, pages });
        if (saveRes && saveRes.success && saveRes.song) {
          await fetchSongs();
          selectSong(saveRes.song.id);
          await addToPlaylist(saveRes.song.title, 'song', saveRes.song.id);
        } else {
          alert('Failed to save PDF pages: ' + (saveRes?.error || 'Unknown error'));
        }
      } else if (res.song) {
        // Legacy path (song already saved by main)
        await fetchSongs();
        selectSong(res.song.id);
        await addToPlaylist(res.song.title, 'song', res.song.id);
      }
    } catch (err) {
      console.error('PDF import error:', err);
      alert('Failed to import PDF: ' + err.message);
    }
  };

  const handleSavePresentation = async () => {
    if (!window.api || !window.api.savePresentation) return;
    const res = await window.api.savePresentation(playlist, presentationFilePath);
    if (res && res.success) {
      setPresentationFilePath(res.filePath);
    }
  };

  const handleSavePresentationAs = async () => {
    if (!window.api || !window.api.savePresentation) return;
    const res = await window.api.savePresentation(playlist, null);
    if (res && res.success) {
      setPresentationFilePath(res.filePath);
    }
  };

  const handleDropPlaylist = async (targetIndex) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const reordered = [...playlist];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    setDraggedIndex(null);
    await reorderPlaylist(reordered);
  };
  useEffect(() => {
    if (!isResizingBgPanel) return;

    const handleMouseMove = (e) => {
      const newHeight = window.innerHeight - e.clientY;
      const clampedHeight = Math.min(window.innerHeight * 0.75, Math.max(120, newHeight));
      setBgPanelHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizingBgPanel(false);
      localStorage.setItem('bgPanelHeight', bgPanelHeight);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingBgPanel, bgPanelHeight]);

  // Theme variable applying effect
  useEffect(() => {
    applyThemeConfig();
    localStorage.setItem('appearanceMode', appearanceMode);
    localStorage.setItem('lightBg', lightBg);
    localStorage.setItem('lightFg', lightFg);
    localStorage.setItem('lightAccent', lightAccent);
    localStorage.setItem('darkBg', darkBg);
    localStorage.setItem('darkFg', darkFg);
    localStorage.setItem('darkAccent', darkAccent);
  }, [appearanceMode, lightBg, lightFg, lightAccent, darkBg, darkFg, darkAccent]);

  const applyThemeConfig = () => {
    let activeBg = darkBg;
    let activeFg = darkFg;
    let activeAccent = darkAccent;

    if (appearanceMode === 'Light') {
      activeBg = lightBg;
      activeFg = lightFg;
      activeAccent = lightAccent;
    } else if (appearanceMode === 'System') {
      const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!isSystemDark) {
        activeBg = lightBg;
        activeFg = lightFg;
        activeAccent = lightAccent;
      }
    }

    const rootEl = document.documentElement;
    rootEl.style.setProperty('--bg-app', activeBg);

    // Calculate complementary panels/borders dynamically to avoid flat grey color-blocking
    if (activeBg.toUpperCase() === '#F8FAFC') {
      rootEl.style.setProperty('--bg-panel', '#FFFFFF');
      rootEl.style.setProperty('--border-app', '#E2E8F0');
      rootEl.style.setProperty('--text-muted', '#64748B');
    } else if (activeBg.toUpperCase() === '#121212') {
      rootEl.style.setProperty('--bg-panel', '#1C1C1C');
      rootEl.style.setProperty('--border-app', '#262626');
      rootEl.style.setProperty('--text-muted', '#A1A1AA');
    } else if (activeBg.toUpperCase() === '#EEEEEE') {
      rootEl.style.setProperty('--bg-panel', '#FFFFFF');
      rootEl.style.setProperty('--border-app', '#D1D5DB');
      rootEl.style.setProperty('--text-muted', '#6B7280');
    } else if (activeBg.toUpperCase() === '#101010') {
      rootEl.style.setProperty('--bg-panel', '#1A1A1A');
      rootEl.style.setProperty('--border-app', '#2A2A2A');
      rootEl.style.setProperty('--text-muted', '#8A8A8A');
    } else {
      const r = parseInt(activeBg.slice(1, 3), 16) || 0;
      const g = parseInt(activeBg.slice(3, 5), 16) || 0;
      const b = parseInt(activeBg.slice(5, 7), 16) || 0;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      const offset = brightness > 128 ? -8 : 12;
      const nr = Math.min(255, Math.max(0, r + offset));
      const ng = Math.min(255, Math.max(0, g + offset));
      const nb = Math.min(255, Math.max(0, b + offset));
      
      const panelColor = `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
      rootEl.style.setProperty('--bg-panel', panelColor);
      rootEl.style.setProperty('--border-app', brightness > 128 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)');
      rootEl.style.setProperty('--text-muted', brightness > 128 ? '#4B5563' : '#9CA3AF');
    }
    
    rootEl.style.setProperty('--text-main', activeFg);
    rootEl.style.setProperty('--brand', activeAccent);

    // Label color: auto-compute a readable label text color from the background
    // Use white on dark themes, dark on light themes
    const bgR = parseInt((activeBg || '#121212').slice(1,3), 16) || 0;
    const bgG = parseInt((activeBg || '#121212').slice(3,5), 16) || 0;
    const bgB = parseInt((activeBg || '#121212').slice(5,7), 16) || 0;
    const bgBright = (bgR * 299 + bgG * 587 + bgB * 114) / 1000;
    // Derive label color that contrasts both background and accent
    const acR = parseInt((activeAccent || '#6366F1').slice(1,3), 16) || 0;
    const acG = parseInt((activeAccent || '#6366F1').slice(3,5), 16) || 0;
    const acB = parseInt((activeAccent || '#6366F1').slice(5,7), 16) || 0;
    const acBright = (acR * 299 + acG * 587 + acB * 114) / 1000;
    // Pick white or a light grey that reads well on the accent color
    const labelColor = acBright > 160 ? '#1E293B' : '#FFFFFF';
    rootEl.style.setProperty('--label-text', labelColor);

    // Synchronize native window titlebar overlay colors with theme state
    if (window.api && window.api.updateTitleBar) {
      const panelColor = rootEl.style.getPropertyValue('--bg-panel').trim();
      window.api.updateTitleBar({
        color: panelColor || '#1C1C1C',
        symbolColor: activeFg || '#E2E8F0'
      });
    }
  };

  // Reset helpers for settings presets
  const handleLightPresetChange = (val) => {
    setLightPreset(val);
    if (val === 'Default Light') {
      setLightBg('#F8FAFC');
      setLightFg('#0F172A');
      setLightAccent('#4F46E5');
    }
  };

  const handleDarkPresetChange = (val) => {
    setDarkPreset(val);
    if (val === 'Default Dark') {
      setDarkBg('#121212');
      setDarkFg('#F1F5F9');
      setDarkAccent('#6366F1');
    }
  };

  // File presentation hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && e.key.toUpperCase() === 'S') {
          e.preventDefault();
          handleSavePresentationAs();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSavePresentation();
        } else if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          handleOpenPresentation();
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          handleNewPresentation();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playlist, presentationFilePath]);

  // Close File dropdown on outside click
  useEffect(() => {
    if (!isFileDropdownOpen) return;
    const handleOutsideClick = () => {
      setIsFileDropdownOpen(false);
    };
    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
    };
  }, [isFileDropdownOpen]);

  // Countdown timer logic
  useEffect(() => {
    let timer = null;
    if (isCountdownRunning) {
      timer = setInterval(() => {
        if (countdownMode === 'current') {
          const now = new Date();
          setCountdownMinutes(now.getHours());
          setCountdownSeconds(now.getMinutes());
          // We can use countdownSeconds to track minutes, but to show hh:mm:ss let's store hours in minutes and minutes in seconds, or let's inspect how the display formats it.
          // Since the display does:
          // {String(countdownMinutes).padStart(2, '0')}:{String(countdownSeconds).padStart(2, '0')}
          // Let's set countdownMinutes = hours, and countdownSeconds = minutes, and maybe we can show hours:minutes.
          // If the user wants 24h format clock display, we can use now.getHours() and now.getMinutes().
        } else if (countdownMode === 'target') {
          const parts = countdownTargetTime.split(':');
          const target = new Date();
          target.setHours(parseInt(parts[0]) || 0, parseInt(parts[1]) || 0, 0, 0);
          if (target < new Date()) {
            target.setDate(target.getDate() + 1);
          }
          const diffMs = target - new Date();
          const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
          if (diffSecs <= 0) {
            if (countdownOvertime) {
              if (countdownSeconds < 59) {
                setCountdownSeconds(countdownSeconds + 1);
              } else {
                setCountdownMinutes(countdownMinutes + 1);
                setCountdownSeconds(0);
              }
            } else {
              setIsCountdownRunning(false);
              setCountdownMinutes(0);
              setCountdownSeconds(0);
            }
          } else {
            setCountdownMinutes(Math.floor(diffSecs / 60));
            setCountdownSeconds(diffSecs % 60);
          }
        } else {
          // Duration Mode
          if (countdownSeconds > 0) {
            setCountdownSeconds(countdownSeconds - 1);
          } else if (countdownMinutes > 0) {
            setCountdownMinutes(countdownMinutes - 1);
            setCountdownSeconds(59);
          } else {
            if (countdownOvertime) {
              if (countdownSeconds < 59) {
                setCountdownSeconds(countdownSeconds + 1);
              } else {
                setCountdownMinutes(countdownMinutes + 1);
                setCountdownSeconds(0);
              }
            } else {
              setIsCountdownRunning(false);
              clearInterval(timer);
            }
          }
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isCountdownRunning, countdownMinutes, countdownSeconds, countdownMode, countdownTargetTime, countdownOvertime]);

  // Count-up Timer ticking logic
  useEffect(() => {
    let interval = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev < 59) {
            return prev + 1;
          } else {
            setTimerMinutes(m => m + 1);
            return 0;
          }
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Scroll active preview cards into view automatically
  useEffect(() => {
    if (isAddSongOpen) {
      const activeCard = document.getElementById(`add-preview-card-${activeAddPreviewIdx}`);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeAddPreviewIdx, isAddSongOpen]);

  useEffect(() => {
    if (isEditSongOpen) {
      const activeCard = document.getElementById(`edit-preview-card-${activeEditPreviewIdx}`);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeEditPreviewIdx, isEditSongOpen]);


  const getEffectiveSlideBg = (activeSlide, slidesList, songObject = selectedSong) => {
    if (activeSlide?.bgAsset) return activeSlide.bgAsset;
    if (activeSlide?.style && activeSlide?.style?.background) return activeSlide.style.background;
    if (songObject?.bgAsset) return songObject.bgAsset;
    if (songObject?.style?.background) return songObject.style.background;
    if (slidesList && slidesList.length > 0) {
      const firstSlide = slidesList[0];
      if (firstSlide?.bgAsset) return firstSlide.bgAsset;
      if (firstSlide?.style && firstSlide?.style?.background) return firstSlide.style.background;
    }
    return '';
  };

  // Sync state selection to trigger live preview text updates
  const handleSelectSlide = (index, slidesList, songObject = selectedSong) => {
    if (countdownActive && (countdownShowOn === 'both' || countdownShowOn === 'main')) {
      setCountdownShowOn('stage');
    }
    if (timerActive && (timerShowOn === 'both' || timerShowOn === 'main')) {
      setTimerShowOn('stage');
    }
    setActiveSlideIndex(index);
    const activeSlide = slidesList && slidesList[index];
    if (activeSlide) {
      setLiveSong(songObject);
      setLiveSlides(slidesList);
      setLiveActiveIndex(index);

      const rawBg = getEffectiveSlideBg(activeSlide, slidesList, songObject);
      const bgPath = formatBgPath(rawBg);
      
      // Determine if it is a Bible slide
      const isBible = (songObject && (songObject.author === 'Bible' || songObject.author === 'Scripture'))
                       || bibleLiveSlides !== null
                       || activeSlide.label?.includes('Scripture')
                       || activeSlide.isBible;

      const effectiveStyle = {
        ...(activeSlide.style || {}),
        animation: songAnimation || activeSlide.style?.animation || 'Fade Out',
        speed: songSpeed || activeSlide.style?.speed || '0.6'
      };

      const isImportOrMedia = (songObject && (songObject.author === 'PowerPoint Import' || songObject.author === 'PDF Import' || songObject.author === 'Media')) || isBible;
      setLiveSlide(
        isImportOrMedia ? '' : activeSlide.text, 
        activeSlide.label, 
        bgPath,
        effectiveStyle,
        isBible
      );

      // Trigger Section Voice Cue ONLY on the FIRST slide of each section block instance (e.g. 1st Chorus, 2nd Chorus, 3rd Chorus, etc.)
      const activeSongObj = songObject || selectedSong;
      if (activeSlide && activeSlide.label && activeSongObj) {
        const shouldVoiceCue = activeSongObj.enable_voice_cues || activeSongObj.enableVoiceCues;
        if (shouldVoiceCue) {
          const slidesList2 = slidesList || [];
          const normalizeLabel = (l) => (l || '').toString().toUpperCase().trim().replace(/x\d+/gi, '').trim();
          
          const currLabel = normalizeLabel(activeSlide.label);
          const prevLabel = index > 0 ? normalizeLabel(slidesList2[index - 1]?.label) : '';

          // A slide is the start of a section block if it is index 0 OR its label differs from the previous slide
          const isSectionStart = index === 0 || (currLabel !== prevLabel);

          const songId = (activeSongObj.id || 'unknown').toString();
          const cueKey = `${songId}::slide_${index}`;

          if (isSectionStart && currLabel) {
            if (lastSpokenSectionRef.current !== cueKey) {
              metronomeEngine.setVoiceGender(activeSongObj.voice_gender || activeSongObj.voiceGender || 'female');
              metronomeEngine.triggerVoiceCue(activeSlide.label);
              lastSpokenSectionRef.current = cueKey;
            }
          } else {
            // Mid-section slide (e.g. 2nd line of Chorus) — update tracking so revisiting section start re-fires
            lastSpokenSectionRef.current = `${songId}::mid_${index}`;
          }
        }
      }
      if (songObject && songObject.author === 'Media') {
        setMediaPlaying(true);
      }
    }
  };

  const handleGoLiveBible = (slidesList) => {
    if (!bibleLiveSlides) {
      setSavedPresentationState({
        songId: selectedSong ? selectedSong.id : null,
        slideIndex: activeSlideIndex
      });
    }
    setBibleLiveSlides(slidesList);
    setActiveSlideIndex(0);
    setSelectedSlideIndexes([0]);
    handleSelectSlide(0, slidesList, null);
  };

  const handleExitLiveBible = async () => {
    setBibleLiveSlides(null);
    if (savedPresentationState) {
      const { songId, slideIndex } = savedPresentationState;
      if (songId) {
        setRestoreSlideIndex(slideIndex);
        await selectSong(songId);
      } else {
        setLiveSlide('', '', '', null, false);
        setActiveSlideIndex(0);
        setSelectedSlideIndexes([0]);
        setLiveSong(null);
        setLiveSlides([]);
        setLiveActiveIndex(0);
      }
      setSavedPresentationState(null);
    } else {
      setLiveSlide('', '', '', null, false);
      setActiveSlideIndex(0);
      setSelectedSlideIndexes([0]);
      setLiveSong(null);
      setLiveSlides([]);
      setLiveActiveIndex(0);
    }
  };



  // Fetch slide lists from JSON string
  const getSlidesArray = () => {
    if (bibleLiveSlides) {
      return bibleLiveSlides;
    }
    if (selectedSong && selectedSong.content_json) {
      try {
        return JSON.parse(selectedSong.content_json);
      } catch (e) {
        console.error('Failed parsing song JSON:', e);
        return [];
      }
    }
    return [];
  };

  const slides = getSlidesArray();
  const isMediaItem = selectedSong && selectedSong.author === 'Media';
  const showOnProjector = countdownActive && isCountdownRunning && (countdownShowOn === 'both' || countdownShowOn === 'main');
  const showTimerOnProjector = timerActive && isTimerRunning && (timerShowOn === 'both' || timerShowOn === 'main');

  // Automatically push real-time stage & projector updates on any slide/countdown/message/projector state changes
  useEffect(() => {
    if (window.api) {
      const countdownTimeStr = countdownMode === 'current'
        ? (() => {
            const now = new Date();
            const hrs = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const secs = String(now.getSeconds()).padStart(2, '0');
            return `${hrs}:${mins}:${secs}`;
          })()
        : `${String(countdownMinutes).padStart(2, '0')}:${String(countdownSeconds).padStart(2, '0')}`;
      const timerTimeStr = `${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}`;
      
      // 1. Send Stage updates - show countdown/timer only if enabled for stage display and running
      const showOnStage = countdownActive && isCountdownRunning && (countdownShowOn === 'both' || countdownShowOn === 'stage');
      const showTimerOnStage = timerActive && isTimerRunning && (timerShowOn === 'both' || timerShowOn === 'stage');
      if (window.api.sendStageUpdate) {
        try {
          const payload = {
            songId: (liveSong && liveSong.id) ? liveSong.id : (selectedSong ? selectedSong.id : null),
            songTitle: (liveSong && liveSong.title) ? liveSong.title : (selectedSong ? selectedSong.title : ''),
            songKey: (liveSong && liveSong.key) ? liveSong.key : (selectedSong ? selectedSong.key : ''),
            chordsText: (liveSong && liveSong.chords_text) ? liveSong.chords_text : (selectedSong ? selectedSong.chords_text : ''),
            text: activeSlideText,
            label: activeSlideLabel || `Slide ${activeSlideIndex + 1}`,
            bgAsset: activeBgAsset,
            style: activeSlideStyle,
            blackout,
            clearLyrics,
            slides: slides || [],
            activeSlideIndex: activeSlideIndex,
            stageLayout: {
              leftWidthPct: stageLeftWidthPct,
              rightPanels: [
                { id: 'message', visible: stagePanelVisibility.message, heightPct: stagePanelHeights.message },
                { id: 'scripture', visible: stagePanelVisibility.scripture, heightPct: stagePanelHeights.scripture },
                { id: 'presenterNotes', visible: stagePanelVisibility.presenterNotes, heightPct: stagePanelHeights.presenterNotes }
              ]
            },
            showClock: stageShowClock,
            showSlideIndex: stageShowSlideIndex,
            showNextPreview: stageShowNextPreview,
            stageTextStyle: stageTextStyle,
            stageUpNextFontSize: stageUpNextFontSize,
            message: stageMessage,
            nextSlideText: slides && slides[activeSlideIndex + 1] ? slides[activeSlideIndex + 1].text : '',
            nextSlideBg: slides && slides[activeSlideIndex + 1] ? formatBgPath(slides[activeSlideIndex + 1].bgAsset) : '',
            nextSlideLabel: slides && slides[activeSlideIndex + 1] ? (slides[activeSlideIndex + 1].label || `Slide ${activeSlideIndex + 2}`) : '',
            countdownTime: showOnStage ? countdownTimeStr : '',
            countdownActive: countdownActive,
            countdownTextColor: countdownTextColor,
            timerTime: showTimerOnStage ? timerTimeStr : '',
            timerActive: timerActive,
            timerTextColor: timerTextColor,
            topLineColor: stageTopLineColor,
            middleLineColor: stageMiddleLineColor,
            mainLineColor: stageMainLineColor,
            upNextLineColor: stageUpNextLineColor,
            bibleFontSize: bibleFontSize,
            bibleRefColor: bibleRefColor,
            stageMainFontSize: stageMainFontSize,
            stageLabelFontSize: stageLabelFontSize
          };
          window.api.sendStageUpdate(JSON.parse(JSON.stringify(payload)));
        } catch (err) {
          console.error('Failed to clone stage update payload, trying selective serialize:', err);
          try {
            window.api.sendStageUpdate({
              text: activeSlideText,
              label: activeSlideLabel || `Slide ${activeSlideIndex + 1}`,
              bgAsset: activeBgAsset,
              blackout,
              clearLyrics,
              activeSlideIndex,
              countdownTime: showOnStage ? countdownTimeStr : '',
              countdownActive: countdownActive,
              timerTime: showTimerOnStage ? timerTimeStr : '',
              timerActive: timerActive
            });
          } catch (e) {
            console.error('Critical stage update fallback failure:', e);
          }
        }
      }

      // 2. Send Projector updates - show countdown/timer only if enabled for main output display
      if (window.api.sendSlideUpdate) {
        try {
          let slidePayload = {};
          if (showOnProjector) {
            slidePayload = {
              countdownActive: true,
              countdownTime: countdownTimeStr,
              countdownTitle,
              countdownSubtext,
              countdownBgColor,
              countdownBgMedia: countdownBgMedia ? formatBgPath(countdownBgMedia) : null,
              countdownTextColor,
              countdownTitleSize,
              countdownTimeSize,
              countdownSubtextSize,
              timerActive: false,
              blackout
            };
          } else if (showTimerOnProjector) {
            slidePayload = {
              timerActive: true,
              timerTime: timerTimeStr,
              timerTitle,
              timerBgColor,
              timerBgMedia: timerBgMedia ? formatBgPath(timerBgMedia) : null,
              timerTextColor,
              timerTitleSize,
              timerTimeSize,
              countdownActive: false,
              blackout
            };
          } else {
            // Send regular slide with dynamically resolved background asset
            const activeSlideObj = slides && slides[activeSlideIndex];
            const resolvedBg = getEffectiveSlideBg(activeSlideObj, slides, selectedSong || liveSong);
            const finalBgAsset = resolvedBg ? formatBgPath(resolvedBg) : (activeBgAsset || '');

            slidePayload = {
              text: activeSlideText,
              label: activeSlideLabel || `Slide ${activeSlideIndex + 1}`,
              bgAsset: finalBgAsset,
              style: activeSlideStyle,
              isImportedSlide: !!(slides && slides[activeSlideIndex] && slides[activeSlideIndex].bgAsset),
              transitionToNext: ((activeSlideIndex > 0 && slides && slides[activeSlideIndex - 1]?.transitionToNext === 'fade') || (activeSlideObj?.transitionToNext === 'fade')) ? 'fade' : 'none',
              countdownActive: false,
              timerActive: false,
              blackout,
              clearLyrics,
              mediaPlaying: isMediaItem ? mediaPlaying : true,
              mediaLoop: isMediaItem ? mediaLoop : true,
              mediaVolume: isMediaItem ? mediaVolume : 0
            };
          }
          window.api.sendSlideUpdate(JSON.parse(JSON.stringify(slidePayload)));
        } catch (err) {
          console.error('Failed to clone slide update payload, trying selective serialize:', err);
          try {
            const activeSlideObj = slides && slides[activeSlideIndex];
            const resolvedBg = getEffectiveSlideBg(activeSlideObj, slides, selectedSong || liveSong);
            const finalBgAsset = resolvedBg ? formatBgPath(resolvedBg) : (activeBgAsset || '');
            window.api.sendSlideUpdate({
              text: activeSlideText,
              label: activeSlideLabel || `Slide ${activeSlideIndex + 1}`,
              bgAsset: finalBgAsset,
              countdownActive: false,
              timerActive: false,
              blackout,
              clearLyrics
            });
          } catch (e) {
            console.error('Critical slide update fallback failure:', e);
          }
        }
      }
    }
  }, [
    activeSlideText, activeSlideLabel, activeBgAsset, activeSlideStyle, blackout, clearLyrics, stageMessage, slides, activeSlideIndex,
    stageLeftWidthPct, stagePanelVisibility, stagePanelHeights, stageShowClock, stageShowSlideIndex, stageShowNextPreview, stageTextStyle, stageUpNextFontSize,
    countdownActive, countdownMinutes, countdownSeconds, countdownTitle, countdownSubtext, countdownBgColor, countdownTextColor, countdownTitleSize, countdownTimeSize, countdownSubtextSize, countdownShowOn,
    timerActive, timerMinutes, timerSeconds, timerTitle, timerBgColor, timerTextColor, timerTitleSize, timerTimeSize, timerShowOn,
    stageTopLineColor, stageMiddleLineColor, stageMainLineColor, stageUpNextLineColor,
    mediaPlaying, mediaLoop, mediaVolume, isLiveActive,
    stageMainFontSize, stageLabelFontSize, bibleFontSize, bibleRefColor, countdownBgMedia, timerBgMedia
  ]);

  // Sync operator volume element ref
  useEffect(() => {
    if (operatorMediaRef.current) {
      operatorMediaRef.current.volume = mediaVolume / 100;
    }
  }, [mediaVolume]);

  // Sync operator playback state on active loop changes
  useEffect(() => {
    if (operatorMediaRef.current) {
      if (mediaPlaying) {
        operatorMediaRef.current.play().catch(e => {});
      } else {
        operatorMediaRef.current.pause();
      }
      operatorMediaRef.current.loop = mediaLoop;
      // Presentation video loops are muted for operator (so sound only comes from the main speakers)
      if (selectedSong && selectedSong.author === 'Media' && selectedSong.key === 'video') {
        operatorMediaRef.current.muted = true;
      } else {
        operatorMediaRef.current.muted = false;
      }
    }

    if (activeBgAsset && sharedVideoCache[formatBgPath(activeBgAsset)]) {
      const vid = sharedVideoCache[formatBgPath(activeBgAsset)];
      if (mediaPlaying) {
        vid.play().catch(e => {});
      } else {
        vid.pause();
      }
    }
  }, [mediaPlaying, mediaLoop, activeBgAsset]);

  // Reset selected slide index to 0 or restore saved index when song changes (no auto go-live)
  useEffect(() => {
    const slidesArr = getSlidesArray();
    if (restoreSlideIndex !== null) {
      const idx = Math.min(restoreSlideIndex, slidesArr.length - 1);
      setActiveSlideIndex(idx);
      setSelectedSlideIndexes([idx]);
      handleSelectSlide(idx, slidesArr, selectedSong);
      setRestoreSlideIndex(null);
    } else {
      setActiveSlideIndex(0);
      setSelectedSlideIndexes([0]);
      
      const isMedia = selectedSong && selectedSong.author === 'Media';
      // Sync live background asset: set new song's background or clear if none
      const effectiveBg = getEffectiveSlideBg(slidesArr[0], slidesArr, selectedSong);
      const bgPath = formatBgPath(effectiveBg);
      const isBibleSlide = (selectedSong && (selectedSong.author === 'Bible' || selectedSong.author === 'Scripture')) || bibleLiveSlides !== null;
      setLiveSlide(isMedia ? '' : activeSlideText, isMedia ? selectedSong.title : activeSlideLabel, bgPath, activeSlideStyle, isBibleSlide);

      // Auto-play local media player only (do not push to projector)
      if (isMedia) {
        setMediaPlaying(true);
      }
    }
  }, [selectedSong]);

  // Sync Live Output Preview Monitor background crossfade (Flick-Free Dual-Layer A/B Engine)
  useEffect(() => {
    const slidesArr = getSlidesArray();
    const curSlideObj = slidesArr && slidesArr[activeSlideIndex];
    const rawBg = getEffectiveSlideBg(curSlideObj, slidesArr, selectedSong || liveSong);
    
    if (!rawBg || blackout) {
      setPreviewLayerA({ src: '', type: 'none', opacity: 0, zIndex: 10 });
      setPreviewLayerB({ src: '', type: 'none', opacity: 0, zIndex: 10 });
      previewCurrentBgSrcRef.current = '';
      return;
    }

    const formatted = formatBgPath(rawBg);
    const type = isBgColor(rawBg) ? 'color' : (/\.(mp4|webm|mov|avi)($|\?)/i.test(rawBg) ? 'video' : 'image');
    const hasTransition = (activeSlideIndex > 0 && slidesArr && slidesArr[activeSlideIndex - 1]?.transitionToNext === 'fade') || (curSlideObj?.transitionToNext === 'fade');

    if (previewCurrentBgSrcRef.current === formatted) {
      return;
    }

    const isFade = hasTransition && previewCurrentBgSrcRef.current !== '';
    previewCurrentBgSrcRef.current = formatted;

    if (previewActiveLayerRef.current === 'A') {
      if (isFade) {
        setPreviewLayerB({ src: formatted, type, opacity: 1, zIndex: 10 });
        setPreviewLayerA(prev => ({ ...prev, opacity: 0, zIndex: 20 }));
        previewActiveLayerRef.current = 'B';
      } else {
        setPreviewLayerB({ src: formatted, type, opacity: 1, zIndex: 20 });
        setPreviewLayerA({ src: '', type: 'none', opacity: 0, zIndex: 10 });
        previewActiveLayerRef.current = 'B';
      }
    } else {
      if (isFade) {
        setPreviewLayerA({ src: formatted, type, opacity: 1, zIndex: 10 });
        setPreviewLayerB(prev => ({ ...prev, opacity: 0, zIndex: 20 }));
        previewActiveLayerRef.current = 'A';
      } else {
        setPreviewLayerA({ src: formatted, type, opacity: 1, zIndex: 20 });
        setPreviewLayerB({ src: '', type: 'none', opacity: 0, zIndex: 10 });
        previewActiveLayerRef.current = 'A';
      }
    }
  }, [activeSlideIndex, selectedSong?.id, liveSong?.id, blackout]);

  // Metronome Click Track & Voice Cue Auto-Start/Stop Sync Effect
  useEffect(() => {
    if (blackout || clearLyrics || !selectedSong) {
      metronomeEngine.stop();
      setMetronomeActive(false);
      return;
    }

    const songBpm = selectedSong.bpm || parseInt(selectedSong.tempo) || 120;
    const songTs = selectedSong.time_signature || selectedSong.timeSignature || '4/4';
    const shouldClick = !!selectedSong.enable_click || !!selectedSong.enableClick;
    const shouldVoiceCue = !!selectedSong.enable_voice_cues || !!selectedSong.enableVoiceCues;

    if (shouldClick || shouldVoiceCue) {
      metronomeEngine.start({
        bpm: songBpm,
        timeSignature: songTs,
        enableClick: shouldClick,
        enableVoiceCues: shouldVoiceCue,
        deviceId: selectedAudioDeviceId
      });
      setMetronomeActive(true);
    } else {
      metronomeEngine.stop();
      setMetronomeActive(false);
    }
  }, [selectedSong, blackout, clearLyrics, selectedAudioDeviceId]);

  // Metronome Visual Beat Pulse Listener
  useEffect(() => {
    metronomeEngine.setOnBeatCallback((beatIdx) => {
      setCurrentBeatIndex(beatIdx);
    });
    return () => {
      metronomeEngine.setOnBeatCallback(null);
    };
  }, []);

  // Handle incoming mobile remote control WebSocket command events
  useEffect(() => {
    if (window.api && window.api.onRemoteCommand) {
      window.api.onRemoteCommand(async (data) => {
        if (!data || !data.command) return;
        
        switch (data.command) {
          case 'next-slide': {
            const targetSlides = bibleLiveSlides || slides;
            const nextIdx = Math.min(targetSlides.length - 1, activeSlideIndex + 1);
            if (nextIdx !== activeSlideIndex) {
              setSelectedSlideIndexes([nextIdx]);
              handleSelectSlide(nextIdx, targetSlides, bibleLiveSlides ? null : liveSong || selectedSong);
            }
            break;
          }
          case 'prev-slide': {
            const targetSlides = bibleLiveSlides || slides;
            const prevIdx = Math.max(0, activeSlideIndex - 1);
            if (prevIdx !== activeSlideIndex) {
              setSelectedSlideIndexes([prevIdx]);
              handleSelectSlide(prevIdx, targetSlides, bibleLiveSlides ? null : liveSong || selectedSong);
            }
            break;
          }
          case 'select-slide': {
            const idx = data.index;
            const targetSlides = bibleLiveSlides || slides;
            if (idx >= 0 && idx < targetSlides.length) {
              setSelectedSlideIndexes([idx]);
              handleSelectSlide(idx, targetSlides, bibleLiveSlides ? null : liveSong || selectedSong);
            }
            break;
          }
          case 'toggle-blackout': {
            setBlackout(prev => !prev);
            break;
          }
          case 'toggle-clear-lyrics': {
            setClearLyrics(prev => !prev);
            break;
          }
          case 'select-playlist-item': {
            const songId = data.songId;
            if (songId) {
              selectSong(songId);
              
              if (window.api && window.api.getSongs) {
                try {
                  const songsList = await window.api.getSongs();
                  const targetSong = songsList.find(s => s.id === songId);
                  if (targetSong && targetSong.author === 'Media') {
                    const mediaSlides = [{
                      text: '',
                      label: targetSong.title,
                      bgAsset: targetSong.filepath,
                      style: null
                    }];
                    setSelectedSlideIndexes([0]);
                    handleSelectSlide(0, mediaSlides, targetSong);
                  }
                } catch (e) {
                  console.error('Failed to auto-live media item from remote:', e);
                }
              }
            }
            break;
          }
          case 'add-song-to-playlist': {
            if (data.songId && data.songTitle) {
              await addToPlaylist(data.songTitle, 'song', data.songId);
              await fetchPlaylist();
            }
            break;
          }
          case 'go-live-bible-raw': {
            try {
              const { bookName, chapter, startVerse, endVerse, translation } = data;
              if (window.api && window.api.queryBible) {
                const results = await window.api.queryBible(translation, bookName, chapter, startVerse, endVerse);
                if (results && results.length > 0) {
                  const chunkVerses = (arr, size = 3) => {
                    const chunks = [];
                    for (let i = 0; i < arr.length; i += size) {
                      chunks.push(arr.slice(i, i + size));
                    }
                    return chunks;
                  };

                  const style = {
                    font: songFont, size: songSize, weight: songWeight,
                    lineHeight: songLineHeight, letterSpacing: songLetterSpacing,
                    color: songColor, bgColor: songBgColor, bgOpacity: songBgOpacity,
                    align: songAlign, vertical: songVertical, animation: songAnimation, speed: songSpeed
                  };

                  const chunks = chunkVerses(results, 3);
                  const bibleSlides = chunks.map(chunk => {
                    const startV = chunk[0].verse;
                    const endV = chunk[chunk.length - 1].verse;
                    const label = `${bookName} ${chapter}:${startV === endV ? startV : `${startV}-${endV}`}`;
                    const text = chunk.map(v => `${v.verse} ${v.text}`).join('\n');
                    return { label, text, style, isBible: true };
                  });

                  handleGoLiveBible(bibleSlides);
                }
              }
            } catch (err) {
              console.error('Failed to go live with Bible verses from remote:', err);
            }
            break;
          }
          case 'control-countdown': {
            const { action } = data;
            if (action === 'start-countdown') {
              setIsCountdownRunning(true);
              setCountdownActive(true);
            } else if (action === 'stop-countdown') {
              setIsCountdownRunning(false);
            } else if (action === 'start-timer') {
              setIsTimerRunning(true);
              setTimerActive(true);
            } else if (action === 'stop-timer') {
              setIsTimerRunning(false);
            } else if (action === 'set-countdown') {
              setCountdownMinutes(data.minutes || 5);
              setCountdownSeconds(data.seconds || 0);
              setCountdownActive(true);
            } else if (action === 'exit-bible') {
              handleExitLiveBible();
            }
            break;
          }
          case 'send-scripture': {
            try {
              const contentJson = JSON.stringify([{ 
                label: 'SCRIPTURE', 
                text: data.text.toUpperCase(),
                style: {
                  font: songFont,
                  size: songSize,
                  weight: songWeight,
                  lineHeight: songLineHeight,
                  letterSpacing: songLetterSpacing,
                  color: songColor,
                  bgColor: songBgColor,
                  bgOpacity: songBgOpacity,
                  align: songAlign,
                  vertical: songVertical,
                  animation: songAnimation,
                  speed: songSpeed
                }
              }]);
              const addedSong = await window.api.createSong({
                title: data.reference,
                author: 'Scripture',
                key: '',
                tempo: '',
                contentJson
              });
              await fetchSongs();
              if (addedSong && addedSong.id) {
                await addToPlaylist(addedSong.title, 'song', addedSong.id);
                await fetchPlaylist();
                await selectSong(addedSong.id);
              }
            } catch (err) {
              console.error('Failed to create/send scripture from remote command:', err);
            }
            break;
          }
        }
      });
    }
  }, [slides, activeSlideIndex, selectedSong, playlist, songFont, songSize, songWeight, songLineHeight, songLetterSpacing, songColor, songBgColor, songBgOpacity, songAlign, songVertical, songAnimation, songSpeed, bibleLiveSlides, liveSong, liveSlides, liveActiveIndex, countdownMinutes, countdownSeconds, countdownActive, timerMinutes, timerSeconds, timerActive]);

  // React ref to hold latest states for the keydown event listener to prevent stale closures
  const keydownStatesRef = React.useRef({
    activeSlideIndex,
    slides,
    bibleLiveSlides,
    liveSong,
    selectedSong
  });

  useEffect(() => {
    keydownStatesRef.current = {
      activeSlideIndex,
      slides,
      bibleLiveSlides,
      liveSong,
      selectedSong
    };
  }, [activeSlideIndex, slides, bibleLiveSlides, liveSong, selectedSong]);

  // Keyboard arrow keys slide navigation controller
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore key events if the user is typing in form inputs or editing textareas
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
         document.activeElement.tagName === 'TEXTAREA' ||
         document.activeElement.isContentEditable)
      ) {
        return;
      }

      const {
        activeSlideIndex: curIdx,
        slides: curSlides,
        bibleLiveSlides: curBibleSlides,
        liveSong: curLiveSong,
        selectedSong: curSelectedSong
      } = keydownStatesRef.current;

      const targetSlides = curBibleSlides || curSlides;
      if (!targetSlides || targetSlides.length === 0) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        
        // If we are viewing a different song in the dashboard than the live song,
        // and there is no active live Bible override,
        // pressing Next should trigger live output for the selected song's first slide!
        if (!curBibleSlides && curSelectedSong && (!curLiveSong || curLiveSong.id !== curSelectedSong.id)) {
          const newSlides = curSelectedSong.content_json ? JSON.parse(curSelectedSong.content_json) : [];
          if (newSlides.length > 0) {
            handleSelectSlide(0, newSlides, curSelectedSong);
            setSelectedSlideIndexes([0]);
          }
          return;
        }

        const nextIdx = Math.min(targetSlides.length - 1, curIdx + 1);
        if (nextIdx !== curIdx) {
          setSelectedSlideIndexes([nextIdx]);
          handleSelectSlide(nextIdx, targetSlides, curBibleSlides ? null : curLiveSong || curSelectedSong);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = Math.max(0, curIdx - 1);
        if (prevIdx !== curIdx) {
          setSelectedSlideIndexes([prevIdx]);
          handleSelectSlide(prevIdx, targetSlides, curBibleSlides ? null : curLiveSong || curSelectedSong);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper functions for matching styling in Live Output preview
  const getLivePreviewTextStyle = () => {
    if (!activeSlideStyle) return { color: '#ffffff', fontWeight: 'bold', fontSize: '4.688cqw', textAlign: 'center' };
    
    const fontVal = activeSlideStyle.font || 'Inter';
    const colorVal = activeSlideStyle.color || '#ffffff';
    
    const weightMap = {
      'normal': 400,
      'semibold': 600,
      'bold': 700,
      'extrabold': 800
    };
    const weightVal = weightMap[activeSlideStyle.weight] || activeSlideStyle.weight || 700;
    const baseSize = activeSlideStyle.size || 90;
    const cqwFontSize = (baseSize / 19.2).toFixed(3);
    const cqwLetterSpacing = ((activeSlideStyle.letterSpacing || 0) / 19.2).toFixed(3);
    
    return {
      fontFamily: `'${fontVal}', sans-serif`,
      fontSize: `${cqwFontSize}cqw`,
      fontWeight: weightVal,
      lineHeight: activeSlideStyle.lineHeight || 1.4,
      letterSpacing: `${cqwLetterSpacing}cqw`,
      color: colorVal,
      textAlign: activeSlideStyle.align || 'center',
      whiteSpace: 'pre-wrap',
      wordBreak: 'keep-all',
      overflowWrap: 'break-word'
    };
  };

  const getLivePreviewOverlayStyle = () => {
    if (!activeSlideStyle) return {};
    
    const hex = activeSlideStyle.bgColor || '#000000';
    const opacityStr = activeSlideStyle.bgOpacity || '0%';
    const opacity = parseInt(opacityStr) || 0;
    
    if (opacity === 0) return { backgroundColor: 'transparent' };
    
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    
    const heightVal = activeSlideStyle.bgHeight !== undefined ? activeSlideStyle.bgHeight : 100;
    const widthVal = activeSlideStyle.bgWidth !== undefined ? activeSlideStyle.bgWidth : 100;
    const radiusVal = activeSlideStyle.bgRadius !== undefined ? activeSlideStyle.bgRadius : 4;
    const cqwRadius = (radiusVal / 19.2).toFixed(3);

    const formattedWidth = typeof widthVal === 'number' || !widthVal.toString().endsWith('%') ? `${widthVal}%` : widthVal;
    const formattedHeight = typeof heightVal === 'number' || !heightVal.toString().endsWith('%') ? `${heightVal}%` : heightVal;

    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity / 100})`,
      borderRadius: `${cqwRadius}cqw`,
      height: formattedHeight,
      width: formattedWidth,
      padding: '0.4em 0.8em',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: activeSlideStyle.vertical === 'top' ? 'flex-start' : activeSlideStyle.vertical === 'bottom' ? 'flex-end' : 'center',
      alignItems: activeSlideStyle.align === 'left' ? 'flex-start' : activeSlideStyle.align === 'right' ? 'flex-end' : 'center'
    };
  };

  const getLivePreviewFlexAlignment = () => {
    if (!activeSlideStyle) return 'justify-center items-center';
    
    const vertical = activeSlideStyle.vertical || 'center';
    const align = activeSlideStyle.align || 'center';
    
    const vClass = vertical === 'top' ? 'justify-start' : vertical === 'bottom' ? 'justify-end' : 'justify-center';
    const hClass = align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center';
    
    return `${vClass} ${hClass}`;
  };

  // Compute the full animation style for the Live Output operator panel preview.
  // Mirrors projector.jsx getAnimationStyles() exactly so the panel shows the same motion.
  const liveOutputAnimStyle = (() => {
    const overlayStyle = getLivePreviewOverlayStyle();

    const anim = activeSlideStyle?.animation || 'Fade Out';
    const speedMs = activeSlideStyle?.speed
      ? parseFloat(activeSlideStyle.speed.match(/\d+(\.\d+)?/)?.[0] || 0.3) * 500
      : 300;
    const dur = speedMs + 'ms';

    let transform = 'none';
    if (anim === 'Zoom In/Out') {
      transform = livePreviewFading ? 'scale(0.90)' : 'scale(1)';
    } else if (anim === 'Slide Left') {
      transform = livePreviewFading ? 'translateX(-18px)' : 'translateX(0)';
    } else if (anim === 'Slide Right') {
      transform = livePreviewFading ? 'translateX(18px)' : 'translateX(0)';
    } else if (anim === 'Slide Up') {
      transform = livePreviewFading ? 'translateY(18px)' : 'translateY(0)';
    }

    return {
      ...overlayStyle,
      transition: anim === 'None' ? 'none' : `opacity ${dur} ease-in-out, transform ${dur} ease-in-out`,
      opacity: (livePreviewFading || clearLyrics || blackout) ? 0 : 1,
      transform,
    };
  })();

  // Color-coded mapping for various slide categories - Solid colors for readability in all themes
  const getLabelBadgeStyle = (label = 'VERSE') => {
    const clean = label ? label.toUpperCase().trim() : 'VERSE';
    if (clean.startsWith('INTRO')) return { bg: 'bg-slate-600', text: 'text-white', border: 'border-slate-700' };
    if (clean.startsWith('VERSE')) return { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-700' };
    if (clean.startsWith('PRE-CHORUS')) return { bg: 'bg-amber-600', text: 'text-white', border: 'border-amber-700' };
    if (clean.startsWith('CHORUS')) return { bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-700' };
    if (clean.startsWith('POST-CHORUS')) return { bg: 'bg-teal-600', text: 'text-white', border: 'border-teal-700' };
    if (clean.startsWith('BRIDGE')) return { bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-700' };
    if (clean.startsWith('REFRAIN')) return { bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-700' };
    if (clean.startsWith('INTERLUDE')) return { bg: 'bg-zinc-600', text: 'text-white', border: 'border-zinc-700' };
    if (clean.startsWith('TAG')) return { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-700' };
    if (clean.startsWith('ENDING')) return { bg: 'bg-red-600', text: 'text-white', border: 'border-red-700' };
    return { bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-800' };
  };

  const getSlideCardBorderClass = (label, isActive, isSelected, isModal = false) => {
    const clean = label ? label.toUpperCase().trim() : 'VERSE';
    if (isActive) {
      const scale = isModal ? 'scale-[1.01]' : 'scale-[1.02]';
      if (clean.startsWith('INTRO')) return `border-slate-500 shadow-[0_0_12px_rgba(100,116,139,0.45)] ${scale}`;
      if (clean.startsWith('VERSE')) return `border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.45)] ${scale}`;
      if (clean.startsWith('PRE-CHORUS')) return `border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.45)] ${scale}`;
      if (clean.startsWith('CHORUS')) return `border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)] ${scale}`;
      if (clean.startsWith('POST-CHORUS')) return `border-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.45)] ${scale}`;
      if (clean.startsWith('BRIDGE')) return `border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.45)] ${scale}`;
      if (clean.startsWith('REFRAIN')) return `border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)] ${scale}`;
      if (clean.startsWith('INTERLUDE')) return `border-zinc-500 shadow-[0_0_12px_rgba(113,113,122,0.45)] ${scale}`;
      if (clean.startsWith('TAG')) return `border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.45)] ${scale}`;
      if (clean.startsWith('OUTRO')) return `border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.45)] ${scale}`;
      return `border-brand shadow-[0_0_12px_rgba(99,102,241,0.45)] ${scale}`;
    }
    
    if (isSelected) {
      return 'border-brand bg-brand/10 scale-[1.01] shadow-[0_0_8px_rgba(99,102,241,0.25)]';
    }
    
    // Inactive slide borders
    if (clean.startsWith('INTRO')) return 'border-slate-500/25 hover:border-slate-500/80';
    if (clean.startsWith('VERSE')) return 'border-blue-500/25 hover:border-blue-500/80';
    if (clean.startsWith('PRE-CHORUS')) return 'border-amber-500/25 hover:border-amber-500/80';
    if (clean.startsWith('CHORUS')) return 'border-emerald-500/25 hover:border-emerald-500/80';
    if (clean.startsWith('POST-CHORUS')) return 'border-teal-500/25 hover:border-teal-500/80';
    if (clean.startsWith('BRIDGE')) return 'border-purple-500/25 hover:border-purple-500/80';
    if (clean.startsWith('REFRAIN')) return 'border-rose-500/25 hover:border-rose-500/80';
    if (clean.startsWith('INTERLUDE')) return 'border-zinc-500/25 hover:border-zinc-500/80';
    if (clean.startsWith('TAG')) return 'border-orange-500/25 hover:border-orange-500/80';
    if (clean.startsWith('OUTRO')) return 'border-red-500/25 hover:border-red-500/80';
    return 'border-[var(--border-app)] hover:border-brand/60';
  };

  // Fuzzy Search trigger
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    searchSongs(val);
  };

  const parseSlidesFromRaw = (rawText, customStyle, styleOverrides = {}, existingSlides = []) => {
    if (!rawText.trim()) return [];
    const blocks = rawText.split(/\n\n+/);
    let lastLabel = 'VERSE';
    return blocks.map((block, idx) => {
      const lines = block.split('\n');
      const firstLine = lines[0].trim();
      const isHeader = /^(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|TAG|PRE-CHORUS|POST-CHORUS|REFRAIN|INTERLUDE|ENDING)/i.test(firstLine);
      
      const label = isHeader ? firstLine.toUpperCase() : lastLabel;
      lastLabel = label;
      const text = (isHeader ? lines.slice(1) : lines).join('\n').trim();
      
      const existing = existingSlides[idx];
      const override = styleOverrides[idx] || {};
      const mergedStyle = { 
        ...customStyle,
        ...override,
        background: existing?.style?.background || ''
      };
      
      return { 
        label, 
        text,
        bgAsset: existing?.bgAsset || '',
        transitionToNext: existing?.transitionToNext || 'none',
        style: mergedStyle
      };
    });
  };

  const formatSlidesToRaw = (slidesList) => {
    if (!slidesList) return '';
    let lastLabel = '';
    return slidesList.map((s, idx) => {
      const currentLabel = s.label || 'VERSE';
      const writeLabel = (idx === 0 || currentLabel !== lastLabel);
      lastLabel = currentLabel;
      return writeLabel ? `${currentLabel}\n${s.text}` : s.text;
    }).join('\n\n');
  };

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!newSongTitle.trim()) return;

    const activeStyle = {
      font: songFont,
      size: songSize,
      weight: songWeight,
      lineHeight: songLineHeight,
      letterSpacing: songLetterSpacing,
      color: songColor,
      bgColor: songBgColor,
      bgOpacity: songBgOpacity,
      align: songAlign,
      vertical: songVertical,
      animation: songAnimation,
      speed: songSpeed,
      bgHeight: songBgHeight,
      bgWidth: songBgWidth,
      bgRadius: songBgRadius
    };

    const parsedSlides = parseSlidesFromRaw(newSongSlidesRaw, activeStyle, addSlideStyleOverrides);
    const contentJson = JSON.stringify(parsedSlides);

    try {
      const saved = await saveSong({
        title: newSongTitle,
        author: 'WorshipFlow',
        key: newSongKey,
        tempo: String(newSongBpm),
        bpm: newSongBpm,
        timeSignature: newSongTimeSignature,
        enableClick: newSongEnableClick,
        enableVoiceCues: newSongEnableVoiceCues,
        voiceGender: newSongVoiceGender,
        contentJson,
        chordsText: newSongChordsRaw
      });
      // Refresh library and also add to current presentation lineup immediately
      await fetchSongs();
      if (saved && saved.id) {
        await addToPlaylist(saved.title, 'song', saved.id);
        await fetchPlaylist();
        await selectSong(saved.id);
      }

      setNewSongTitle('');
      setNewSongSlidesRaw('');
      setNewSongChordsRaw('');
      setNewSongKey('C');
      setNewSongBpm(120);
      setNewSongTimeSignature('4/4');
      setNewSongEnableClick(false);
      setNewSongEnableVoiceCues(false);
      setNewSongVoiceGender('female');
      setSongModalTab('lyrics');
      setIsAddSongOpen(false);
    } catch (err) {
      console.error('Failed to save song:', err);
      alert('Error: Could not save song to database.');
    }
  };

  const handleOpenEdit = () => {
    if (!selectedSong) return;
    setEditSongTitle(selectedSong.title);
    setEditSongSlidesRaw(formatSlidesToRaw(slides));
    setEditSongChordsRaw(selectedSong.chords_text || '');
    setEditSongKey(selectedSong.key || 'C');
    setEditSongBpm(selectedSong.bpm || parseInt(selectedSong.tempo) || 120);
    setEditSongTimeSignature(selectedSong.time_signature || selectedSong.timeSignature || '4/4');
    setEditSongEnableClick(!!selectedSong.enable_click || !!selectedSong.enableClick);
    setEditSongEnableVoiceCues(!!selectedSong.enable_voice_cues || !!selectedSong.enableVoiceCues);
    setEditSongVoiceGender(selectedSong.voice_gender || selectedSong.voiceGender || 'female');
    setSongModalTab('lyrics');

    if (slides && slides.length > 0) {
      const s = slides[0].style || {};
      const overrides = {};
      slides.forEach((slide, i) => {
        if (slide.style && slide.style.size !== undefined && slide.style.size !== (s.size || 90)) {
          overrides[i] = { size: slide.style.size };
        }
      });
      setEditSlideStyleOverrides(overrides);

      setSongFont(s.font || 'Inter');
      setSongSize(s.size || 90);
      setSongWeight(s.weight || 'bold');
      setSongLineHeight(s.lineHeight || 1.4);
      setSongLetterSpacing(s.letterSpacing || 0);
      setSongColor(s.color || '#ffffff');
      setSongBgColor(s.bgColor || '#000000');
      setSongBgOpacity(s.bgOpacity || '0%');
      setSongAlign(s.align || 'center');
      setSongVertical(s.vertical || 'center');
      const loadedAnim = s.animation || 'Fade Out';
      setSongAnimation(loadedAnim === 'Zoom In/Out' ? 'Fade Out' : loadedAnim);
      const loadedSpeed = s.speed || '0.6';
      setSongSpeed(loadedSpeed === 'Medium (0.6s)' || loadedSpeed === 'medium' ? '0.6' : loadedSpeed);
      setSongBgHeight(s.bgHeight !== undefined ? parseInt(s.bgHeight) : 100);
      setSongBgWidth(s.bgWidth !== undefined ? parseInt(s.bgWidth) : 100);
      setSongBgRadius(s.bgRadius !== undefined ? parseInt(s.bgRadius) : 4);
    }
    
    setIsEditSongOpen(true);
  };

  const handleSaveEditSong = async (e) => {
    e.preventDefault();
    if (!selectedSong) return;

    const activeStyle = {
      font: songFont,
      size: songSize,
      weight: songWeight,
      lineHeight: songLineHeight,
      letterSpacing: songLetterSpacing,
      color: songColor,
      bgColor: songBgColor,
      bgOpacity: songBgOpacity,
      align: songAlign,
      vertical: songVertical,
      animation: songAnimation,
      speed: songSpeed,
      bgHeight: songBgHeight,
      bgWidth: songBgWidth,
      bgRadius: songBgRadius
    };

    const existingSlides = selectedSong.content_json ? JSON.parse(selectedSong.content_json) : [];
    const parsedSlides = parseSlidesFromRaw(editSongSlidesRaw, activeStyle, editSlideStyleOverrides, existingSlides);
    const contentJson = JSON.stringify(parsedSlides);

    try {
      await saveSong({
        id: selectedSong.id,
        title: editSongTitle,
        author: 'WorshipFlow',
        key: editSongKey,
        tempo: String(editSongBpm),
        bpm: editSongBpm,
        timeSignature: editSongTimeSignature,
        enableClick: editSongEnableClick,
        enableVoiceCues: editSongEnableVoiceCues,
        voiceGender: editSongVoiceGender,
        contentJson,
        chordsText: editSongChordsRaw
      });
      // Optimistic update so header reflects new BPM/time sig immediately
      useLibraryStore.setState({
        selectedSong: {
          ...selectedSong,
          title: editSongTitle,
          bpm: editSongBpm,
          tempo: String(editSongBpm),
          time_signature: editSongTimeSignature,
          timeSignature: editSongTimeSignature,
          enable_click: editSongEnableClick ? 1 : 0,
          enableClick: editSongEnableClick,
          enable_voice_cues: editSongEnableVoiceCues ? 1 : 0,
          enableVoiceCues: editSongEnableVoiceCues,
          voice_gender: editSongVoiceGender,
          voiceGender: editSongVoiceGender,
          content_json: contentJson,
          contentJson
        }
      });
      setIsEditSongOpen(false);
    } catch (err) {
      console.error('Failed to save edited details:', err);
      alert('Error: Could not save changes to database.');
    }
  };

  const handleDeleteSongClick = async (songId) => {
    if (confirm("Are you sure you want to delete this song from the database?")) {
      await deleteSong(songId);
    }
  };

  const handleUpdateSlideSpecificSize = (index, newSize, isEditModal) => {
    if (isEditModal) {
      setEditSlideStyleOverrides(prev => ({ ...prev, [index]: { ...prev[index], size: newSize } }));
    } else {
      setAddSlideStyleOverrides(prev => ({ ...prev, [index]: { ...prev[index], size: newSize } }));
    }
  };

  const handleAddBlankSlide = async () => {
    if (window.api) {
      try {
        const contentJson = JSON.stringify([{ 
          label: 'BLANK', 
          text: '',
          style: {
            font: songFont,
            size: songSize,
            weight: songWeight,
            lineHeight: songLineHeight,
            letterSpacing: songLetterSpacing,
            color: songColor,
            bgColor: songBgColor,
            bgOpacity: songBgOpacity,
            align: songAlign,
            vertical: songVertical,
            animation: songAnimation,
            speed: songSpeed
          }
        }]);
        const addedSong = await window.api.createSong({
          title: 'Blank Slide',
          author: 'System',
          key: 'None',
          tempo: 'None',
          contentJson
        });
        await fetchSongs();
        await addToPlaylist(addedSong.title, 'blank', addedSong.id);
      } catch (err) {
        console.error('Failed to add blank slide:', err);
      }
    }
  };

  const handleTextareaCursorChange = (e, isAddSong = false) => {
    const selectionStart = e.target.selectionStart;
    const textUpToCursor = e.target.value.substring(0, selectionStart);
    const blocks = textUpToCursor.split(/\n\n+/);
    const activeSlideIdx = blocks.length - 1;
    
    if (isAddSong) {
      setActiveAddPreviewIdx(activeSlideIdx);
      setTimeout(() => {
        const el = document.getElementById(`add-preview-card-${activeSlideIdx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    } else {
      setActiveEditPreviewIdx(activeSlideIdx);
      setTimeout(() => {
        const el = document.getElementById(`edit-preview-card-${activeSlideIdx}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const getPreviewSlides = (rawText, styleOverrides = {}) => {
    const activeStyle = {
      font: songFont,
      size: songSize,
      weight: songWeight,
      lineHeight: songLineHeight,
      letterSpacing: songLetterSpacing,
      color: songColor,
      bgColor: songBgColor,
      bgOpacity: songBgOpacity,
      align: songAlign,
      vertical: songVertical,
      animation: songAnimation,
      speed: songSpeed,
      bgHeight: songBgHeight,
      bgWidth: songBgWidth,
      bgRadius: songBgRadius
    };

    return parseSlidesFromRaw(rawText, activeStyle, styleOverrides);
  };

  const addPreviewSlides = getPreviewSlides(newSongSlidesRaw, addSlideStyleOverrides);
  const editPreviewSlides = getPreviewSlides(editSongSlidesRaw, editSlideStyleOverrides);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-appBg text-textMain font-sans select-none">
      
      {/* 1. Header Navigation Bar */}
      <header className="flex flex-col bg-appPanel z-50 border-b border-b-[var(--border-app)]">
        
        {/* Row 1: Logo & Global Navigation Tabs */}
        <div className="h-12 pl-4 pr-[150px] flex items-center justify-between" style={{ WebkitAppRegion: 'drag' }}>
          <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="flex items-center gap-2">
              <img src={appLogo} alt="WorshipFlow Logo" className="h-6 w-6 object-contain" />
              <span className="font-extrabold text-lg tracking-wide text-textMain">
                WorshipFlow
              </span>
            </div>

            {/* Premium File Dropdown menu */}
            <div className="relative">
              <button
                onClick={() => setIsFileDropdownOpen(!isFileDropdownOpen)}
                className="px-3 py-1 bg-appBg/50 hover:bg-appBg border border-[var(--border-app)] rounded text-xs font-bold text-textMain transition flex items-center gap-1.5"
              >
                <span>File</span>
                <ChevronDown className="h-3 w-3 text-textMuted" />
              </button>
              {isFileDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-48 bg-appPanel border border-[var(--border-app)] rounded-lg shadow-xl py-1 z-50 text-xs text-textMain animate-in fade-in slide-in-from-top-2 duration-100">
                    <button
                      onClick={() => {
                        setIsFileDropdownOpen(false);
                        handleNewPresentation();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-brand hover:text-white flex justify-between items-center transition"
                    >
                      <span>New Presentation</span>
                      <span className="text-[10px] text-textMuted font-mono">Ctrl+N</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsFileDropdownOpen(false);
                        handleOpenPresentation();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-brand hover:text-white flex justify-between items-center transition"
                    >
                      <span>Open Presentation...</span>
                      <span className="text-[10px] text-textMuted font-mono">Ctrl+O</span>
                    </button>
                    <div className="border-t border-[var(--border-app)] my-1" />
                    <button
                      onClick={() => {
                        setIsFileDropdownOpen(false);
                        handleSavePresentation();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-brand hover:text-white flex justify-between items-center transition"
                    >
                      <span>Save Presentation</span>
                      <span className="text-[10px] text-textMuted font-mono">Ctrl+S</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsFileDropdownOpen(false);
                        handleSavePresentationAs();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-brand hover:text-white flex justify-between items-center transition"
                    >
                      <span>Save As...</span>
                      <span className="text-[10px] text-textMuted font-mono">Ctrl+Shift+S</span>
                    </button>
                  </div>
              )}
            </div>

            {/* Global Top Tabs */}
            <nav className="flex items-center gap-1 h-12">
              <button 
                onClick={() => setActiveHeaderTab('presentation')}
                className={`h-12 px-4 text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all ${
                  activeHeaderTab === 'presentation' 
                  ? 'bg-brand text-white border-b-2 border-brand' 
                  : 'text-textMuted hover:text-textMain hover:bg-appBg/30'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Presentation
              </button>
              <button 
                onClick={() => setActiveHeaderTab('songs')}
                className={`h-12 px-4 text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all ${
                  activeHeaderTab === 'songs' 
                  ? 'bg-brand text-white border-b-2 border-brand' 
                  : 'text-textMuted hover:text-textMain hover:bg-appBg/30'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
                Song Library
              </button>

              <button 
                onClick={() => setActiveHeaderTab('scripture')}
                className={`h-12 px-4 text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all ${
                  activeHeaderTab === 'scripture' 
                  ? 'bg-brand text-white border-b-2 border-brand' 
                  : 'text-textMuted hover:text-textMain hover:bg-appBg/30'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Bible Menu
              </button>

              <button 
                onClick={() => setActiveHeaderTab('countdown')}
                className={`h-12 px-4 text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all ${
                  activeHeaderTab === 'countdown' 
                  ? 'bg-brand text-white border-b-2 border-brand' 
                  : 'text-textMuted hover:text-textMain hover:bg-appBg/30'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Countdown
              </button>
              <button 
                onClick={() => setActiveHeaderTab('stage')}
                className={`h-12 px-4 text-xs font-bold tracking-wide flex items-center gap-1.5 transition-all ${
                  activeHeaderTab === 'stage' 
                  ? 'bg-brand text-white border-b-2 border-brand' 
                  : 'text-textMuted hover:text-textMain hover:bg-appBg/30'
                }`}
              >
                <Layout className="h-3.5 w-3.5" />
                Stage Display
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' }}>
            {/* Go Live Toggle button in header */}
            <button 
              onClick={handleToggleProjector}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${
                isLiveActive 
                ? 'bg-liveDanger text-white border border-liveDanger shadow-[0_0_10px_rgba(239,68,68,0.4)] font-mono' 
                : 'bg-appBg border border-[var(--border-app)] text-textMuted hover:text-textMain font-mono'
              }`}
              title={isLiveActive ? "Click to Close Projector Screen" : "Click to Open Projector Screen"}
            >
              <span className={`h-2 w-2 rounded-full ${isLiveActive ? 'bg-white animate-pulse' : 'bg-textMuted'}`}></span>
              {isLiveActive ? 'Live On' : 'Go Live'}
            </button>

            <button 
              onClick={handleOpenRemoteSync}
              className="p-1.5 rounded hover:bg-appBg text-textMuted hover:text-textMain transition"
              title="Remote Control & Devices"
            >
              <Wifi className="h-4 w-4" />
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded hover:bg-appBg text-textMuted hover:text-textMain transition"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Sub-Action Bar */}
        <div className="h-10 bg-appBg px-4 flex items-center gap-6 text-xs text-textMuted border-t border-[var(--border-app)]">
          <button 
            onClick={() => setIsAddSongOpen(true)}
            className="hover:text-textMain flex items-center gap-1.5 font-medium transition"
          >
            <Music className="h-3.5 w-3.5 text-textMuted" />
            Add Song
          </button>

          <button 
            onClick={handleAddMediaClick}
            className="hover:text-textMain flex items-center gap-1.5 font-medium transition"
          >
            <Film className="h-3.5 w-3.5 text-textMuted" />
            Add Media
          </button>

          <button 
            onClick={handleImportPowerPoint}
            className="hover:text-textMain flex items-center gap-1.5 font-medium transition"
          >
            <FileText className="h-3.5 w-3.5 text-textMuted" />
            PowerPoint
          </button>

          <button 
            onClick={handleImportPDF}
            className="hover:text-textMain flex items-center gap-1.5 font-medium transition"
          >
            <FolderOpen className="h-3.5 w-3.5 text-textMuted" />
            PDF
          </button>
        </div>
      </header>

      {/* 2. Main Interface Panel */}
      <div className="flex-1 w-full flex overflow-hidden">
        
        {/* PRESENTATION WORKSPACE */}
        {activeHeaderTab === 'presentation' && (
          <>
            {/* Left Column: Presentation Flow Lineup */}
            <aside className="w-[22%] min-w-[200px] max-w-[280px] shrink-0 flex flex-col bg-appPanel border-r border-[var(--border-app)] select-none">
              {/* Sidebar Header / Title */}
              <div className="p-3 border-b border-[var(--border-app)] flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-textMain tracking-wider font-mono flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-brand" />
                  Presentation Flow
                </span>
                <button
                  onClick={() => setIsAddingSectionInline(true)}
                  className="px-2 py-0.5 border border-[var(--border-app)] text-textMuted hover:text-textMain rounded text-[10px] font-bold transition font-mono uppercase"
                  title="Add Section Name Divider"
                >
                  + Section
                </button>
              </div>

              {/* Search Song Library bar inside sidebar */}
              <div className="p-3 border-b border-[var(--border-app)] relative z-30">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 text-textMuted h-4 w-4" />
                  <input 
                    type="text" 
                    placeholder="Search song library to add..." 
                    value={searchQuery}
                    onChange={(e) => {
                      handleSearchChange(e);
                      setShowSearchSuggestions(true);
                    }}
                    onFocus={() => setShowSearchSuggestions(true)}
                    className="w-full pl-9 pr-3 py-1.5 bg-appBg border border-[var(--border-app)] rounded text-xs text-textMain placeholder-textMuted focus:outline-none focus:border-brand transition"
                  />
                </div>
                {showSearchSuggestions && searchQuery.trim() !== '' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSearchSuggestions(false)} />
                    <div className="absolute left-3 right-3 mt-1 bg-appPanel border border-[var(--border-app)] rounded-lg shadow-2xl py-1.5 z-50 text-xs text-textMain max-h-48 overflow-y-auto scrollbar-thin">
                      {songs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).map(song => (
                        <button
                          key={song.id}
                          onClick={async () => {
                            selectSong(song.id);
                            setShowSearchSuggestions(false);
                            setSearchQuery('');
                            await addToPlaylist(song.title, 'song', song.id);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-brand hover:text-white transition truncate font-medium block"
                        >
                          {song.title}
                        </button>
                      ))}
                      {songs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-1.5 text-textMuted italic">No matches found</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Inline Section Name Adder Form block */}
              {isAddingSectionInline && (
                <div className="p-3 border-b border-[var(--border-app)] bg-appBg/40 flex flex-col gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Enter section name (e.g. WORSHIP)..."
                    value={newSectionNameInline}
                    onChange={e => setNewSectionNameInline(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-appBg border border-[var(--border-app)] rounded text-xs text-textMain placeholder-textMuted focus:outline-none focus:border-brand transition"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsAddingSectionInline(false);
                        setNewSectionNameInline('');
                      }}
                      className="flex-1 py-1 border border-[var(--border-app)] text-textMuted hover:text-textMain rounded text-[10px] font-semibold transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (newSectionNameInline.trim()) {
                          await addToPlaylist(newSectionNameInline.trim(), 'section', null);
                          setIsAddingSectionInline(false);
                          setNewSectionNameInline('');
                        }
                      }}
                      className="flex-1 py-1 bg-brand text-white hover:bg-brand/80 rounded text-[10px] font-semibold transition"
                    >
                      Add Section
                    </button>
                  </div>
                </div>
              )}

              {/* Sidebar Playlist (Presentation Flow) list */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
                {playlist.map((item, index) => {
                  const isSelected = selectedSong && selectedSong.id === item.song_id;
                  const detectedType = detectPlaylistItemType(item);

                  return (
                    detectedType === 'Section' ? (
                      <div 
                        key={item.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPlaylistContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            itemId: item.id,
                            itemName: item.name,
                            itemIndex: index,
                            isSection: true
                          });
                        }}
                        className="py-1 px-1 text-textMain font-bold text-[10px] tracking-wider uppercase font-mono flex items-center justify-between select-none mt-2 first:mt-0 cursor-context-menu"
                      >
                        <span>{item.name}</span>
                      </div>
                    ) : (
                    <div 
                      key={item.id}
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDropPlaylist(index)}
                      onClick={() => {
                        if (item.song_id) {
                          selectSong(item.song_id);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPlaylistContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          itemId: item.id,
                          itemName: item.name,
                          itemIndex: index
                        });
                      }}
                      className={`py-1 px-1.5 rounded-md cursor-grab active:cursor-grabbing group border transition flex items-center justify-between gap-1.5 min-h-[28px] ${
                        isSelected 
                          ? 'bg-brand/10 border-brand/40 text-textMain' 
                          : 'hover:bg-appBg/45 border-transparent text-textMuted hover:text-textMain'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GripVertical className="h-3 w-3 text-textMuted/50 cursor-grab group-hover:text-textMuted transition flex-shrink-0" />
                        
                        {/* Render Icon before the title with distinct colors */}
                        {detectedType === 'PowerPoint' && <PPTIcon className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                        {detectedType === 'PDF' && <PDFIcon className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                        {detectedType !== 'PowerPoint' && detectedType !== 'PDF' && (
                          detectedType === 'Video' ? <Film className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" /> : 
                          detectedType === 'Image' ? <Image className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" /> :
                          <Music className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                        )}
                        
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-[11px] truncate leading-tight">{item.name}</span>
                        </div>
                      </div>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to remove "${item.name}" from the Presentation Flow?`)) {
                            await removeFromPlaylist(item.id);
                            if (isSelected) {
                              const remaining = playlist.filter(p => p.id !== item.id);
                              if (remaining.length > 0) {
                                selectSong(remaining[0].song_id);
                              } else {
                                selectSong(null);
                              }
                            }
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-liveDanger/10 hover:text-liveDanger text-textMuted rounded transition-all"
                        title="Remove from Flow"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  )
                  );
                })}

                {playlist.length === 0 && (
                  <div className="text-center py-12 px-4 border border-dashed border-[var(--border-app)] rounded-lg text-textMuted text-xs mt-4">
                    Presentation Flow is empty. Add songs from Search or import PowerPoint/PDF/Media.
                  </div>
                )}
              </div>
            </aside>

            {/* Right-click Context Menu for Playlist Items */}
            {playlistContextMenu && (
              <div 
                className="fixed inset-0 z-[9999]" 
                onClick={() => setPlaylistContextMenu(null)}
                onContextMenu={(e) => { e.preventDefault(); setPlaylistContextMenu(null); }}
              >
                <div 
                  className="absolute bg-appPanel border border-[var(--border-app)] rounded-lg shadow-2xl shadow-black/40 py-1 min-w-[180px] text-xs backdrop-blur-xl"
                  style={{ 
                    left: `${Math.min(playlistContextMenu.x, window.innerWidth - 200)}px`, 
                    top: `${Math.min(playlistContextMenu.y, window.innerHeight - 300)}px` 
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1.5 text-[9px] text-textMuted uppercase font-mono tracking-wider font-bold border-b border-[var(--border-app)] mb-1 truncate">
                    {playlistContextMenu.itemName}
                  </div>
                  
                  {playlistContextMenu.isSection ? (
                    <>
                      {/* Section Context Menu Options */}
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to remove section "${playlistContextMenu.itemName}"?`)) {
                            await removeFromPlaylist(playlistContextMenu.itemId);
                          }
                          setPlaylistContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-liveDanger hover:bg-liveDanger/10 transition flex items-center gap-2"
                      >
                        <Trash className="h-3 w-3" /> Remove Section
                      </button>

                      {playlist.filter((p, i) => detectPlaylistItemType(p) === 'Section' && i !== playlistContextMenu.itemIndex).length > 0 && (
                        <>
                          <div className="border-t border-[var(--border-app)] my-1" />
                          <div className="px-3 py-1 text-[9px] text-textMuted uppercase font-mono tracking-wider">Swap Section with</div>
                          {playlist.map((p, idx) => {
                            if (detectPlaylistItemType(p) !== 'Section' || idx === playlistContextMenu.itemIndex) return null;
                            return (
                              <button
                                key={p.id}
                                onClick={() => {
                                  // Swapping sections involves swapping their items as well, or just swapping the header positions.
                                  // Let's swap the specific header elements in the lineup.
                                  const newList = [...playlist];
                                  const temp = newList[playlistContextMenu.itemIndex];
                                  newList[playlistContextMenu.itemIndex] = newList[idx];
                                  newList[idx] = temp;
                                  reorderPlaylist(newList);
                                  setPlaylistContextMenu(null);
                                }}
                                className="w-full px-3 py-1.5 pl-5 text-left text-textMain hover:bg-brand/10 hover:text-brand transition flex items-center gap-2 truncate"
                              >
                                <Layers className="h-3 w-3 text-[#1E4E79]" />
                                {p.name}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </>
                  ) : (() => {
                      const fromIdx = playlistContextMenu.itemIndex;
                      let startSectionIdx = 0;
                      let endSectionIdx = playlist.length;

                      // Find section header above fromIdx
                      for (let i = fromIdx - 1; i >= 0; i--) {
                        if (detectPlaylistItemType(playlist[i]) === 'Section') {
                          startSectionIdx = i + 1;
                          break;
                        }
                      }
                      // Find next section header after fromIdx
                      for (let i = fromIdx + 1; i < playlist.length; i++) {
                        if (detectPlaylistItemType(playlist[i]) === 'Section') {
                          endSectionIdx = i;
                          break;
                        }
                      }

                      const canMoveUp = fromIdx > startSectionIdx;
                      const canMoveDown = fromIdx < endSectionIdx - 1;

                      return (
                        <>
                          {/* Step-by-Step Move Up / Move Down (Restricted to Section) */}
                          <button
                            disabled={!canMoveUp}
                            onClick={() => {
                              if (canMoveUp) {
                                const newList = [...playlist];
                                const temp = newList[fromIdx];
                                newList[fromIdx] = newList[fromIdx - 1];
                                newList[fromIdx - 1] = temp;
                                reorderPlaylist(newList);
                              }
                              setPlaylistContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-textMain hover:bg-brand/10 hover:text-brand transition flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ArrowUp className="h-3 w-3 text-sky-400" /> Move Up
                          </button>

                          <button
                            disabled={!canMoveDown}
                            onClick={() => {
                              if (canMoveDown) {
                                const newList = [...playlist];
                                const temp = newList[fromIdx];
                                newList[fromIdx] = newList[fromIdx + 1];
                                newList[fromIdx + 1] = temp;
                                reorderPlaylist(newList);
                              }
                              setPlaylistContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-textMain hover:bg-brand/10 hover:text-brand transition flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ChevronDown className="h-3 w-3 text-sky-400" /> Move Down
                          </button>

                          {/* Direct Move to Top / Bottom (Restricted to Section) */}
                          <button
                            disabled={!canMoveUp}
                            onClick={() => {
                              if (canMoveUp) {
                                const newList = [...playlist];
                                const [moved] = newList.splice(fromIdx, 1);
                                newList.splice(startSectionIdx, 0, moved);
                                reorderPlaylist(newList);
                              }
                              setPlaylistContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-textMuted hover:bg-brand/10 hover:text-brand transition flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none text-xs"
                          >
                            <ArrowUp className="h-2.5 w-2.5 opacity-60" /> Move to Top of Section
                          </button>

                          <button
                            disabled={!canMoveDown}
                            onClick={() => {
                              if (canMoveDown) {
                                const newList = [...playlist];
                                const [moved] = newList.splice(fromIdx, 1);
                                newList.splice(endSectionIdx - 1, 0, moved);
                                reorderPlaylist(newList);
                              }
                              setPlaylistContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-textMuted hover:bg-brand/10 hover:text-brand transition flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none text-xs"
                          >
                            <ChevronDown className="h-2.5 w-2.5 opacity-60" /> Move to Bottom of Section
                          </button>

                          {/* Move to Section Submenu */}
                          {playlist.filter(p => detectPlaylistItemType(p) === 'Section').length > 0 && (
                            <>
                              <div className="border-t border-[var(--border-app)] my-1" />
                              <div className="px-3 py-1 text-[9px] text-textMuted uppercase font-mono tracking-wider">Move to Section</div>
                              {playlist.map((p, pIdx) => {
                                if (detectPlaylistItemType(p) !== 'Section') return null;
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => {
                                      const fromIdx = playlistContextMenu.itemIndex;
                                      if (fromIdx !== pIdx && fromIdx !== pIdx + 1) {
                                        const newList = [...playlist];
                                        const [moved] = newList.splice(fromIdx, 1);
                                        // Insert right after the section header
                                        const targetInsertIdx = fromIdx < pIdx ? pIdx : pIdx + 1;
                                        newList.splice(targetInsertIdx, 0, moved);
                                        reorderPlaylist(newList);
                                      }
                                      setPlaylistContextMenu(null);
                                    }}
                                    className="w-full px-3 py-1.5 pl-5 text-left text-textMain hover:bg-[#1E4E79]/20 hover:text-[#5BA3D9] transition flex items-center gap-2 truncate"
                                  >
                                    <Layers className="h-3 w-3 text-[#1E4E79]" />
                                    {p.name}
                                  </button>
                                );
                              })}
                            </>
                          )}

                          {/* Remove */}
                          <div className="border-t border-[var(--border-app)] my-1" />
                          <button
                            onClick={async () => {
                              if (confirm(`Remove "${playlistContextMenu.itemName}" from Presentation Flow?`)) {
                                await removeFromPlaylist(playlistContextMenu.itemId);
                              }
                              setPlaylistContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-liveDanger hover:bg-liveDanger/10 transition flex items-center gap-2"
                          >
                            <Trash className="h-3 w-3" /> Remove from Flow
                          </button>
                        </>
                      );
                    })()}
                </div>
              </div>
            )}

            {/* Center Column: Slide Explorer */}
            <section className="flex-1 min-w-0 flex flex-col bg-appBg">
              {bibleLiveSlides && (
                <div className="bg-emerald-950/80 border-b border-emerald-800/60 px-5 py-3 flex items-center justify-between text-xs text-emerald-400 font-bold uppercase tracking-wider backdrop-blur-md">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Scripture Overlay Active: {bibleLiveSlides[0]?.label || 'Scripture'}
                  </span>
                  <button
                    onClick={handleExitLiveBible}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 rounded font-extrabold transition font-mono tracking-widest text-[10px]"
                  >
                    Exit Live Scripture
                  </button>
                </div>
              )}
              {selectedSong ? (
                <>
                  <div className="min-h-[56px] py-1.5 border-b border-[var(--border-app)] bg-appPanel/60 px-4 flex items-center justify-between flex-wrap sm:flex-nowrap gap-2 overflow-x-auto">
                    <div className="shrink-0 min-w-0">
                      <h2 className="text-sm font-bold text-textMain tracking-wide truncate max-w-[140px] sm:max-w-[220px]" title={selectedSong.title}>
                        {selectedSong.title}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0">
                      {/* Minimal Live Metronome & Click Track Control Bar (BORDERLESS) */}
                      <div className="flex items-center gap-2 px-1 py-0.5 rounded-lg text-xs font-mono select-none border-0">
                        {/* Beat Pulse Indicator */}
                        <div 
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-75 shrink-0 ${
                            currentBeatIndex === 0 
                              ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] scale-110' 
                              : currentBeatIndex > 0 
                                ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]' 
                                : 'bg-slate-700/50'
                          }`}
                          title={metronomeActive ? `Beat ${currentBeatIndex + 1}` : 'Click Track Inactive'}
                        />
                        <span className="text-textMain font-bold text-[11px] whitespace-nowrap">
                          {selectedSong.bpm || parseInt(selectedSong.tempo) || 120} BPM
                        </span>
                        <span className="text-textMuted text-[10px] whitespace-nowrap">
                          ({selectedSong.time_signature || selectedSong.timeSignature || '4/4'})
                        </span>
                        
                        {/* Click Track Toggle */}
                        <button
                          type="button"
                          onClick={async () => {
                            const nextClickState = !(selectedSong.enable_click || selectedSong.enableClick);
                            const optimisticSong = { ...selectedSong, enable_click: nextClickState ? 1 : 0, enableClick: nextClickState };
                            useLibraryStore.setState({ selectedSong: optimisticSong });
                            await saveSong({
                              ...selectedSong,
                              bpm: selectedSong.bpm || parseInt(selectedSong.tempo) || 120,
                              timeSignature: selectedSong.time_signature || '4/4',
                              enableClick: nextClickState,
                              enableVoiceCues: !!(selectedSong.enable_voice_cues || selectedSong.enableVoiceCues),
                              voiceGender: selectedSong.voice_gender || 'female',
                              contentJson: selectedSong.content_json,
                              chordsText: selectedSong.chords_text
                            });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition whitespace-nowrap ${
                            (selectedSong.enable_click || selectedSong.enableClick)
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm' 
                              : 'bg-appBg text-textMuted hover:text-textMain border border-[var(--border-app)]'
                          }`}
                          title="Toggle Click Track for this song"
                        >
                          {(selectedSong.enable_click || selectedSong.enableClick) ? 'Click ON' : 'Click OFF'}
                        </button>

                        {/* Voice Section Cue Toggle */}
                        <button
                          type="button"
                          onClick={async () => {
                            const nextCueState = !(selectedSong.enable_voice_cues || selectedSong.enableVoiceCues);
                            const optimisticSong = { ...selectedSong, enable_voice_cues: nextCueState ? 1 : 0, enableVoiceCues: nextCueState };
                            useLibraryStore.setState({ selectedSong: optimisticSong });
                            await saveSong({
                              ...selectedSong,
                              bpm: selectedSong.bpm || parseInt(selectedSong.tempo) || 120,
                              timeSignature: selectedSong.time_signature || '4/4',
                              enableClick: !!(selectedSong.enable_click || selectedSong.enableClick),
                              enableVoiceCues: nextCueState,
                              voiceGender: selectedSong.voice_gender || 'female',
                              contentJson: selectedSong.content_json,
                              chordsText: selectedSong.chords_text
                            });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition whitespace-nowrap ${
                            (selectedSong.enable_voice_cues || selectedSong.enableVoiceCues)
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm' 
                              : 'bg-appBg text-textMuted hover:text-textMain border border-[var(--border-app)]'
                          }`}
                          title="Toggle Advance Voice Cues for Stage Monitoring"
                        >
                          {(selectedSong.enable_voice_cues || selectedSong.enableVoiceCues) ? 'Cue ON' : 'Cue OFF'}
                        </button>

                        {/* Offline Voice Gender Selector */}
                        <select
                          value={selectedSong.voice_gender || selectedSong.voiceGender || 'female'}
                          onChange={async (e) => {
                            const newGender = e.target.value;
                            metronomeEngine.setVoiceGender(newGender);
                            const optimisticSong = { ...selectedSong, voice_gender: newGender, voiceGender: newGender };
                            useLibraryStore.setState({ selectedSong: optimisticSong });
                            await saveSong({
                              ...selectedSong,
                              bpm: selectedSong.bpm || parseInt(selectedSong.tempo) || 120,
                              timeSignature: selectedSong.time_signature || '4/4',
                              enableClick: !!(selectedSong.enable_click || selectedSong.enableClick),
                              enableVoiceCues: !!(selectedSong.enable_voice_cues || selectedSong.enableVoiceCues),
                              voiceGender: newGender,
                              contentJson: selectedSong.content_json,
                              chordsText: selectedSong.chords_text
                            });
                          }}
                          className="p-0.5 px-1.5 bg-appBg border border-[var(--border-app)] rounded text-textMain text-[10px] font-mono focus:outline-none whitespace-nowrap"
                          title="Select Voice Gender for Section Cues"
                        >
                          <option value="female">Voice: Female</option>
                          <option value="male">Voice: Male</option>
                        </select>
                      </div>

                      {/* Slide Preview Size Control */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold whitespace-nowrap">PREVIEW SIZE:</span>
                        <input 
                          type="range"
                          min="50"
                          max="200"
                          value={slidePreviewSize}
                          onChange={(e) => setSlidePreviewSize(parseInt(e.target.value))}
                          className="w-16 sm:w-20 h-1 bg-[#10141D] rounded-lg appearance-none cursor-pointer accent-brand"
                          title="Slide Preview Size Control"
                        />
                        <input 
                          type="number"
                          min="30"
                          max="300"
                          value={slidePreviewSize}
                          onChange={(e) => setSlidePreviewSize(Math.min(300, Math.max(30, parseInt(e.target.value) || 100)))}
                          className="w-10 p-0.5 text-center bg-appBg border border-[var(--border-app)] rounded text-textMain text-[10px] focus:outline-none focus:border-brand font-mono"
                          title="Slide Preview Size Input"
                        />
                        <span className="text-[10px] font-mono text-textMuted select-none">%</span>
                      </div>

                      {selectedSong.author !== 'PowerPoint Import' && selectedSong.author !== 'PDF Import' && (
                        <button 
                          onClick={handleOpenEdit}
                          className="flex items-center gap-1 px-2.5 py-1 bg-brand text-white hover:bg-brand/80 rounded text-[11px] font-semibold transition shrink-0 whitespace-nowrap"
                        >
                          <Edit className="h-3 w-3" />
                          Edit Song
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Slides Grid / Media Player */}
                  {isMediaItem ? (
                    /* Minimal Integrated Media Player Interface */
                    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-appBg/50 overflow-y-auto">
                      <div className="flex flex-col items-center justify-center max-w-2xl w-full space-y-3">
                        {/* Media Title & Type Header */}
                        <div className="flex justify-between items-center w-full px-1">
                          <h3 className="text-sm font-bold text-textMain tracking-wide truncate max-w-[75%]">{selectedSong.title}</h3>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-brand/20 text-brand border border-brand/30">
                            {getMediaType(slides[0]?.bgAsset).toUpperCase()}
                          </span>
                        </div>

                        {/* Video / Audio Container with Attached Controls at Bottom */}
                        <div className="aspect-video w-full max-w-xl bg-black rounded-xl border border-[var(--border-app)] relative overflow-hidden flex items-center justify-center shadow-2xl group">
                          {getMediaType(slides[0]?.bgAsset) === 'video' && (
                            <video 
                              ref={operatorMediaRef}
                              src={slides[0]?.bgAsset ? formatBgPath(slides[0].bgAsset) : ''}
                              className="w-full h-full object-contain"
                              playsInline
                            />
                          )}
                          {getMediaType(slides[0]?.bgAsset) === 'image' && (
                            <img 
                              src={slides[0]?.bgAsset ? formatBgPath(slides[0].bgAsset) : ''} 
                              className="w-full h-full object-contain" 
                              alt="Media Preview" 
                            />
                          )}
                          {getMediaType(slides[0]?.bgAsset) === 'audio' && (
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="h-16 w-16 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center shadow-lg relative">
                                <Music className={`h-8 w-8 text-brand ${mediaPlaying ? 'animate-bounce' : ''}`} />
                                {mediaPlaying && (
                                  <div className="absolute inset-0 rounded-full border border-brand animate-ping opacity-60" />
                                )}
                              </div>
                              <span className="text-[10px] text-textMuted uppercase font-mono tracking-widest font-bold">Audio Track Active</span>
                              <audio 
                                ref={operatorMediaRef}
                                src={slides[0]?.bgAsset ? formatBgPath(slides[0].bgAsset) : ''}
                                style={{ display: 'none' }}
                              />
                            </div>
                          )}

                          {/* Minimal Integrated Media Controls attached directly at the bottom edge of the video preview */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 pt-6 flex items-center justify-between gap-3 z-20 backdrop-blur-[2px]">
                            {/* Live Projection Toggle Button */}
                            <button
                              onClick={() => handleSelectSlide(0, slides, selectedSong)}
                              className={`px-3 py-1.5 rounded font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                liveSong && selectedSong && liveSong.id === selectedSong.id
                                  ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
                              }`}
                            >
                              <Tv className="h-3.5 w-3.5" />
                              {liveSong && selectedSong && liveSong.id === selectedSong.id ? 'Live on Projector' : 'Project Live'}
                            </button>

                            {/* Playback Transport Controls (Play/Pause, Stop, Loop) */}
                            <div className="flex items-center gap-1.5">
                              {/* Play / Pause Toggle */}
                              <button
                                onClick={() => setMediaPlaying(!mediaPlaying)}
                                className={`p-1.5 px-2.5 rounded text-xs font-bold transition flex items-center gap-1 ${
                                  mediaPlaying 
                                    ? 'bg-brand text-white shadow-md' 
                                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                                }`}
                                title={mediaPlaying ? 'Pause Playback' : 'Play Media'}
                              >
                                {mediaPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                                <span>{mediaPlaying ? 'Pause' : 'Play'}</span>
                              </button>

                              {/* Stop & Reset */}
                              <button
                                onClick={() => {
                                  setMediaPlaying(false);
                                  if (operatorMediaRef.current) {
                                    operatorMediaRef.current.currentTime = 0;
                                  }
                                }}
                                className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10 transition"
                                title="Stop Playback"
                              >
                                <Square className="h-3.5 w-3.5 fill-current" />
                              </button>

                              {/* Accurate Loop Icon (Lucide Repeat) */}
                              <button
                                onClick={() => setMediaLoop(!mediaLoop)}
                                className={`px-2 py-1 rounded text-xs font-mono font-bold transition flex items-center gap-1 border ${
                                  mediaLoop 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' 
                                    : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                                }`}
                                title="Toggle Video Loop"
                              >
                                <Repeat className="h-3.5 w-3.5" />
                                <span>Loop {mediaLoop ? 'ON' : 'OFF'}</span>
                              </button>
                            </div>

                            {/* Volume & Mute Controls */}
                            <div className="flex items-center gap-2 max-w-[140px]">
                              <button
                                onClick={() => setMediaVolume(mediaVolume > 0 ? 0 : 100)}
                                className="text-white/70 hover:text-white transition"
                                title={mediaVolume > 0 ? 'Mute' : 'Unmute'}
                              >
                                {mediaVolume > 0 ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5 text-red-400" />}
                              </button>
                              <input 
                                type="range"
                                min="0"
                                max="100"
                                value={mediaVolume}
                                onChange={(e) => setMediaVolume(parseInt(e.target.value))}
                                className="w-full h-1 bg-white/30 rounded appearance-none cursor-pointer accent-brand"
                              />
                              <span className="text-[10px] font-mono text-white/70 w-6 text-right">{mediaVolume}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-4">
                      {slides.length > 0 ? (
                        /* Flex wrap layout matching slidePreviewSize setting */
                        <div className="flex flex-wrap items-start justify-start gap-1">
                          {slides.map((slide, index) => {
                            const isActive = (bibleLiveSlides !== null || (liveSong && selectedSong && liveSong.id === selectedSong.id)) && index === activeSlideIndex;
                            const isSelected = selectedSlideIndexes.includes(index);
                            const hasTransition = slide?.transitionToNext === 'fade';
                            const prevHasTransition = index > 0 && slides[index - 1]?.transitionToNext === 'fade';
                            return (
                              <React.Fragment key={index}>
                                {/* Transition Hotspot Zone between slides */}
                                {index > 0 && (
                                  <div 
                                    className="flex flex-col items-center justify-center self-stretch relative -mx-1.5 z-10 group"
                                    style={{ width: '20px', minHeight: '60px' }}
                                  >
                                    {/* Visible connector vertical glow line when transition is active */}
                                    {prevHasTransition && (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-0.5 h-full bg-gradient-to-b from-transparent via-emerald-400/80 to-transparent rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                      </div>
                                    )}
                                    
                                    {/* Clickable Transition Connector Button (Hidden by default, reveals on hover) */}
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!selectedSong || bibleLiveSlides) return;
                                        const prevIdx = index - 1;
                                        const updatedSlides = [...slides];
                                        const isCurrentlyActive = updatedSlides[prevIdx]?.transitionToNext === 'fade';
                                        const nextTransition = isCurrentlyActive ? 'none' : 'fade';
                                        
                                        updatedSlides[prevIdx] = { ...updatedSlides[prevIdx], transitionToNext: nextTransition };
                                        
                                        const contentJson = JSON.stringify(updatedSlides);

                                        const updatedSongObj = {
                                          ...selectedSong,
                                          id: selectedSong.id,
                                          title: selectedSong.title,
                                          author: selectedSong.author || 'WorshipFlow',
                                          key: selectedSong.key || '',
                                          tempo: selectedSong.tempo || '',
                                          bpm: selectedSong.bpm || parseInt(selectedSong.tempo) || 120,
                                          timeSignature: selectedSong.time_signature || selectedSong.timeSignature || '4/4',
                                          enableClick: !!(selectedSong.enable_click || selectedSong.enableClick),
                                          enableVoiceCues: !!(selectedSong.enable_voice_cues || selectedSong.enableVoiceCues),
                                          voiceGender: selectedSong.voice_gender || selectedSong.voiceGender || 'female',
                                          bgAsset: selectedSong.bg_asset || selectedSong.bgAsset || '',
                                          contentJson,
                                          content_json: contentJson
                                        };

                                        useLibraryStore.setState({ selectedSong: updatedSongObj });
                                        try {
                                          await saveSong(updatedSongObj);
                                        } catch (err) {
                                          console.error('Failed to save transition', err);
                                        }
                                      }}
                                      className={`z-20 p-1.5 rounded-full border shadow-lg transition-all duration-150 cursor-pointer ${
                                        prevHasTransition
                                          ? 'bg-emerald-500/30 border-emerald-400/80 text-emerald-300 shadow-emerald-500/30 scale-100 hover:scale-110 opacity-100'
                                          : 'bg-appPanel/90 border-[var(--border-app)] text-textMuted hover:text-emerald-400 hover:border-emerald-400/60 hover:bg-emerald-500/20 opacity-0 group-hover:opacity-100 hover:scale-110'
                                      }`}
                                      title={prevHasTransition ? 'Remove Fade Transition' : 'Add Slow-Motion Fade Transition'}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                                        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 0 1 0 10V3z" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                                {/* Slide Card */}
                                <div 
                                  onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                      if (selectedSlideIndexes.includes(index)) {
                                        if (selectedSlideIndexes.length > 1) {
                                          setSelectedSlideIndexes(selectedSlideIndexes.filter(i => i !== index));
                                        }
                                      } else {
                                        setSelectedSlideIndexes([...selectedSlideIndexes, index]);
                                      }
                                    } else {
                                      setSelectedSlideIndexes([index]);
                                      handleSelectSlide(index, slides);
                                    }
                                  }}
                                  className={`aspect-video rounded-lg relative overflow-hidden flex flex-col justify-between p-3 cursor-pointer group transition-all duration-200 border-2 ${(slide.bgAsset || (slide.style && slide.style.background)) ? 'bg-black' : 'bg-checkerboard'} ${getSlideCardBorderClass(slide.label, isActive, isSelected)}`}
                                  style={{
                                    containerType: 'inline-size',
                                    width: `${slidePreviewSize * 2.6}px`,
                                    minWidth: '150px',
                                    maxWidth: '420px',
                                    aspectRatio: '16/9'
                                  }}
                                >
                                  {/* Solid Color Background Layer */}
                                  {((slide.style?.background && isBgColor(slide.style.background)) || (slide.bgAsset && isBgColor(slide.bgAsset))) && (
                                    <div 
                                      style={{
                                        position: 'absolute',
                                        left: 0,
                                        right: 0,
                                        height: slide.style?.bgHeight || '100%',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        backgroundColor: (slide.bgAsset && isBgColor(slide.bgAsset)) ? slide.bgAsset : (slide.style?.background || '#000000'),
                                        zIndex: 0
                                      }}
                                    />
                                  )}

                                  {/* bgAsset: full-cover slide image (PowerPoint/PDF imports) */}
                                  {slide.bgAsset && !isBgColor(slide.bgAsset) && (
                                    <div className="absolute inset-0 z-0 w-full h-full">
                                      <img 
                                        src={formatBgPath(slide.bgAsset)}
                                        className="w-full h-full object-cover opacity-100" 
                                        loading="lazy"
                                        alt=""
                                      />
                                    </div>
                                  )}
                                  {/* style.background overlay: shared video/image background for songs */}
                                  {!slide.bgAsset && (slide.style && slide.style.background) && !isBgColor(slide.style.background) && (
                                    <div className="absolute inset-0 z-0 w-full h-full">
                                      {/\.(mp4|webm|mov|avi)($|\?)/i.test(slide.style.background) ? (
                                        <SharedVideoCanvas 
                                          src={slide.style.background}
                                          maxResWidth={240}
                                          fps={12}
                                          className="w-full h-full object-cover opacity-100" 
                                          style={{ willChange: 'transform', transform: 'translate3d(0,0,0)' }}
                                        />
                                      ) : (
                                        <img 
                                          src={formatBgPath(slide.style.background)} 
                                          className="w-full h-full object-cover opacity-100" 
                                          loading="lazy"
                                          alt="" 
                                        />
                                      )}
                                    </div>
                                  )}
                                  <div className="z-10 flex justify-between">
                                    <span className="bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-mono text-textMuted">{index + 1}</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${getLabelBadgeStyle(slide.label).bg} ${getLabelBadgeStyle(slide.label).text}`}>{slide.label}</span>
                                  </div>
                                  <div 
                                    className="z-10 flex-1 flex flex-col w-full overflow-hidden"
                                    style={{
                                      justifyContent: slide.style?.vertical === 'top' ? 'flex-start' : slide.style?.vertical === 'bottom' ? 'flex-end' : 'center',
                                      alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
                                    }}
                                  >
                                    {slide.text && (() => {
                                      const hex = slide.style?.bgColor || '#000000';
                                      const opacityStr = slide.style?.bgOpacity || '0%';
                                      const opacity = parseInt(opacityStr) || 0;
                                      const rgbaBg = opacity === 0 
                                        ? 'transparent' 
                                        : (() => {
                                            const r = parseInt(hex.slice(1, 3), 16) || 0;
                                            const g = parseInt(hex.slice(3, 5), 16) || 0;
                                            const b = parseInt(hex.slice(5, 7), 16) || 0;
                                            return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
                                          })();
                                      const cqwRadius = ((slide.style?.bgRadius !== undefined ? slide.style.bgRadius : 4) / 19.2).toFixed(3);
                                      const bgW = slide.style?.bgWidth !== undefined ? slide.style.bgWidth : 100;
                                      const bgH = slide.style?.bgHeight !== undefined ? slide.style.bgHeight : 100;
                                      const formattedW = typeof bgW === 'number' || !bgW.toString().endsWith('%') ? `${bgW}%` : bgW;
                                      const formattedH = typeof bgH === 'number' || !bgH.toString().endsWith('%') ? `${bgH}%` : bgH;

                                      return (
                                        <div 
                                          style={{
                                            backgroundColor: rgbaBg,
                                            borderRadius: `${cqwRadius}cqw`,
                                            width: formattedW,
                                            height: formattedH,
                                            padding: opacity > 0 ? '0.4em 0.8em' : '0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: slide.style?.vertical === 'top' ? 'flex-start' : slide.style?.vertical === 'bottom' ? 'flex-end' : 'center',
                                            alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
                                          }}
                                        >
                                          <p 
                                            style={{
                                              fontFamily: `'${slide.style?.font || 'Inter'}', sans-serif`,
                                              fontSize: `${((slide.style?.size || 90) / 19.2).toFixed(3)}cqw`,
                                              fontWeight: { 'normal': 400, 'semibold': 600, 'bold': 700, 'extrabold': 800 }[slide.style?.weight] || slide.style?.weight || 700,
                                              lineHeight: slide.style?.lineHeight || 1.4,
                                              letterSpacing: `${((slide.style?.letterSpacing || 0) / 19.2).toFixed(3)}cqw`,
                                              color: slide.style?.color || '#ffffff',
                                              textAlign: slide.style?.align || 'center',
                                              whiteSpace: 'pre-wrap',
                                              wordBreak: 'keep-all',
                                              overflowWrap: 'break-word'
                                            }}
                                            className="projector-text-shadow"
                                          >
                                            {slide.text}
                                          </p>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-textMuted">
                          <Grid3X3 className="h-8 w-8 mb-2" />
                          <p className="text-xs">No slides found. Click 'Edit Song' to add content.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dynamic Background Loop Explorer & Settings Form */}
                  <div
                    className="bg-[#10141D] border-t border-[var(--border-app)] flex flex-col relative select-none text-textMain transition-all duration-200 overflow-hidden"
                    style={{ height: isBgPanelCollapsed ? '28px' : `${bgPanelHeight}px` }}
                  >
                    {/* Draggable resize handle */}
                    {!isBgPanelCollapsed && (
                      <div 
                        onMouseDown={() => setIsResizingBgPanel(true)}
                        className="absolute -top-1.5 left-0 right-0 h-3 cursor-ns-resize hover:bg-brand/50 transition-colors z-30"
                        title="Drag to resize background panel"
                      />
                    )}

                    {/* Blue Header Bar */}
                    <div 
                      onClick={() => {
                        const nextState = !isBgPanelCollapsed;
                        setIsBgPanelCollapsed(nextState);
                        localStorage.setItem('isBgPanelCollapsed', String(nextState));
                      }}
                      className="h-7 bg-[#1E4E79] flex items-center justify-between px-3 text-white text-xs font-semibold shadow-sm cursor-pointer hover:bg-[#1E4E79]/90 transition"
                    >
                      <span className="flex-1 text-center font-sans">Set Slide Background</span>
                      {isBgPanelCollapsed ? (
                        <ChevronUp className="h-4 w-4 opacity-80" />
                      ) : (
                        <ChevronDown className="h-4 w-4 opacity-80" />
                      )}
                    </div>

                    {!isBgPanelCollapsed && (
                      <div className="flex-1 flex overflow-hidden">
                      
                      {/* Left Column: Background Configuration Form (35% width) */}
                      <div className="w-[35%] min-w-[280px] max-w-[360px] border-r border-[var(--border-app)] bg-appPanel p-3 flex flex-col justify-between overflow-y-auto scrollbar-thin">
                        <div className="space-y-2.5">
                          {/* Background Type Dropdown */}
                          <div>
                            <label className="text-[10px] text-textMuted uppercase font-mono font-bold block mb-1">Background Type</label>
                            <select 
                              value={bgType}
                              onChange={(e) => {
                                setBgType(e.target.value);
                                if (e.target.value === 'color') setStagedBgAsset(null);
                              }}
                              className="w-full bg-appBg border border-[var(--border-app)] rounded px-2 py-1 text-xs text-textMain focus:outline-none focus:border-brand font-sans"
                            >
                              <option value="color">Solid Color</option>
                              <option value="image">Image</option>
                              <option value="video">Video (MP4)</option>
                            </select>
                          </div>

                          {/* Conditional Inputs */}
                          {bgType === 'color' && (
                            <div>
                              <label className="text-[10px] text-textMuted uppercase font-mono font-bold block mb-1">Color</label>
                              <div className="flex gap-2 items-center bg-appBg border border-[var(--border-app)] rounded p-1.5">
                                <input 
                                  type="color" 
                                  value={bgColorInput} 
                                  onChange={(e) => setBgColorInput(e.target.value)}
                                  className="w-7 h-7 bg-transparent border-0 cursor-pointer p-0 rounded-md"
                                />
                                <input 
                                  type="text" 
                                  value={bgColorInput} 
                                  onChange={(e) => setBgColorInput(e.target.value)}
                                  className="flex-1 bg-transparent text-xs text-textMain focus:outline-none font-mono"
                                  placeholder="#000000"
                                />
                              </div>
                            </div>
                          )}



                          {/* Apply To Segmented Controls */}
                          <div>
                            <label className="text-[10px] text-textMuted uppercase font-mono font-bold block mb-1">Apply To</label>
                            <div className="flex bg-appBg/50 p-0.5 rounded border border-[var(--border-app)] text-[10px] font-semibold text-center">
                              <button
                                type="button"
                                onClick={() => setApplyToTarget('active')}
                                className={`flex-1 py-1 rounded transition-all ${
                                  applyToTarget === 'active' 
                                    ? 'bg-[#1E4E79] text-white shadow-sm' 
                                    : 'text-textMuted hover:text-textMain'
                                }`}
                              >
                                This Slide
                              </button>
                              <button
                                type="button"
                                onClick={() => setApplyToTarget('selected')}
                                className={`flex-1 py-1 rounded transition-all ${
                                  applyToTarget === 'selected' 
                                    ? 'bg-[#1E4E79] text-white shadow-sm' 
                                    : 'text-textMuted hover:text-textMain'
                                }`}
                              >
                                Selected Slides
                              </button>
                              <button
                                type="button"
                                onClick={() => setApplyToTarget('all')}
                                className={`flex-1 py-1 rounded transition-all ${
                                  applyToTarget === 'all' 
                                    ? 'bg-[#1E4E79] text-white shadow-sm' 
                                    : 'text-textMuted hover:text-textMain'
                                }`}
                              >
                                All Slides
                              </button>
                            </div>
                          </div>

                          {/* Selected Slides Checklist Grid */}
                          {applyToTarget === 'selected' && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[9px] text-textMuted font-mono">
                                <span>Select Slides Checklist:</span>
                                <div className="flex gap-2">
                                  <button 
                                    type="button" 
                                    onClick={() => setChecklistSlideIndexes(slides.map((_, i) => i))}
                                    className="hover:text-textMain"
                                  >
                                    Select All
                                  </button>
                                  <span>|</span>
                                  <button 
                                    type="button" 
                                    onClick={() => setChecklistSlideIndexes([])}
                                    className="hover:text-textMain"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 bg-appBg border border-[var(--border-app)] p-2 rounded max-h-[100px] overflow-y-auto scrollbar-thin">
                                {slides.map((slide, index) => (
                                  <label key={index} className="flex items-center gap-1.5 p-1 rounded bg-appPanel border border-[var(--border-app)] text-[9px] text-textMain cursor-pointer select-none truncate hover:bg-slate-900 transition">
                                    <input 
                                      type="checkbox" 
                                      checked={checklistSlideIndexes.includes(index)}
                                      onChange={() => {
                                        if (checklistSlideIndexes.includes(index)) {
                                          setChecklistSlideIndexes(checklistSlideIndexes.filter(i => i !== index));
                                        } else {
                                          setChecklistSlideIndexes([...checklistSlideIndexes, index]);
                                        }
                                      }}
                                      className="rounded text-brand accent-brand h-3 w-3"
                                    />
                                    <span className="font-mono text-textMuted font-bold">{index + 1}</span>
                                    <span className="font-semibold uppercase truncate">{slide.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Commit Action Button */}
                        <div className="pt-2">
                          <button
                            type="button"
                            disabled={bgType !== 'color' && stagedBgAsset === null}
                            onClick={handleApplyBackground}
                            className={`w-full py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 border ${
                              bgType !== 'color' && stagedBgAsset === null 
                                ? 'bg-appBg border-[var(--border-app)] text-slate-500 cursor-not-allowed opacity-50' 
                                : bgActionStatus === 'success'
                                  ? 'bg-[#10B981] border-[#10B981] text-white shadow-sm'
                                  : 'bg-[#1E4E79] border-[#1E4E79] text-white hover:bg-[#1E4E79]/95 shadow-md'
                            }`}
                          >
                            {bgActionStatus === 'success' ? (
                              '✔ Applied Background'
                            ) : (
                              <>
                                <span>✔</span>
                                <span>
                                  {applyToTarget === 'active' 
                                    ? 'Apply to Active Slide' 
                                    : applyToTarget === 'selected'
                                      ? `Apply to Selected Slides (${checklistSlideIndexes.length})`
                                      : 'Apply to All Slides'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Right Column: Local Directory Explorer OR Color presets (65% width) */}
                      <div className="flex-1 flex flex-col bg-appBg overflow-hidden border-t md:border-t-0 md:border-l border-[var(--border-app)]">
                        {bgType === 'color' ? (
                          /* Color Presets Picker Area */
                          <div className="flex-1 flex flex-col bg-appBg p-4 overflow-y-auto">
                            <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider font-mono mb-3">Color Palette Presets</span>
                            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                              {[
                                '#000000', '#1E293B', '#475569', '#94A3B8', '#F1F5F9', '#FFFFFF',
                                '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6', 
                                '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6'
                              ].map((col) => (
                                <div 
                                  key={col}
                                  onClick={() => setBgColorInput(col)}
                                  style={{ backgroundColor: col }}
                                  className={`aspect-square rounded-md border-2 cursor-pointer transition hover:scale-105 ${
                                    bgColorInput.toLowerCase() === col.toLowerCase() 
                                      ? 'border-brand shadow-md scale-105' 
                                      : 'border-[var(--border-app)]'
                                  }`}
                                  title={col}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* Standard replica Local Directory Explorer */
                          <>
                            {/* Address Bar Toolbar */}
                            <div className="h-9 bg-appPanel border-b border-[var(--border-app)] flex items-center gap-2 px-3">
                              <button 
                                type="button"
                                disabled={!mediaList.some(item => item.id === '..')}
                                onClick={() => {
                                  const parentItem = mediaList.find(item => item.id === '..');
                                  if (parentItem) loadLocalBackgrounds(parentItem.filepath);
                                }}
                                className="p-1 hover:bg-appBg disabled:opacity-40 rounded transition"
                                title="Go Up one folder level"
                              >
                                <ArrowUp className="h-4 w-4 text-textMain" />
                              </button>
                              
                              <input 
                                type="text" 
                                value={pathInputVal}
                                onChange={(e) => setPathInputVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    loadLocalBackgrounds(pathInputVal);
                                  }
                                }}
                                placeholder="Type folder path and press Enter..."
                                className="flex-1 h-6 bg-appBg border border-[var(--border-app)] px-2 py-0.5 text-xs text-textMain focus:outline-none rounded font-mono font-medium shadow-inner focus:border-brand"
                              />
                              
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={thumbnailScale}
                                onChange={(e) => setThumbnailScale(parseInt(e.target.value))}
                                className="w-20 cursor-pointer accent-brand h-1.5 bg-slate-700 rounded-lg appearance-none" 
                                title="Adjust Thumbnail Size"
                              />
                            </div>

                            {/* White Explorer Content Grid */}
                            <div className="flex-1 bg-appBg overflow-y-auto p-4 scrollbar-thin">
                              <div 
                                className="grid gap-3 pb-2"
                                style={{
                                  gridTemplateColumns: `repeat(auto-fill, minmax(${80 + (thumbnailScale / 100) * 140}px, 1fr))`
                                }}
                              >
                                
                                {/* "No Background" Clear Card */}
                                <div 
                                  onClick={() => {
                                    setStagedBgAsset("");
                                    setSelectedMedia(null);
                                  }}
                                  className={`flex flex-col items-center justify-center p-2 rounded-lg cursor-pointer border-2 transition-all aspect-square ${
                                    stagedBgAsset === ""
                                      ? 'border-brand bg-brand/10 shadow-md' 
                                      : 'border-[var(--border-app)] hover:bg-appPanel/40'
                                  }`}
                                >
                                  <Square className="h-8 w-8 text-textMuted stroke-[1.25] mb-1" />
                                  <span className="text-[10px] font-sans text-textMain text-center font-semibold truncate w-full px-1">
                                    No Background
                                  </span>
                                </div>

                                {/* Directories & Media Files (Filtered by Selected bgType) */}
                                {mediaList.map((item) => {
                                  if (item.id === '..') return null;

                                  // Filter explorer files by active select type
                                  if (item.type !== 'directory') {
                                    if (bgType === 'image' && item.type !== 'image') return null;
                                    if (bgType === 'video' && item.type !== 'video') return null;
                                  }

                                  if (item.type === 'directory') {
                                    return (
                                      <div 
                                        key={item.id}
                                        onClick={() => loadLocalBackgrounds(item.filepath)}
                                        className="flex flex-col items-center justify-center p-2 rounded-lg bg-appPanel/30 border border-[var(--border-app)]/60 hover:bg-appPanel/60 cursor-pointer aspect-square transition"
                                      >
                                        <Folder className="h-8 w-8 text-[#FFD24C] fill-[#FFD24C] stroke-amber-600 stroke-[1.25] mb-1" />
                                        <span className="text-[10px] font-sans text-textMain text-center font-medium truncate w-full px-1">
                                          {item.name}
                                        </span>
                                      </div>
                                    );
                                  }

                                  const isStaged = stagedBgAsset === item.filepath;
                                  return (
                                    <div 
                                      key={item.id}
                                      onClick={() => {
                                        setStagedBgAsset(item.filepath);
                                        setSelectedMedia(item);
                                      }}
                                      className={`flex flex-col items-center justify-center p-1.5 rounded-lg cursor-pointer border-2 aspect-square relative overflow-hidden transition-all ${
                                        isStaged 
                                          ? 'border-brand bg-brand/15 shadow-md scale-105' 
                                          : 'border-[var(--border-app)] hover:bg-appPanel/40'
                                      }`}
                                    >
                                      <div className="w-full flex-1 relative rounded overflow-hidden bg-black flex items-center justify-center">
                                        {item.type === 'video' ? (
                                          <LazyVideoThumbnail src={item.filepath} />
                                        ) : (
                                          <img 
                                            src={item.filepath} 
                                            loading="lazy"
                                            className="w-full h-full object-cover opacity-80" 
                                            alt="" 
                                          />
                                        )}
                                      </div>
                                      <span className="text-[9px] font-mono text-textMain text-center truncate w-full px-1 mt-1 leading-none">
                                        {item.name}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Right Layout size explorer sidebar tools */}
                      <div className="w-10 bg-[#E3E6EB] border-l border-slate-300 flex flex-col items-center py-3 gap-2">
                        <button 
                          onClick={async () => {
                            if (!window.api || !window.api.selectDirectory) return;
                            const dirPath = await window.api.selectDirectory();
                            if (dirPath) loadLocalBackgrounds(dirPath);
                          }}
                          className="p-1 hover:bg-slate-200 rounded transition" 
                          title="Open Directory Picker..."
                        >
                          <FolderOpen className="h-4 w-4 text-slate-600" />
                        </button>
                      </div>

                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-textMuted">
                  <FolderOpen className="h-10 w-10 text-slate-700 mb-2 stroke-1 animate-pulse" />
                  <p className="text-xs font-semibold">No Active Song Selected</p>
                  <p className="text-[10px] text-textMuted mt-1">Select a song from the library panel to display slides.</p>
                </div>
              )}
            </section>

            
          </>
        )}

        {/* SONG LIBRARY EXPLORER VIEW */}
        {activeHeaderTab === 'songs' && (
          <section className="flex-1 flex flex-col p-6 bg-appBg overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <Music className="text-emerald-400 h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-textMain tracking-wide">
                    Song Library Manager
                  </h2>
                  <p className="text-[11px] text-textMuted font-mono">
                    {songs.filter(s => s.author !== 'Media').length} Worship Songs Available
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Search Bar */}
                <div className="relative flex items-center flex-1 sm:w-64">
                  <Search className="absolute left-3 text-textMuted h-3.5 w-3.5" />
                  <input
                    type="text"
                    placeholder="Search songs..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-appPanel border border-[var(--border-app)] rounded-lg text-xs text-textMain placeholder-textMuted focus:outline-none focus:border-brand transition"
                  />
                  {librarySearchQuery && (
                    <button 
                      onClick={() => setLibrarySearchQuery('')}
                      className="absolute right-2.5 text-textMuted hover:text-textMain text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button 
                  onClick={() => setIsAddSongOpen(true)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow transition active:scale-95 flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add New Song
                </button>
              </div>
            </div>

            {songs.filter(s => s.author !== 'Media').length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {songs
                  .filter(song => song.author !== 'Media' && (!librarySearchQuery.trim() || song.title.toLowerCase().includes(librarySearchQuery.toLowerCase())))
                  .map((song) => (
                    <div 
                      key={song.id} 
                      className="bg-appPanel/40 hover:bg-appPanel/80 border border-[var(--border-app)] hover:border-emerald-500/40 rounded-xl p-3 flex flex-col justify-between group transition-all duration-200 shadow-md hover:shadow-2xl relative overflow-hidden"
                    >
                      {/* Top Default Music Artwork Box */}
                      <div className="w-full aspect-square bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-950 border border-slate-800/80 rounded-lg flex flex-col items-center justify-center relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-300 mb-2.5 shadow-inner">
                        {/* Decorative background circles */}
                        <div className="absolute inset-2 rounded-full border border-emerald-500/10 flex items-center justify-center pointer-events-none">
                          <div className="w-1/2 h-1/2 rounded-full border border-emerald-500/10" />
                        </div>

                        {/* Default Music Logo Icon */}
                        <Music className="h-10 w-10 text-emerald-400/75 group-hover:scale-110 group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_14px_rgba(52,211,153,0.5)] transition-all duration-300" />
                        
                        {/* Hover Overlay with Big Play / Load Icon Button */}
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                          <button
                            onClick={async () => {
                              selectSong(song.id);
                              await addToPlaylist(song.title, 'song', song.id);
                              setActiveHeaderTab('presentation');
                            }}
                            className="p-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xl transform scale-90 hover:scale-105 active:scale-95 transition-all"
                            title="Load Presentation into Flow"
                          >
                            <Play className="h-5 w-5 fill-slate-950 translate-x-0.5" />
                          </button>
                        </div>
                      </div>

                      {/* Song Title & Icon Actions Bar */}
                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-xs text-textMain truncate tracking-tight" title={song.title}>
                            {song.title}
                          </h3>
                          <p className="text-[10px] text-textMuted font-mono truncate mt-0.5">
                            {song.author && song.author !== 'WorshipFlow' ? song.author : 'Worship Song'}
                          </p>
                        </div>

                        {/* Pure Icon Action Buttons Row inside the box */}
                        <div className="flex items-center justify-between border-t border-[var(--border-app)]/50 pt-2">
                          <button 
                            onClick={async () => {
                              selectSong(song.id);
                              await addToPlaylist(song.title, 'song', song.id);
                              setActiveHeaderTab('presentation');
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition"
                            title="Load Presentation"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Load</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => { selectSong(song.id); handleOpenEdit(); }}
                              className="p-1 hover:bg-appBg rounded text-textMuted hover:text-textMain transition"
                              title="Edit Song"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteSongClick(song.id)}
                              className="p-1 hover:bg-liveDanger/20 rounded text-liveDanger hover:text-red-300 transition"
                              title="Delete Song"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border border-[var(--border-app)] rounded-lg p-12 text-textMuted">
                <Music className="h-12 w-12 text-slate-700 mb-2 stroke-1" />
                <p className="text-sm font-semibold">No Songs In Library Database</p>
                <p className="text-xs text-textMuted mt-1">Import a song using the Add Song button to get started.</p>
              </div>
            )}
          </section>
        )}

        {/* SLIDES EDITOR VIEW */}
        {false && (
          <section className="flex-1 flex flex-col p-6 bg-appBg overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-textMain flex items-center gap-2">
                <Layers className="text-brand h-5 w-5" />
                Slide Editor
              </h2>
            </div>
            {selectedSong ? (
              <div className="bg-appPanel/40 border border-[var(--border-app)] p-6 rounded-lg text-xs space-y-4 max-w-3xl">
                <div>
                  <h3 className="font-bold text-textMain text-sm mb-1">{selectedSong.title}</h3>
                </div>
                
                {/* Text Styling toolbar */}
                <div className="bg-appBg border border-[var(--border-app)] rounded-t-lg p-3 grid grid-cols-4 md:grid-cols-7 gap-3 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Font</label>
                    <select 
                      value={songFont} 
                      onChange={e => setSongFont(e.target.value)}
                      className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none"
                    >
                      <option value="Inter">Inter</option>
                      <option value="Poppins">Poppins</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Open Sans">Open Sans</option>
                      <option value="Lato">Lato</option>
                      <option value="Oswald">Oswald</option>
                      <option value="Raleway">Raleway</option>
                      <option value="Nunito">Nunito</option>
                      <option value="Playfair Display">Playfair Display</option>
                      <option value="Bebas Neue">Bebas Neue</option>
                      <option value="Anton">Anton</option>
                      <option value="Fjalla One">Fjalla One</option>
                      <option value="Archivo Black">Archivo Black</option>
                      <option value="Cinzel">Cinzel</option>
                      <option value="Outfit">Outfit</option>
                      <option value="Syne">Syne</option>
                      <option value="League Spartan">League Spartan</option>
                      <option value="Unbounded">Unbounded</option>
                      <option value="Instrument Serif">Instrument Serif</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Size (px)</label>
                    <input 
                      type="number" 
                      value={songSize} 
                      onChange={e => setSongSize(parseInt(e.target.value) || 60)}
                      className="p-0.5 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Weight</label>
                    <select 
                      value={songWeight} 
                      onChange={e => setSongWeight(e.target.value)}
                      className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="semibold">Semibold</option>
                      <option value="bold">Bold</option>
                      <option value="extrabold">Extra Bold</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Line Spacing</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0.5"
                      max="3.0"
                      value={songLineHeight} 
                      onChange={e => setSongLineHeight(parseFloat(e.target.value) || 1.4)}
                      className="p-0.5 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Char Spacing</label>
                    <input 
                      type="number" 
                      min="-5"
                      max="20"
                      value={songLetterSpacing} 
                      onChange={e => setSongLetterSpacing(parseInt(e.target.value) || 0)}
                      className="p-0.5 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Color</label>
                    <div className="flex gap-1 items-center">
                      <input 
                        type="color" 
                        value={songColor} 
                        onChange={e => setSongColor(e.target.value)}
                        className="w-6 h-5 bg-transparent border-0 cursor-pointer p-0"
                      />
                      <span className="text-[8px] font-mono text-textMuted uppercase">{songColor}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Bg Color</label>
                    <div className="flex gap-1 items-center">
                      <input 
                        type="color" 
                        value={songBgColor} 
                        onChange={e => setSongBgColor(e.target.value)}
                        className="w-6 h-5 bg-transparent border-0 cursor-pointer p-0"
                      />
                      <span className="text-[8px] font-mono text-textMuted uppercase">{songBgColor}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Bg Opacity</label>
                    <select 
                      value={songBgOpacity} 
                      onChange={e => setSongBgOpacity(e.target.value)}
                      className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none"
                    >
                      <option value="0%">0%</option>
                      <option value="20%">20%</option>
                      <option value="40%">40%</option>
                      <option value="60%">60%</option>
                      <option value="80%">80%</option>
                      <option value="100%">100%</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Align</label>
                    <select 
                      value={songAlign} 
                      onChange={e => setSongAlign(e.target.value)}
                      className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Vertical</label>
                    <select 
                      value={songVertical} 
                      onChange={e => setSongVertical(e.target.value)}
                      className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none"
                    >
                      <option value="top">Top</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[9px] text-textMuted uppercase font-mono">Anim & Speed</label>
                    <div className="flex gap-2">
                      <select 
                        value={songAnimation} 
                        onChange={e => setSongAnimation(e.target.value)}
                        className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none flex-1 text-xs"
                      >
                        <option value="None">None</option>
                        <option value="Fade In">Fade In</option>
                        <option value="Fade Out">Fade Out</option>
                        <option value="Fade">Fade</option>
                        <option value="Zoom In/Out">Zoom In/Out</option>
                        <option value="Slide Left">Slide Left</option>
                        <option value="Slide Right">Slide Right</option>
                        <option value="Slide Up">Slide Up</option>
                      </select>
                      <div className="flex items-center gap-1 bg-appPanel border border-[var(--border-app)] rounded px-2 py-0.5 flex-1">
                        <input 
                          type="text" 
                          value={songSpeed} 
                          onChange={e => setSongSpeed(e.target.value)}
                          placeholder="0.6s"
                          className="w-full bg-transparent text-textMain text-xs focus:outline-none"
                        />
                        <span className="text-[10px] text-textMuted font-mono">Secs</span>
                      </div>
                    </div>
                  </div>
                </div>



                <div className="flex flex-col gap-2">
                  <textarea 
                    rows="18"
                    value={editSongSlidesRaw}
                    onChange={e => setEditSongSlidesRaw(e.target.value)}
                    className="p-3 bg-appBg border border-t-0 border-[var(--border-app)] rounded-b-lg text-textMain focus:border-brand focus:outline-none font-mono leading-relaxed"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={handleOpenEdit}
                    className="px-4 py-2 border border-[var(--border-app)] text-textMuted hover:text-textMain rounded font-mono"
                  >
                    Reset
                  </button>
                  <button 
                    onClick={handleSaveEditSong}
                    className="px-4 py-2 bg-brand hover:bg-brand/80 text-white font-bold rounded flex items-center gap-1.5 font-mono"
                  >
                    <Save className="h-4 w-4" />
                    Save Slide Settings
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border border-[var(--border-app)] rounded-lg p-12 text-textMuted">
                <Layers className="h-10 w-10 text-slate-700 mb-2 stroke-1 animate-pulse" />
                <p className="text-xs">No Active Song Loaded in Editor. Go to Presentation Tab and select a song.</p>
              </div>
            )}
          </section>
        )}

        {/* BIBLE MENU EXPLORER VIEW */}
        {activeHeaderTab === 'scripture' && (
          <BibleMenu 
            addToPlaylist={addToPlaylist}
            fetchSongs={fetchSongs}
            isLiveActive={isLiveActive}
            onGoLiveBible={handleGoLiveBible}
            bibleLiveSlides={bibleLiveSlides}
            onExitLiveBible={handleExitLiveBible}
            bibleFontSize={bibleFontSize}
            setBibleFontSize={setBibleFontSize}
            bibleRefColor={bibleRefColor}
            setBibleRefColor={setBibleRefColor}
            songFont={songFont}
            songSize={songSize}
            songWeight={songWeight}
            songColor={songColor}
            songBgColor={songBgColor}
            songBgOpacity={songBgOpacity}
            songAlign={songAlign}
            songVertical={songVertical}
            songAnimation={songAnimation}
            songSpeed={songSpeed}
          />
        )}



        {/* COUNTDOWN MANAGER VIEW */}
        {activeHeaderTab === 'countdown' && (
          <section className="flex-1 flex flex-col p-6 bg-appBg overflow-y-auto text-xs relative pb-10">
            <h2 className="text-lg font-bold text-textMain flex items-center gap-2 mb-6">
              <Clock className="text-brand h-5 w-5" />
              Service Countdown Timer
            </h2>

            {/* Bottom redline running indicator */}
            {/* Countdown / Timer Mode Sub Navigation Tabs */}
            <div className="flex border-b border-[var(--border-app)] mb-6 gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
              <button 
                onClick={() => setCountdownSubTab('countdown')}
                className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all ${
                  countdownSubTab === 'countdown'
                    ? 'border-brand text-brand font-bold'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                Countdown Timer
              </button>
              <button 
                onClick={() => setCountdownSubTab('timer')}
                className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all ${
                  countdownSubTab === 'timer'
                    ? 'border-brand text-brand font-bold'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                Count-up Timer
              </button>
            </div>

            {/* Bottom redline running indicators */}
            {(isCountdownRunning || isTimerRunning) && (
              <div 
                className="fixed bottom-0 left-0 right-0 h-1.5 bg-red-500 z-50 animate-pulse"
                style={{ height: '6px', backgroundColor: '#ef4444', filter: 'drop-shadow(0 -2px 4px rgba(239, 68, 68, 0.5))' }}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {countdownSubTab === 'countdown' ? (
                <>
                  {/* Left Column: Countdown Configs */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* General Text inputs */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-textMuted font-bold uppercase font-mono">TITLE</label>
                        <input 
                          type="text" 
                          value={countdownTitle}
                          onChange={e => setCountdownTitle(e.target.value)}
                          placeholder="e.g. The service is about to start"
                          className="p-2.5 bg-appBg border border-[var(--border-app)] rounded-lg text-textMain text-sm focus:outline-none focus:border-brand/60"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-textMuted font-bold uppercase font-mono">SUBTEXT OPTIONAL</label>
                        <input 
                          type="text" 
                          value={countdownSubtext}
                          onChange={e => setCountdownSubtext(e.target.value)}
                          placeholder="e.g. Please take your seats"
                          className="p-2.5 bg-appBg border border-[var(--border-app)] rounded-lg text-textMain text-sm focus:outline-none focus:border-brand/60"
                        />
                      </div>
                    </div>

                    {/* Modes, Targets, and Show On */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Timer Modes & Options */}
                      <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl space-y-4">
                        <div>
                          <label className="text-[10px] text-textMuted font-bold uppercase font-mono mb-2 block">TIMER MODE</label>
                          <div className="flex gap-2">
                            {['duration', 'target', 'current'].map((mode) => (
                              <button
                                key={mode}
                                onClick={() => setCountdownMode(mode)}
                                className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                                  countdownMode === mode 
                                    ? 'bg-brand text-white shadow-md' 
                                    : 'bg-appBg border border-[var(--border-app)] text-textMuted hover:text-textMain'
                                }`}
                              >
                                {mode === 'duration' ? 'Duration' : mode === 'target' ? 'Target Time' : 'Current Time'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-textMuted font-bold uppercase font-mono mb-2 block">SHOW ON</label>
                          <div className="flex gap-2">
                            {['both', 'main', 'stage'].map((on) => (
                              <button
                                key={on}
                                onClick={() => setCountdownShowOn(on)}
                                className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                                  countdownShowOn === on 
                                    ? 'bg-brand text-white shadow-md' 
                                    : 'bg-appBg border border-[var(--border-app)] text-textMuted hover:text-textMain'
                                }`}
                              >
                                {on.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Duration Inputs & Quick Presets */}
                      <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl space-y-3.5">
                        {countdownMode === 'duration' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-textMuted font-bold uppercase font-mono">Minutes</label>
                              <input 
                                type="number" 
                                min="0" 
                                max="180"
                                value={countdownMinutes}
                                onChange={e => setCountdownMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                disabled={isCountdownRunning}
                                className="p-2 bg-appBg border border-[var(--border-app)] rounded text-textMain text-center text-xs font-mono focus:outline-none focus:border-brand/50 disabled:opacity-50"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-textMuted font-bold uppercase font-mono">Seconds</label>
                              <input 
                                type="number" 
                                min="0" 
                                max="59"
                                value={countdownSeconds}
                                onChange={e => setCountdownSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                                disabled={isCountdownRunning}
                                className="p-2 bg-appBg border border-[var(--border-app)] rounded text-textMain text-center text-xs font-mono focus:outline-none focus:border-brand/50 disabled:opacity-50"
                              />
                            </div>
                          </div>
                        )}

                        {countdownMode === 'target' && (
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-textMuted font-bold uppercase font-mono">Target Clock Time (24h)</label>
                            <input 
                              type="time" 
                              value={countdownTargetTime}
                              onChange={e => setCountdownTargetTime(e.target.value)}
                              disabled={isCountdownRunning}
                              className="p-2 bg-appBg border border-[var(--border-app)] rounded text-textMain text-center text-xs font-mono focus:outline-none focus:border-brand/50 disabled:opacity-50"
                            />
                          </div>
                        )}

                        {countdownMode === 'current' && (
                          <div className="text-[11px] text-textMuted italic pt-2">
                            Displays your system clock time (hours and minutes) on the projector display.
                          </div>
                        )}

                        {countdownMode === 'duration' && (
                          <div className="grid grid-cols-4 gap-1.5 pt-1.5">
                            {[1, 2, 5, 10].map((preset) => (
                              <button
                                key={preset}
                                disabled={isCountdownRunning}
                                onClick={() => {
                                  setCountdownMinutes(preset);
                                  setCountdownSeconds(0);
                                }}
                                className="py-1 bg-appBg hover:bg-appBg/80 border border-[var(--border-app)] rounded text-[9px] font-bold text-textMuted hover:text-textMain font-mono transition disabled:opacity-40"
                              >
                                {preset}m
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Overtime Options */}
                        <div className="flex items-center justify-between py-2 border-t border-[var(--border-app)]/30 text-xs">
                          <span className="text-textMain font-medium">Enable Count-up Overtime</span>
                          <input 
                            type="checkbox" 
                            checked={countdownOvertime} 
                            onChange={() => setCountdownOvertime(!countdownOvertime)} 
                            disabled={isCountdownRunning}
                            className="accent-brand h-4 w-4 cursor-pointer disabled:opacity-50" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Font sizes sliders */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-textMuted font-mono uppercase">Title Size</span>
                          <span className="font-bold text-brand">{countdownTitleSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="24" 
                          max="96" 
                          value={countdownTitleSize}
                          onChange={e => setCountdownTitleSize(parseInt(e.target.value))}
                          className="w-full h-1 bg-appBg rounded appearance-none cursor-pointer accent-brand"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-textMuted font-mono uppercase">Timer Size</span>
                          <span className="font-bold text-brand">{countdownTimeSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="72" 
                          max="280" 
                          value={countdownTimeSize}
                          onChange={e => setCountdownTimeSize(parseInt(e.target.value))}
                          className="w-full h-1 bg-appBg rounded appearance-none cursor-pointer accent-brand"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-textMuted font-mono uppercase">Subtext Size</span>
                          <span className="font-bold text-brand">{countdownSubtextSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="16" 
                          max="64" 
                          value={countdownSubtextSize}
                          onChange={e => setCountdownSubtextSize(parseInt(e.target.value))}
                          className="w-full h-1 bg-appBg rounded appearance-none cursor-pointer accent-brand"
                        />
                      </div>
                    </div>

                    {/* Background Colors */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-textMain font-medium font-mono uppercase">Countdown Overlay Color</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-textMuted">{countdownBgColor}</span>
                        <input 
                          type="color" 
                          value={countdownBgColor} 
                          onChange={e => setCountdownBgColor(e.target.value)} 
                          className="h-6 w-9 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" 
                        />
                      </div>
                    </div>
                    {/* Background Media (Image/Video) Picker */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl flex flex-col gap-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-textMain font-medium font-mono uppercase">Countdown BG Media</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.api || !window.api.selectLocalFile) return;
                              const filePath = await window.api.selectLocalFile();
                              if (filePath) {
                                setCountdownBgMedia(filePath);
                              }
                            }}
                            className="px-2.5 py-1 bg-brand text-white font-mono text-[10px] font-bold uppercase rounded hover:bg-brand/80 transition"
                          >
                            Select BG Media
                          </button>
                          {countdownBgMedia && (
                            <button
                              type="button"
                              onClick={() => setCountdownBgMedia(null)}
                              className="px-2.5 py-1 bg-liveDanger text-white font-mono text-[10px] font-bold uppercase rounded hover:bg-liveDanger/80 transition"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                      {countdownBgMedia && (
                        <div className="font-mono text-[9px] text-textMuted break-all bg-appBg/50 p-2 rounded border border-[var(--border-app)]">
                          {countdownBgMedia}
                        </div>
                      )}
                    </div>
                    {/* Text Color */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-textMain font-medium font-mono uppercase">Countdown Time Text Color</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-textMuted">{countdownTextColor}</span>
                        <input 
                          type="color" 
                          value={countdownTextColor} 
                          onChange={e => setCountdownTextColor(e.target.value)} 
                          className="h-6 w-9 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Timer Preview & Action */}
                  <div className="space-y-4">
                    {/* Add/Subtract Time Controls */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-4 rounded-xl flex gap-1.5">
                      <button 
                        disabled={!isCountdownRunning || countdownMode !== 'duration'}
                        onClick={() => {
                          if (countdownMinutes > 0) {
                            setCountdownMinutes(countdownMinutes - 1);
                          }
                        }}
                        className="flex-1 py-1.5 bg-appBg hover:bg-appBg/80 text-textMuted hover:text-textMain border border-[var(--border-app)] rounded-lg text-[10px] font-bold font-mono transition disabled:opacity-40"
                      >
                        - 1:00
                      </button>
                      <button 
                        disabled={!isCountdownRunning || countdownMode !== 'duration'}
                        onClick={() => setCountdownMinutes(countdownMinutes + 1)}
                        className="flex-1 py-1.5 bg-appBg hover:bg-appBg/80 text-textMuted hover:text-textMain border border-[var(--border-app)] rounded-lg text-[10px] font-bold font-mono transition disabled:opacity-40"
                      >
                        + 1:00
                      </button>
                      <button 
                        disabled={!isCountdownRunning || countdownMode !== 'duration'}
                        onClick={() => setCountdownMinutes(countdownMinutes + 5)}
                        className="flex-1 py-1.5 bg-appBg hover:bg-appBg/80 text-textMuted hover:text-textMain border border-[var(--border-app)] rounded-lg text-[10px] font-bold font-mono transition disabled:opacity-40"
                      >
                        + 5:00
                      </button>
                    </div>

                    {/* Aspect-Video 16:9 monitor frame */}
                    <div 
                      style={{ backgroundColor: countdownBgColor }}
                      className="w-full aspect-video rounded-xl border border-[var(--border-app)] p-6 relative overflow-hidden flex flex-col justify-center items-center text-center select-none shadow-2xl transition-colors duration-500"
                    >
                      {countdownBgMedia && (
                        <div className="absolute inset-0 z-0 w-full h-full">
                          {/\.(mp4|webm|mov|avi)($|\?)/i.test(countdownBgMedia) ? (
                            <video src={formatBgPath(countdownBgMedia)} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img src={formatBgPath(countdownBgMedia)} className="w-full h-full object-cover" alt="" />
                          )}
                        </div>
                      )}
                      <div className="space-y-1">
                        <p style={{ fontSize: `${countdownTitleSize * 0.22}px`, color: 'rgba(255,255,255,0.75)' }} className="font-sans font-medium uppercase tracking-widest leading-tight">
                          {countdownTitle || 'Countdown'}
                        </p>
                        <p style={{ fontSize: `${countdownTimeSize * 0.22}px`, color: '#ffffff' }} className="font-mono font-bold leading-none py-1">
                          {countdownMode === 'current'
                             ? (() => {
                                 const now = new Date();
                                 const hrs = String(now.getHours()).padStart(2, '0');
                                 const mins = String(now.getMinutes()).padStart(2, '0');
                                 const secs = String(now.getSeconds()).padStart(2, '0');
                                 return `${hrs}:${mins}:${secs}`;
                               })()
                             : `${String(countdownMinutes).padStart(2, '0')}:${String(countdownSeconds).padStart(2, '0')}`
                           }
                        </p>
                        {countdownSubtext && (
                          <p style={{ fontSize: `${countdownSubtextSize * 0.22}px`, color: 'rgba(255,255,255,0.5)' }} className="font-sans italic leading-tight">
                            {countdownSubtext}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Trigger Control Panel */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-4 rounded-xl space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const nextState = !isCountdownRunning;
                            setIsCountdownRunning(nextState);
                            setCountdownActive(nextState);
                            if (nextState) {
                              setIsTimerRunning(false);
                              setTimerActive(false);
                            }
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5 ${
                            isCountdownRunning 
                              ? 'bg-liveDanger hover:bg-liveDanger/90 text-white' 
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          {isCountdownRunning ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-white" /> Stop Countdown
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-white" /> Go Live
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => {
                            setIsCountdownRunning(false);
                            setCountdownActive(false);
                            setCountdownMinutes(5);
                            setCountdownSeconds(0);
                          }}
                          className="px-4 py-3 bg-appBg hover:bg-appBg/80 border border-[var(--border-app)] text-textMuted hover:text-textMain rounded-xl text-xs font-bold uppercase transition"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Count-up Timer Sub-tab View */
                <>
                  {/* Left Column: Count-up Timer Configs */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* General Text inputs */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-textMuted font-bold uppercase font-mono">TIMER TITLE</label>
                        <input 
                          type="text" 
                          value={timerTitle}
                          onChange={e => setTimerTitle(e.target.value)}
                          placeholder="e.g. Service Timer"
                          className="p-2.5 bg-appBg border border-[var(--border-app)] rounded-lg text-textMain text-sm focus:outline-none focus:border-brand/60"
                        />
                      </div>
                    </div>

                    {/* Show On settings */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl space-y-4">
                      <div>
                        <label className="text-[10px] text-textMuted font-bold uppercase font-mono mb-2 block">SHOW ON</label>
                        <div className="flex gap-2">
                          {['both', 'main', 'stage'].map((on) => (
                            <button
                              key={on}
                              onClick={() => setTimerShowOn(on)}
                              className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                                timerShowOn === on 
                                  ? 'bg-brand text-white shadow-md' 
                                  : 'bg-appBg border border-[var(--border-app)] text-textMuted hover:text-textMain'
                              }`}
                            >
                              {on.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Font sizes sliders */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-textMuted font-mono uppercase">Title Size</span>
                          <span className="font-bold text-brand">{timerTitleSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="24" 
                          max="96" 
                          value={timerTitleSize}
                          onChange={e => setTimerTitleSize(parseInt(e.target.value))}
                          className="w-full h-1 bg-appBg rounded appearance-none cursor-pointer accent-brand"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-textMuted font-mono uppercase">Timer Size</span>
                          <span className="font-bold text-brand">{timerTimeSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="72" 
                          max="280" 
                          value={timerTimeSize}
                          onChange={e => setTimerTimeSize(parseInt(e.target.value))}
                          className="w-full h-1 bg-appBg rounded appearance-none cursor-pointer accent-brand"
                        />
                      </div>
                    </div>

                    {/* Background Colors */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-textMain font-medium font-mono uppercase">Timer Overlay Color</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-textMuted">{timerBgColor}</span>
                        <input 
                          type="color" 
                          value={timerBgColor} 
                          onChange={e => setTimerBgColor(e.target.value)} 
                          className="h-6 w-9 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" 
                        />
                      </div>
                    </div>
                    {/* Background Media (Image/Video) Picker */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl flex flex-col gap-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-textMain font-medium font-mono uppercase">Timer BG Media</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.api || !window.api.selectLocalFile) return;
                              const filePath = await window.api.selectLocalFile();
                              if (filePath) {
                                setTimerBgMedia(filePath);
                              }
                            }}
                            className="px-2.5 py-1 bg-brand text-white font-mono text-[10px] font-bold uppercase rounded hover:bg-brand/80 transition"
                          >
                            Select BG Media
                          </button>
                          {timerBgMedia && (
                            <button
                              type="button"
                              onClick={() => setTimerBgMedia(null)}
                              className="px-2.5 py-1 bg-liveDanger text-white font-mono text-[10px] font-bold uppercase rounded hover:bg-liveDanger/80 transition"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                      {timerBgMedia && (
                        <div className="font-mono text-[9px] text-textMuted break-all bg-appBg/50 p-2 rounded border border-[var(--border-app)]">
                          {timerBgMedia}
                        </div>
                      )}
                    </div>
                    {/* Text Color */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-5 rounded-xl flex items-center justify-between text-xs">
                      <span className="text-textMain font-medium font-mono uppercase">Timer Text Color</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-textMuted">{timerTextColor}</span>
                        <input 
                          type="color" 
                          value={timerTextColor} 
                          onChange={e => setTimerTextColor(e.target.value)} 
                          className="h-6 w-9 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Timer Preview & Action */}
                  <div className="space-y-4">
                    {/* Aspect-Video 16:9 monitor frame */}
                    <div 
                      style={{ backgroundColor: timerBgColor }}
                      className="w-full aspect-video rounded-xl border border-[var(--border-app)] p-6 relative overflow-hidden flex flex-col justify-center items-center text-center select-none shadow-2xl transition-colors duration-500"
                    >
                      {timerBgMedia && (
                        <div className="absolute inset-0 z-0 w-full h-full">
                          {/\.(mp4|webm|mov|avi)($|\?)/i.test(timerBgMedia) ? (
                            <video src={formatBgPath(timerBgMedia)} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img src={formatBgPath(timerBgMedia)} className="w-full h-full object-cover" alt="" />
                          )}
                        </div>
                      )}
                      <div className="space-y-1">
                        <p style={{ fontSize: `${timerTitleSize * 0.22}px`, color: 'rgba(255,255,255,0.75)' }} className="font-sans font-medium uppercase tracking-widest leading-tight">
                          {timerTitle || 'Timer'}
                        </p>
                        <p style={{ fontSize: `${timerTimeSize * 0.22}px`, color: '#ffffff' }} className="font-mono font-bold leading-none py-1">
                          {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
                        </p>
                      </div>
                    </div>

                    {/* Trigger Control Panel */}
                    <div className="bg-appPanel/40 border border-[var(--border-app)] p-4 rounded-xl space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const nextState = !isTimerRunning;
                            setIsTimerRunning(nextState);
                            setTimerActive(nextState);
                            if (nextState) {
                              setIsCountdownRunning(false);
                              setCountdownActive(false);
                            }
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5 ${
                            isTimerRunning 
                              ? 'bg-liveDanger hover:bg-liveDanger/90 text-white' 
                              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          {isTimerRunning ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-white" /> Stop Timer
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-white" /> Start Timer
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => {
                            setIsTimerRunning(false);
                            setTimerActive(false);
                            setTimerMinutes(0);
                            setTimerSeconds(0);
                          }}
                          className="px-4 py-3 bg-appBg hover:bg-appBg/80 border border-[var(--border-app)] text-textMuted hover:text-textMain rounded-xl text-xs font-bold uppercase transition"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* STAGE DISPLAY VIEW */}
        {activeHeaderTab === 'stage' && (
          <section className="flex-1 flex flex-col p-6 bg-appBg overflow-y-auto text-xs">
            <h2 className="text-lg font-bold text-textMain flex items-center gap-2 mb-6">
              <Layout className="text-brand h-5 w-5" />
              Stage Display Monitor & Controller
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Column 1: Settings & Layout */}
              <div className="bg-appPanel/45 border border-[var(--border-app)] p-6 rounded-2xl text-sm space-y-6">
                <h4 className="font-bold text-textMain text-sm uppercase tracking-wider font-mono">Stage General Settings</h4>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border-app)]/30 text-sm">
                    <span className="text-textMain font-medium">Show Clock Time</span>
                    <input type="checkbox" checked={stageShowClock} onChange={() => setStageShowClock(!stageShowClock)} className="accent-brand h-4 w-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border-app)]/30 text-sm">
                    <span className="text-textMain font-medium">Show Slide Index Label</span>
                    <input type="checkbox" checked={stageShowSlideIndex} onChange={() => setStageShowSlideIndex(!stageShowSlideIndex)} className="accent-brand h-4 w-4 cursor-pointer" />
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[var(--border-app)]/30 text-sm">
                    <span className="text-textMain font-medium">Show Up Next Lyrics</span>
                    <input type="checkbox" checked={stageShowNextPreview} onChange={() => setStageShowNextPreview(!stageShowNextPreview)} className="accent-brand h-4 w-4 cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-2 py-2 border-b border-[var(--border-app)]/30 text-sm">
                    <div className="flex justify-between">
                      <span className="text-textMain font-medium">Main Lyrics Font Size</span>
                      <span className="font-mono text-brand font-bold text-sm">{stageMainFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="24"
                      max="200"
                      value={stageMainFontSize}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setStageMainFontSize(v);
                        localStorage.setItem('stageMainFontSize', v.toString());
                      }}
                      className="w-full h-1.5 bg-appBg rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                  </div>
                  <div className="flex flex-col gap-2 py-2 border-b border-[var(--border-app)]/30 text-sm">
                    <div className="flex justify-between">
                      <span className="text-textMain font-medium">Slide Label Font Size</span>
                      <span className="font-mono text-brand font-bold text-sm">{stageLabelFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      value={stageLabelFontSize}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setStageLabelFontSize(v);
                        localStorage.setItem('stageLabelFontSize', v.toString());
                      }}
                      className="w-full h-1.5 bg-appBg rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                  </div>
                  <div className="flex flex-col gap-2 py-2 border-b border-[var(--border-app)]/30 text-sm">
                    <div className="flex justify-between">
                      <span className="text-textMain font-medium">Next Lyrics Font Size</span>
                      <span className="font-mono text-brand font-bold text-sm">{stageUpNextFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={stageUpNextFontSize}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        setStageUpNextFontSize(v);
                        localStorage.setItem('stageUpNextFontSize', v.toString());
                      }}
                      className="w-full h-1.5 bg-appBg rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                  </div>

                  <div className="flex justify-between items-center py-2 text-sm">
                    <span className="text-textMain font-medium">Text Transform</span>
                    <select value={stageTextStyle} onChange={(e) => setStageTextStyle(e.target.value)} className="p-1.5 bg-appBg border border-[var(--border-app)] rounded-lg text-textMain focus:outline-none text-xs font-semibold">
                      <option>Upper-case Bold</option>
                      <option>Standard Mixed-case</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-[var(--border-app)]/30 space-y-3">
                    <h5 className="font-bold text-textMain text-xs uppercase tracking-wider font-mono">Custom Layout Line Colors</h5>
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-textMuted">Top Dividing Line</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-textMuted">{stageTopLineColor}</span>
                        <input type="color" value={stageTopLineColor} onChange={(e) => setStageTopLineColor(e.target.value)} className="h-6 w-8 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-textMuted">Middle Dividing Line</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-textMuted">{stageMiddleLineColor}</span>
                        <input type="color" value={stageMiddleLineColor} onChange={(e) => setStageMiddleLineColor(e.target.value)} className="h-6 w-8 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-textMuted">Main Label Line</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-textMuted">{stageMainLineColor}</span>
                        <input type="color" value={stageMainLineColor} onChange={(e) => setStageMainLineColor(e.target.value)} className="h-6 w-8 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-textMuted">Up Next Label Line</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-textMuted">{stageUpNextLineColor}</span>
                        <input type="color" value={stageUpNextLineColor} onChange={(e) => setStageUpNextLineColor(e.target.value)} className="h-6 w-8 bg-transparent cursor-pointer rounded border border-[var(--border-app)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Stage Window Launcher Controls */}
              <div className="bg-appPanel/45 border border-[var(--border-app)] p-6 rounded-2xl text-sm space-y-5">
                <h4 className="font-bold text-textMain text-sm uppercase tracking-wider font-mono">Stage Window Controls</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={async () => {
                      await window.api.openStage(selectedStageDisplay === 'auto' ? undefined : selectedStageDisplay);
                      await refreshWindowStatuses();
                    }}
                    className="py-3 rounded-xl bg-brand/10 border border-brand text-brand hover:bg-brand/20 transition-all font-bold text-xs uppercase tracking-wider active:scale-95"
                  >
                    Open Window
                  </button>
                  <button
                    onClick={async () => {
                      await window.api.closeStage();
                      await refreshWindowStatuses();
                    }}
                    className="py-3 rounded-xl bg-liveDanger/10 border border-liveDanger text-liveDanger hover:bg-liveDanger/20 transition-all font-bold text-xs uppercase tracking-wider active:scale-95"
                  >
                    Close Window
                  </button>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <label className="text-[10px] text-textMuted uppercase font-mono font-bold">Stage Window Target Display</label>
                  <select
                    id="stage-target-display"
                    value={selectedStageDisplay}
                    onChange={(e) => setSelectedStageDisplay(e.target.value === 'auto' ? 'auto' : parseInt(e.target.value))}
                    className="w-full p-2.5 bg-appBg border border-[var(--border-app)] rounded-lg text-textMain text-xs focus:outline-none focus:border-brand/40 font-sans font-semibold"
                  >
                    {displays.length === 0 && (
                      <>
                        <option value="auto">Auto (Non-Primary)</option>
                        <option value="0">Primary Screen</option>
                        <option value="1">Secondary Screen</option>
                        <option value="2">Tertiary Screen</option>
                      </>
                    )}
                    {displays.map((d) => (
                      <option key={d.id} value={d.index}>
                        {d.index + 1}: {d.label} {d.isPrimary ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>
        )}

      <aside className="w-[22%] min-w-[260px] max-w-[340px] shrink-0 flex flex-col bg-appPanel border-l border-[var(--border-app)] select-none">
        {/* Live Output */}
        <div className="p-4 border-b border-[var(--border-app)] bg-appBg">
          <h3 className="text-[11px] font-bold text-textMuted uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
            Live Output
            {countdownActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500 text-white font-mono animate-pulse">COUNTDOWN</span>
            )}
            {timerActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand text-white font-mono animate-pulse">TIMER</span>
            )}
            {isCountdownRunning && !countdownActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600/35 text-red-500 border border-red-500/25 font-mono animate-pulse">COUNTDOWN RUNNING</span>
            )}
            {isTimerRunning && !timerActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-600/35 text-amber-500 border border-amber-500/25 font-mono animate-pulse">TIMER RUNNING</span>
            )}
          </h3>
          {(() => {
            const targetSong = (liveSong && liveSong.id === selectedSong?.id) ? liveSong : selectedSong;
            const curSlideObj = slides && slides[activeSlideIndex];
            const curSlideBgMedia = curSlideObj?.bgAsset 
              ? `file:///${curSlideObj.bgAsset.replace(/\\/g, '/')}`
              : (curSlideObj?.style?.background || targetSong?.bgAsset || targetSong?.style?.background || '');

            return (
              <div 
                className={`w-full bg-black rounded-lg border ${(showOnProjector || showTimerOnProjector) ? 'border-red-500/60' : 'border-[var(--border-app)]'} relative overflow-hidden flex flex-col p-3 transition-all duration-300 ${
                  aspectRatio === 'video' ? 'aspect-video' : 'aspect-[4/3]'
                } ${!(showOnProjector || showTimerOnProjector) ? getLivePreviewFlexAlignment() : 'items-center justify-center'}`}
                style={{
                  containerType: 'inline-size',
                  ...(showOnProjector 
                    ? { backgroundColor: countdownBgColor || '#000000' } 
                    : showTimerOnProjector 
                      ? { backgroundColor: timerBgColor || '#000000' }
                      : (!blackout && curSlideBgMedia && isBgColor(curSlideBgMedia) ? { backgroundColor: curSlideBgMedia } : {}))
                }}
              >
                {/* Background media */}
                {!blackout && (
                  <div className="absolute inset-0 z-0 w-full h-full">
                    {showOnProjector && countdownBgMedia ? (
                      /\.(mp4|webm|mov|avi)($|\?)/i.test(countdownBgMedia) ? (
                        <video src={formatBgPath(countdownBgMedia)} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img src={formatBgPath(countdownBgMedia)} className="w-full h-full object-cover" alt="" />
                      )
                    ) : showTimerOnProjector && timerBgMedia ? (
                      /\.(mp4|webm|mov|avi)($|\?)/i.test(timerBgMedia) ? (
                        <video src={formatBgPath(timerBgMedia)} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img src={formatBgPath(timerBgMedia)} className="w-full h-full object-cover" alt="" />
                      )
                    ) : (
                      // Regular slide background with 2.2s slow-motion crossfade
                      !showOnProjector && !showTimerOnProjector && (
                        <>
                          {/* Preview Layer A */}
                          {previewLayerA.src && previewLayerA.type !== 'color' && (
                            <div 
                              className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
                              style={{
                                zIndex: previewLayerA.zIndex,
                                opacity: previewLayerA.opacity,
                                transition: 'opacity 2200ms cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            >
                              {previewLayerA.type === 'video' ? (
                                <SharedVideoCanvas src={previewLayerA.src} maxResWidth={1280} fps={60} className="w-full h-full object-cover" />
                              ) : (
                                <img src={previewLayerA.src} className="w-full h-full object-cover" alt="" />
                              )}
                            </div>
                          )}

                          {/* Preview Layer B */}
                          {previewLayerB.src && previewLayerB.type !== 'color' && (
                            <div 
                              className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
                              style={{
                                zIndex: previewLayerB.zIndex,
                                opacity: previewLayerB.opacity,
                                transition: 'opacity 2200ms cubic-bezier(0.4, 0, 0.2, 1)'
                              }}
                            >
                              {previewLayerB.type === 'video' ? (
                                <SharedVideoCanvas src={previewLayerB.src} maxResWidth={1280} fps={60} className="w-full h-full object-cover" />
                              ) : (
                                <img src={previewLayerB.src} className="w-full h-full object-cover" alt="" />
                              )}
                            </div>
                          )}
                        </>
                      )
                    )}
                  </div>
                )}
                
                {/* Countdown overlay content */}
                {showOnProjector && !blackout ? (
                  <div className="z-10 flex flex-col items-center justify-center text-center w-full px-2">
                    {countdownTitle && (
                      <div style={{ fontSize: `${Math.max(6, (countdownTitleSize || 56) * 0.065)}px`, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.85, color: '#fff', marginBottom: '4px', lineHeight: 1.2 }}>
                        {countdownTitle}
                      </div>
                    )}
                    <div style={{ fontSize: `${Math.max(14, (countdownTimeSize || 160) * 0.1)}px`, fontWeight: 'bold', fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>
                      {countdownMode === 'current'
                        ? (() => {
                            const now = new Date();
                            const hrs = String(now.getHours()).padStart(2, '0');
                            const mins = String(now.getMinutes()).padStart(2, '0');
                            const secs = String(now.getSeconds()).padStart(2, '0');
                            return `${hrs}:${mins}:${secs}`;
                          })()
                        : formatSecondsToMinSec(countdownSeconds)
                      }
                    </div>
                    {countdownSubtext && (
                      <div style={{ fontSize: `${Math.max(5, (countdownSubtextSize || 36) * 0.065)}px`, opacity: 0.6, color: '#fff', fontStyle: 'italic', marginTop: '4px' }}>
                        {countdownSubtext}
                      </div>
                    )}
                  </div>
                ) : showTimerOnProjector && !blackout ? (
                  <div className="z-10 flex flex-col items-center justify-center text-center w-full px-2">
                    {timerTitle && (
                      <div style={{ fontSize: `${Math.max(6, (timerTitleSize || 56) * 0.065)}px`, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.85, color: '#fff', marginBottom: '4px', lineHeight: 1.2 }}>
                        {timerTitle}
                      </div>
                    )}
                    <div style={{ fontSize: `${Math.max(14, (timerTimeSize || 160) * 0.1)}px`, fontWeight: 'bold', fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>
                      {formatSecondsToMinSec(timerSeconds)}
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="z-10 flex flex-col justify-center items-center" 
                      style={liveOutputAnimStyle}
                    >
                      {(!clearLyrics && !blackout) && (previewDisplayedText || activeSlideText) && (
                        <p 
                          className="projector-text-shadow"
                          style={getLivePreviewTextStyle()}
                        >
                          {previewDisplayedText || activeSlideText}
                        </p>
                      )}
                    </div>
                    {/* Active Slide Label Indicator */}
                    {activeSlideLabel && !blackout && (
                      <div className="absolute top-2 left-2 z-20">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${getLabelBadgeStyle(activeSlideLabel).bg} ${getLabelBadgeStyle(activeSlideLabel).text}`}>
                          {activeSlideLabel}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
          
          <div className="flex items-center justify-between text-[9px] text-textMuted mt-2">
            <span>Aspect: {aspectRatio === 'video' ? '16:9' : '4:3'}</span>
            <button onClick={() => setAspectRatio(aspectRatio === 'video' ? '4/3' : 'video')} className="text-brand hover:underline font-mono text-[9px]">Toggle Ratio</button>
          </div>

          {/* Output Monitor Selector */}
          <div className="mt-2.5 flex flex-col gap-1">
            <label className="text-[9px] text-textMuted uppercase font-mono tracking-wider">Output Monitor</label>
            <select
              value={selectedProjectorDisplay}
              onChange={(e) => setSelectedProjectorDisplay(parseInt(e.target.value))}
              className="w-full p-1.5 bg-appBg border border-[var(--border-app)] rounded text-textMain text-[10px] focus:outline-none"
            >
              {displays.length === 0 && <option value={1}>Auto (Secondary Screen)</option>}
              {displays.map((d) => (
                <option key={d.id} value={d.index}>
                  {d.label} {d.isPrimary ? '(Primary)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="p-4 border-b border-[var(--border-app)] bg-appBg/50">
          <h3 className="text-[11px] font-bold text-textMuted uppercase tracking-wider mb-2 font-mono">
            {countdownActive ? 'Countdown Preview' : 'Next Slide Preview'}
          </h3>
          {countdownActive ? (
            /* Show countdown info when countdown is active */
            <div 
              className="w-full aspect-video rounded-lg border border-red-500/40 relative overflow-hidden flex flex-col items-center justify-center text-center p-3"
              style={{ backgroundColor: countdownBgColor || '#000000' }}
            >
              {countdownBgMedia && (
                <div className="absolute inset-0 z-0 w-full h-full">
                  {/\.(mp4|webm|mov|avi)($|\?)/i.test(countdownBgMedia) ? (
                    <video src={formatBgPath(countdownBgMedia)} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                  ) : (
                    <img src={formatBgPath(countdownBgMedia)} className="w-full h-full object-cover" alt="" />
                  )}
                </div>
              )}
              {countdownTitle && (
                <div style={{ fontSize: `${Math.max(7, (countdownTitleSize || 56) * 0.065)}px`, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.85, color: '#fff', marginBottom: '4px', lineHeight: 1.2 }}>
                  {countdownTitle}
                </div>
              )}
              <div style={{ fontSize: `${Math.max(16, (countdownTimeSize || 160) * 0.1)}px`, fontWeight: 'bold', fontFamily: 'monospace', color: '#fff', lineHeight: 1 }}>
                {countdownMode === 'current'
                  ? (() => {
                      const now = new Date();
                      const hrs = String(now.getHours()).padStart(2, '0');
                      const mins = String(now.getMinutes()).padStart(2, '0');
                      const secs = String(now.getSeconds()).padStart(2, '0');
                      return `${hrs}:${mins}:${secs}`;
                    })()
                  : `${String(countdownMinutes).padStart(2, '0')}:${String(countdownSeconds).padStart(2, '0')}`
                }
              </div>
              {countdownSubtext && (
                <div style={{ fontSize: `${Math.max(6, (countdownSubtextSize || 36) * 0.065)}px`, opacity: 0.6, color: '#fff', fontStyle: 'italic', marginTop: '4px' }}>
                  {countdownSubtext}
                </div>
              )}
            </div>
          ) : (
            /* Otherwise show next slide */
            (() => {
              const nextSlideIndex = activeSlideIndex + 1;
              const currentSlide = slides && slides[nextSlideIndex];
              const previewBg = currentSlide 
                ? (currentSlide.bgAsset 
                    ? `file:///${currentSlide.bgAsset.replace(/\\/g, '/')}` 
                    : (currentSlide.style && currentSlide.style.background) || '')
                : '';
              
              return (
                <div 
                  className="w-full aspect-video bg-black rounded-lg border border-[var(--border-app)] relative overflow-hidden flex flex-col p-3"
                  style={{
                    containerType: 'inline-size',
                    ...(previewBg && isBgColor(previewBg) ? { backgroundColor: previewBg } : {})
                  }}
                >
                  {previewBg && !isBgColor(previewBg) && (
                    <div className="absolute inset-0 z-0 w-full h-full">
                      {/\.(mp4|webm|mov|avi)($|\?)/i.test(previewBg) ? (
                        <video 
                          src={previewBg} 
                          autoPlay 
                          muted 
                          loop 
                          playsInline 
                          className="w-full h-full object-cover opacity-100" 
                        />
                      ) : (
                        <img 
                          src={previewBg} 
                          className="w-full h-full object-cover opacity-100" 
                          alt="" 
                        />
                      )}
                    </div>
                  )}
                  
                  <div className="z-10 flex-1 flex flex-col justify-center items-center text-center">
                    {currentSlide ? (
                      <p 
                        style={{
                          fontFamily: `'${currentSlide.style?.font || 'Inter'}', sans-serif`,
                          fontSize: `${((currentSlide.style?.size || 90) / 19.2).toFixed(3)}cqw`,
                          fontWeight: { 'normal': 400, 'semibold': 600, 'bold': 700, 'extrabold': 800 }[currentSlide.style?.weight] || currentSlide.style?.weight || 700,
                          lineHeight: currentSlide.style?.lineHeight || 1.4,
                          letterSpacing: `${currentSlide.style?.letterSpacing || 0}px`,
                          color: currentSlide.style?.color || '#ffffff',
                          textAlign: currentSlide.style?.align || 'center',
                          whiteSpace: 'pre-wrap'
                        }}
                        className="whitespace-pre-line uppercase projector-text-shadow"
                      >
                        {currentSlide.bgAsset ? '' : currentSlide.text}
                      </p>
                    ) : (
                      <p className="text-textMuted text-[10px] font-mono tracking-wider uppercase">END OF SONG</p>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Emergency Controls */}
        <div className="flex-1 p-4 bg-appBg flex flex-col justify-start gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => setBlackout(!blackout)}
              className={`py-3 rounded font-bold text-[10px] tracking-wider uppercase border transition-all flex flex-col items-center gap-1.5 justify-center ${
                blackout ? 'bg-liveDanger text-white border-liveDanger' : 'bg-appPanel border-[var(--border-app)] text-textMain hover:bg-appBg'
              }`}
            >
              <EyeOff className="h-4 w-4" />
              Blackout
            </button>
            <button 
              onClick={() => setClearLyrics(!clearLyrics)}
              className={`py-3 rounded font-bold text-[10px] tracking-wider uppercase border transition-all flex flex-col items-center gap-1.5 justify-center ${
                clearLyrics ? 'bg-amber-600 text-white border-amber-500' : 'bg-appPanel border-[var(--border-app)] text-textMain hover:bg-appBg'
              }`}
            >
              <EyeOff className="h-4 w-4" />
              Hide Lyrics
            </button>
          </div>
        </div>
      </aside>
      </div>

      {/* --- ADD SONG MODAL --- */}
      {isAddSongOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-appPanel border border-[var(--border-app)] w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-app)] flex justify-between items-center bg-appPanel">
              <h3 className="font-bold text-sm text-textMain">Import / Add New WorshipFlow Song</h3>
              <button onClick={() => setIsAddSongOpen(false)} className="text-textMuted hover:text-textMain transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-hidden p-4">
              
              {/* Left Column: Form inputs (7 cols) */}
              <form 
                id="add-song-form"
                onSubmit={handleAddSong} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                    e.preventDefault();
                  }
                }}
                className="lg:col-span-7 flex flex-col gap-4 overflow-y-auto pr-1 text-xs"
              >
                <div className="flex flex-col gap-2 bg-appBg/60 border border-[var(--border-app)] p-3 rounded-lg">
                  {/* Row 1: Title, Key, BPM, Time Sig */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">Song Title</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Title" 
                        value={newSongTitle}
                        onChange={e => setNewSongTitle(e.target.value)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain focus:outline-none text-xs font-semibold"
                      />
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">Key</label>
                      <select
                        value={newSongKey}
                        onChange={e => handleKeyChange(e.target.value, true)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain font-mono font-bold focus:outline-none text-xs"
                      >
                        {KEYS.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">BPM</label>
                      <input 
                        type="number"
                        min="30"
                        max="300"
                        value={newSongBpm}
                        onChange={e => setNewSongBpm(parseInt(e.target.value) || 120)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain font-mono font-bold focus:outline-none text-xs text-center"
                      />
                    </div>

                    <div className="col-span-4 md:col-span-3 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">Time Sig.</label>
                      <select
                        value={newSongTimeSignature}
                        onChange={e => setNewSongTimeSignature(e.target.value)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain font-mono font-bold focus:outline-none text-xs"
                      >
                        <option value="4/4">4/4</option>
                        <option value="3/4">3/4</option>
                        <option value="6/8">6/8</option>
                        <option value="2/4">2/4</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Metronome & Voice Cue Controls (Cleanly positioned below!) */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-app)]/40 text-xs">
                    <span className="text-[10px] font-mono font-bold text-textMuted uppercase tracking-wider">Metronome & Voice Cues</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewSongEnableClick(!newSongEnableClick)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono transition border ${
                          newSongEnableClick 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                            : 'bg-appBg text-textMuted border-[var(--border-app)] hover:text-textMain'
                        }`}
                        title="Toggle Click Track"
                      >
                        Click {newSongEnableClick ? 'ON' : 'OFF'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewSongEnableVoiceCues(!newSongEnableVoiceCues)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono transition border ${
                          newSongEnableVoiceCues 
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' 
                            : 'bg-appBg text-textMuted border-[var(--border-app)] hover:text-textMain'
                        }`}
                        title="Toggle Section Voice Cues"
                      >
                        Cue {newSongEnableVoiceCues ? 'ON' : 'OFF'}
                      </button>

                      <select
                        value={newSongVoiceGender}
                        onChange={e => {
                          const val = e.target.value;
                          setNewSongVoiceGender(val);
                          metronomeEngine.setVoiceGender(val);
                        }}
                        className="p-1 px-2 bg-appBg border border-[var(--border-app)] rounded text-textMain text-[11px] font-mono focus:outline-none"
                        title="Voice Gender for Section Cues"
                      >
                        <option value="female">Female Voice</option>
                        <option value="male">Male Voice</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* --- TAB SWITCHER: PRESENTATION LYRICS vs CHORDS & LEAD SHEET --- */}
                <div className="flex border-b border-[var(--border-app)] my-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSongModalTab('lyrics')}
                    className={`px-3 py-1.5 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                      songModalTab === 'lyrics'
                        ? 'border-brand text-brand bg-brand/10 rounded-t'
                        : 'border-transparent text-textMuted hover:text-textMain'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Presentation Lyrics (Projector)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSongModalTab('chords')}
                    className={`px-3 py-1.5 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                      songModalTab === 'chords'
                        ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t'
                        : 'border-transparent text-textMuted hover:text-textMain'
                    }`}
                  >
                    <Music className="h-3.5 w-3.5 text-amber-500" />
                    <span>Chords & Lead Sheet (Mobile/Musicians)</span>
                  </button>
                </div>

                {songModalTab === 'lyrics' ? (
                  <>
                    {/* Text Styling toolbar - Compact & Ultra-tight */}
                    <div className="bg-appBg border border-[var(--border-app)] rounded-t-lg p-2.5 flex flex-wrap gap-x-1.5 gap-y-2.5 items-end text-xs">
                      <div className="flex flex-col gap-0.5 min-w-[95px] flex-1">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Font</label>
                        <select 
                          value={songFont} 
                          onChange={e => setSongFont(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="Inter">Inter</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Montserrat">Montserrat</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Open Sans">Open Sans</option>
                          <option value="Lato">Lato</option>
                          <option value="Oswald">Oswald</option>
                          <option value="Raleway">Raleway</option>
                          <option value="Nunito">Nunito</option>
                          <option value="Playfair Display">Playfair Display</option>
                          <option value="Bebas Neue">Bebas Neue</option>
                          <option value="Anton">Anton</option>
                          <option value="Fjalla One">Fjalla One</option>
                          <option value="Archivo Black">Archivo Black</option>
                          <option value="Cinzel">Cinzel</option>
                          <option value="Outfit">Outfit</option>
                          <option value="Syne">Syne</option>
                          <option value="League Spartan">League Spartan</option>
                          <option value="Unbounded">Unbounded</option>
                          <option value="Instrument Serif">Instrument Serif</option>
                          <option value="Arial">Arial</option>
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-0.5 w-14">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Size (px)</label>
                        <input 
                          type="number" 
                          value={songSize} 
                          onChange={e => setSongSize(parseInt(e.target.value) || 60)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[85px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Weight</label>
                        <select 
                          value={songWeight} 
                          onChange={e => setSongWeight(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="normal">Normal</option>
                          <option value="semibold">Semibold</option>
                          <option value="bold">Bold</option>
                          <option value="extrabold">Extra Bold</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Line Spacing</label>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0.5"
                          max="3.0"
                          value={songLineHeight} 
                          onChange={e => setSongLineHeight(parseFloat(e.target.value) || 1.4)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Char Spacing</label>
                        <input 
                          type="number" 
                          min="-5"
                          max="20"
                          value={songLetterSpacing} 
                          onChange={e => setSongLetterSpacing(parseInt(e.target.value) || 0)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Color</label>
                        <div className="flex gap-1 items-center bg-appPanel border border-[var(--border-app)] px-1 py-0.5 rounded h-[26px]">
                          <input 
                            type="color" 
                            value={songColor} 
                            onChange={e => setSongColor(e.target.value)}
                            className="w-4 h-4 bg-transparent border-0 cursor-pointer p-0"
                          />
                          <span className="text-[8px] font-mono text-textMuted uppercase">{songColor}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Bg Color</label>
                        <div className="flex gap-1 items-center bg-appPanel border border-[var(--border-app)] px-1 py-0.5 rounded h-[26px]">
                          <input 
                            type="color" 
                            value={songBgColor} 
                            onChange={e => setSongBgColor(e.target.value)}
                            className="w-4 h-4 bg-transparent border-0 cursor-pointer p-0"
                          />
                          <span className="text-[8px] font-mono text-textMuted uppercase">{songBgColor}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[70px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Bg Opacity</label>
                        <select 
                          value={songBgOpacity} 
                          onChange={e => setSongBgOpacity(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs font-mono"
                        >
                          <option value="0%">0%</option>
                          <option value="20%">20%</option>
                          <option value="40%">40%</option>
                          <option value="60%">60%</option>
                          <option value="80%">80%</option>
                          <option value="100%">100%</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[80px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Align</label>
                        <select 
                          value={songAlign} 
                          onChange={e => setSongAlign(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[80px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Vertical</label>
                        <select 
                          value={songVertical} 
                          onChange={e => setSongVertical(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="top">Top</option>
                          <option value="center">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">BG Height</label>
                        <input 
                          type="number" 
                          min="10"
                          max="100"
                          value={songBgHeight} 
                          onChange={e => setSongBgHeight(parseInt(e.target.value) || 100)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">BG Width</label>
                        <input 
                          type="number" 
                          min="10"
                          max="100"
                          value={songBgWidth} 
                          onChange={e => setSongBgWidth(parseInt(e.target.value) || 100)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">BG Radius</label>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          value={songBgRadius} 
                          onChange={e => setSongBgRadius(parseInt(e.target.value) || 0)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[210px] flex-1">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Anim & Speed</label>
                        <div className="flex gap-1">
                          <select 
                            value={songAnimation} 
                            onChange={e => setSongAnimation(e.target.value)}
                            className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs flex-1"
                          >
                            <option value="None">None</option>
                            <option value="Fade In">Fade In</option>
                            <option value="Fade Out">Fade Out</option>
                            <option value="Fade">Fade</option>
                            <option value="Zoom In/Out">Zoom In/Out</option>
                            <option value="Slide Left">Slide Left</option>
                            <option value="Slide Right">Slide Right</option>
                            <option value="Slide Up">Slide Up</option>
                          </select>
                          <div className="flex items-center gap-1 bg-appPanel border border-[var(--border-app)] rounded px-2 py-0.5 flex-1">
                            <input 
                              type="text" 
                              value={songSpeed} 
                              onChange={e => setSongSpeed(e.target.value)}
                              placeholder="0.6s"
                              className="w-full bg-transparent text-textMain text-xs focus:outline-none"
                            />
                            <span className="text-[10px] text-textMuted font-mono">Secs</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <label className="text-textMuted font-semibold font-mono text-xs">Lyrics & Slides Layout</label>
                        <span className="text-[9px] text-textMuted font-mono">Separate slide sections with a blank line.</span>
                      </div>
                      <textarea 
                        rows="18"
                        required
                        placeholder="" 
                        value={newSongSlidesRaw}
                        onSelect={(e) => handleTextareaCursorChange(e, true)}
                        onChange={(e) => { setNewSongSlidesRaw(e.target.value); handleTextareaCursorChange(e, true); }}
                        className="p-2.5 bg-appBg border border-t-0 border-[var(--border-app)] rounded-b-lg focus:border-brand focus:outline-none font-mono leading-relaxed"
                      ></textarea>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">Chords & Lead Sheet Chart (Image 1 Format)</span>
                      </div>
                      <span className="text-[10px] text-amber-300/80 font-mono">
                        Displayed on Mobile Prompter when "Chords: ON" is toggled
                      </span>
                    </div>

                    <textarea 
                      rows="18"
                      placeholder={`Verse 1\nD\nYou were the Word at the beginning\n            G      Bm      A\nOne with God the Lord Most High\n\nChorus 1\n                  D\nWhat a beautiful Name it is\n                  A\nWhat a beautiful Name it is`}
                      value={newSongChordsRaw}
                      onChange={(e) => setNewSongChordsRaw(e.target.value)}
                      className="p-3 bg-slate-950 text-amber-300 border border-[var(--border-app)] rounded-lg focus:border-amber-500 focus:outline-none font-mono text-xs leading-relaxed"
                    ></textarea>
                  </div>
                )}
              </form>

              {/* Right Column: Live Slide Previewer (5 cols) */}
              <div className="lg:col-span-5 flex flex-col bg-appBg/50 border border-[var(--border-app)] rounded-lg p-3 overflow-y-auto max-h-[70vh] space-y-4">
                <span className="text-[10px] text-textMuted uppercase font-mono tracking-wider font-bold block border-b border-[var(--border-app)] pb-2">
                  Live View Preview (Double Newlines divide slides)
                </span>
                
                {addPreviewSlides.length > 0 ? (
                  addPreviewSlides.map((slide, idx) => {
                    const isCurrent = idx === activeAddPreviewIdx;
                    const hex = slide.style.bgColor || '#000000';
                    const opacityStr = slide.style.bgOpacity || '0%';
                    const opacity = parseInt(opacityStr) || 0;
                    const rgbaBg = opacity === 0 
                      ? 'transparent' 
                      : (() => {
                          const r = parseInt(hex.slice(1, 3), 16) || 0;
                          const g = parseInt(hex.slice(3, 5), 16) || 0;
                          const b = parseInt(hex.slice(5, 7), 16) || 0;
                          return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
                        })();

                    const flexAlignClass = slide.style.align === 'left' ? 'items-start' : slide.style.align === 'right' ? 'items-end' : 'items-center';
                    const verticalClass = slide.style.vertical === 'top' ? 'justify-start' : slide.style.vertical === 'bottom' ? 'justify-end' : 'justify-center';

                    return (
                      <div 
                        key={idx} 
                        id={`add-preview-card-${idx}`}
                        onClick={() => {
                          setActiveAddPreviewIdx(idx);
                          const textarea = document.querySelector('form textarea');
                          if (textarea) {
                            const textVal = textarea.value;
                            const blocks = textVal.split('\n\n');
                            let startPos = 0;
                            for (let i = 0; i < idx && i < blocks.length; i++) {
                              startPos += blocks[i].length + 2;
                            }
                            const endPos = startPos + (blocks[idx] ? blocks[idx].length : 0);
                            textarea.focus();
                            textarea.setSelectionRange(startPos, endPos);
                            const linesUpTo = textVal.substring(0, startPos).split('\n').length;
                            const lineHeight = 24;
                            textarea.scrollTop = (linesUpTo - 1) * lineHeight;
                          }
                        }}
                        className={`space-y-1 bg-appPanel/30 p-2 rounded border cursor-pointer transition-all duration-200 ${getSlideCardBorderClass(slide.label, isCurrent, false, true)}`}
                      >
                        <div className="flex justify-between items-center text-[9px] font-mono text-textMuted uppercase font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${getLabelBadgeStyle(slide.label).bg} ${getLabelBadgeStyle(slide.label).text}`}>
                            {slide.label || `SLIDE ${idx + 1}`} {isCurrent && '• Editing'}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-appBg/50 rounded overflow-hidden border border-appPanel">
                              <span className="px-1 text-[8px] text-textMuted border-r border-appPanel" title="Slide Font Size">px</span>
                              <input 
                                type="number" 
                                value={slide.style?.size || songSize} 
                                onChange={(e) => handleUpdateSlideSpecificSize(idx, parseInt(e.target.value) || 60, false)}
                                className="w-10 text-center bg-transparent text-textMain text-[9px] py-0.5 focus:outline-none"
                              />
                            </div>
                            <span className="font-mono bg-appBg px-1.5 py-0.5 rounded">{idx + 1}</span>
                          </div>
                        </div>
                        <div 
                          className={`aspect-video w-full rounded relative overflow-hidden flex flex-col p-3 ${slide.style?.background && isBgColor(slide.style.background) ? '' : 'bg-checkerboard'} ${verticalClass} ${flexAlignClass}`}
                          style={{ 
                            containerType: 'inline-size',
                            backgroundColor: (slide.style?.background && isBgColor(slide.style.background)) ? slide.style.background : undefined
                          }}
                        >
                          {slide.style?.background && !isBgColor(slide.style.background) && (
                            <img src={slide.style.background} className="absolute inset-0 w-full h-full object-cover opacity-35 z-0" alt="" />
                          )}
                          <div 
                            className="z-10"
                            style={{
                              backgroundColor: rgbaBg,
                              borderRadius: slide.style?.bgRadius !== undefined ? `${((slide.style.bgRadius) / 19.2).toFixed(3)}cqw` : '0.208cqw',
                              height: slide.style?.bgHeight !== undefined ? (typeof slide.style.bgHeight === 'number' || !slide.style.bgHeight.toString().endsWith('%') ? `${slide.style.bgHeight}%` : slide.style.bgHeight) : '100%',
                              width: slide.style?.bgWidth !== undefined ? (typeof slide.style.bgWidth === 'number' || !slide.style.bgWidth.toString().endsWith('%') ? `${slide.style.bgWidth}%` : slide.style.bgWidth) : '100%',
                              padding: opacity > 0 ? '0.4em 0.8em' : '0',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: slide.style?.vertical === 'top' ? 'flex-start' : slide.style?.vertical === 'bottom' ? 'flex-end' : 'center',
                              alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
                            }}
                          >
                            <p 
                              style={{
                                fontFamily: `'${slide.style.font || 'Inter'}', sans-serif`,
                                fontSize: `${((slide.style.size || 90) / 19.2).toFixed(3)}cqw`,
                                fontWeight: { 'normal': 400, 'semibold': 600, 'bold': 700, 'extrabold': 800 }[slide.style.weight] || slide.style.weight || 700,
                                lineHeight: slide.style.lineHeight || 1.4,
                                letterSpacing: `${((slide.style.letterSpacing || 0) / 19.2).toFixed(3)}cqw`,
                                color: slide.style.color || '#ffffff',
                                textAlign: slide.style.align || 'center',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'keep-all',
                                overflowWrap: 'break-word'
                              }}
                              className="projector-text-shadow"
                            >
                              {slide.text || '[EMPTY]'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-20 text-textMuted text-xs">
                    Start typing below to see live previews...
                  </div>
                )}
              </div>

            </div>

            <div className="p-4 border-t border-[var(--border-app)] flex justify-end gap-2 bg-appPanel">
              <button 
                type="button" 
                onClick={() => setIsAddSongOpen(false)}
                className="px-4 py-2 border border-[var(--border-app)] text-textMuted hover:text-textMain hover:bg-appBg rounded transition font-mono text-xs"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="add-song-form"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded flex items-center gap-1.5 transition font-mono text-xs shadow-md"
              >
                <Save className="h-4 w-4" />
                Save Song
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT WORSHIPFLOW SONG MODAL --- */}
      {isEditSongOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-appPanel border border-[var(--border-app)] w-full max-w-5xl rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border-app)] flex justify-between items-center bg-appPanel">
              <h3 className="font-bold text-sm text-textMain">Edit WorshipFlow Song</h3>
              <button onClick={() => setIsEditSongOpen(false)} className="text-textMuted hover:text-textMain transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-hidden p-4">
              
              {/* Left Column: Form inputs (7 cols) */}
              <form 
                id="edit-song-form"
                onSubmit={handleSaveEditSong} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                    e.preventDefault();
                  }
                }}
                className="lg:col-span-7 flex flex-col gap-4 overflow-y-auto pr-1 text-xs"
              >
                <div className="flex flex-col gap-2 bg-appBg/60 border border-[var(--border-app)] p-3 rounded-lg">
                  {/* Row 1: Title, Key, BPM, Time Sig */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">Song Title</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Title" 
                        value={editSongTitle}
                        onChange={e => setEditSongTitle(e.target.value)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain focus:outline-none text-xs font-semibold"
                      />
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">Key</label>
                      <select
                        value={editSongKey}
                        onChange={e => handleKeyChange(e.target.value, false)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain font-mono font-bold focus:outline-none text-xs"
                      >
                        {KEYS.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">BPM</label>
                      <input 
                        type="number"
                        min="30"
                        max="300"
                        value={editSongBpm}
                        onChange={e => setEditSongBpm(parseInt(e.target.value) || 120)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain font-mono font-bold focus:outline-none text-xs text-center"
                      />
                    </div>

                    <div className="col-span-4 md:col-span-3 flex flex-col gap-1">
                      <label className="text-textMuted font-semibold font-mono text-[10px] uppercase tracking-wider">Time Sig.</label>
                      <select
                        value={editSongTimeSignature}
                        onChange={e => setEditSongTimeSignature(e.target.value)}
                        className="p-1.5 bg-appBg border border-[var(--border-app)] rounded focus:border-brand text-textMain font-mono font-bold focus:outline-none text-xs"
                      >
                        <option value="4/4">4/4</option>
                        <option value="3/4">3/4</option>
                        <option value="6/8">6/8</option>
                        <option value="2/4">2/4</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Metronome & Voice Cue Controls (Cleanly positioned below!) */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-app)]/40 text-xs">
                    <span className="text-[10px] font-mono font-bold text-textMuted uppercase tracking-wider">Metronome & Voice Cues</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditSongEnableClick(!editSongEnableClick)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono transition border ${
                          editSongEnableClick 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                            : 'bg-appBg text-textMuted border-[var(--border-app)] hover:text-textMain'
                        }`}
                        title="Toggle Click Track"
                      >
                        Click {editSongEnableClick ? 'ON' : 'OFF'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditSongEnableVoiceCues(!editSongEnableVoiceCues)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold font-mono transition border ${
                          editSongEnableVoiceCues 
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/40' 
                            : 'bg-appBg text-textMuted border-[var(--border-app)] hover:text-textMain'
                        }`}
                        title="Toggle Section Voice Cues"
                      >
                        Cue {editSongEnableVoiceCues ? 'ON' : 'OFF'}
                      </button>

                      <select
                        value={editSongVoiceGender}
                        onChange={e => {
                          const val = e.target.value;
                          setEditSongVoiceGender(val);
                          metronomeEngine.setVoiceGender(val);
                        }}
                        className="p-1 px-2 bg-appBg border border-[var(--border-app)] rounded text-textMain text-[11px] font-mono focus:outline-none"
                        title="Voice Gender for Section Cues"
                      >
                        <option value="female">Female Voice</option>
                        <option value="male">Male Voice</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* --- TAB SWITCHER: PRESENTATION LYRICS vs CHORDS & LEAD SHEET --- */}
                <div className="flex border-b border-[var(--border-app)] my-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSongModalTab('lyrics')}
                    className={`px-3 py-1.5 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                      songModalTab === 'lyrics'
                        ? 'border-brand text-brand bg-brand/10 rounded-t'
                        : 'border-transparent text-textMuted hover:text-textMain'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Presentation Lyrics (Projector)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSongModalTab('chords')}
                    className={`px-3 py-1.5 text-xs font-bold font-mono transition flex items-center gap-1.5 border-b-2 ${
                      songModalTab === 'chords'
                        ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t'
                        : 'border-transparent text-textMuted hover:text-textMain'
                    }`}
                  >
                    <Music className="h-3.5 w-3.5 text-amber-500" />
                    <span>Chords & Lead Sheet (Mobile/Musicians)</span>
                  </button>
                </div>

                {songModalTab === 'lyrics' ? (
                  <>
                    {/* Text Styling toolbar - Compact & Ultra-tight */}
                    <div className="bg-appBg border border-[var(--border-app)] rounded-t-lg p-2.5 flex flex-wrap gap-x-1.5 gap-y-2.5 items-end text-xs">
                      <div className="flex flex-col gap-0.5 min-w-[95px] flex-1">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Font</label>
                        <select 
                          value={songFont} 
                          onChange={e => setSongFont(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="Inter">Inter</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Montserrat">Montserrat</option>
                          <option value="Roboto">Roboto</option>
                          <option value="Open Sans">Open Sans</option>
                          <option value="Lato">Lato</option>
                          <option value="Oswald">Oswald</option>
                          <option value="Raleway">Raleway</option>
                          <option value="Nunito">Nunito</option>
                          <option value="Playfair Display">Playfair Display</option>
                          <option value="Bebas Neue">Bebas Neue</option>
                          <option value="Anton">Anton</option>
                          <option value="Fjalla One">Fjalla One</option>
                          <option value="Archivo Black">Archivo Black</option>
                          <option value="Cinzel">Cinzel</option>
                          <option value="Outfit">Outfit</option>
                          <option value="Syne">Syne</option>
                          <option value="League Spartan">League Spartan</option>
                          <option value="Unbounded">Unbounded</option>
                          <option value="Instrument Serif">Instrument Serif</option>
                          <option value="Arial">Arial</option>
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-0.5 w-14">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Size (px)</label>
                        <input 
                          type="number" 
                          value={songSize} 
                          onChange={e => setSongSize(parseInt(e.target.value) || 60)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[85px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Weight</label>
                        <select 
                          value={songWeight} 
                          onChange={e => setSongWeight(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="normal">Normal</option>
                          <option value="semibold">Semibold</option>
                          <option value="bold">Bold</option>
                          <option value="extrabold">Extra Bold</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Line Spacing</label>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0.5"
                          max="3.0"
                          value={songLineHeight} 
                          onChange={e => setSongLineHeight(parseFloat(e.target.value) || 1.4)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Char Spacing</label>
                        <input 
                          type="number" 
                          min="-5"
                          max="20"
                          value={songLetterSpacing} 
                          onChange={e => setSongLetterSpacing(parseInt(e.target.value) || 0)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Color</label>
                        <div className="flex gap-1 items-center bg-appPanel border border-[var(--border-app)] px-1 py-0.5 rounded h-[26px]">
                          <input 
                            type="color" 
                            value={songColor} 
                            onChange={e => setSongColor(e.target.value)}
                            className="w-4 h-4 bg-transparent border-0 cursor-pointer p-0"
                          />
                          <span className="text-[8px] font-mono text-textMuted uppercase">{songColor}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Bg Color</label>
                        <div className="flex gap-1 items-center bg-appPanel border border-[var(--border-app)] px-1 py-0.5 rounded h-[26px]">
                          <input 
                            type="color" 
                            value={songBgColor} 
                            onChange={e => setSongBgColor(e.target.value)}
                            className="w-4 h-4 bg-transparent border-0 cursor-pointer p-0"
                          />
                          <span className="text-[8px] font-mono text-textMuted uppercase">{songBgColor}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[70px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Bg Opacity</label>
                        <select 
                          value={songBgOpacity} 
                          onChange={e => setSongBgOpacity(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs font-mono"
                        >
                          <option value="0%">0%</option>
                          <option value="20%">20%</option>
                          <option value="40%">40%</option>
                          <option value="60%">60%</option>
                          <option value="80%">80%</option>
                          <option value="100%">100%</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[80px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Align</label>
                        <select 
                          value={songAlign} 
                          onChange={e => setSongAlign(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[80px]">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Vertical</label>
                        <select 
                          value={songVertical} 
                          onChange={e => setSongVertical(e.target.value)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs w-full"
                        >
                          <option value="top">Top</option>
                          <option value="center">Center</option>
                          <option value="bottom">Bottom</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">BG Height</label>
                        <input 
                          type="number" 
                          min="10"
                          max="100"
                          value={songBgHeight} 
                          onChange={e => setSongBgHeight(parseInt(e.target.value) || 100)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">BG Width</label>
                        <input 
                          type="number" 
                          min="10"
                          max="100"
                          value={songBgWidth} 
                          onChange={e => setSongBgWidth(parseInt(e.target.value) || 100)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 w-16">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">BG Radius</label>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          value={songBgRadius} 
                          onChange={e => setSongBgRadius(parseInt(e.target.value) || 0)}
                          className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-center focus:outline-none text-xs font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5 min-w-[210px] flex-1">
                        <label className="text-[9px] text-textMuted uppercase font-mono tracking-tight">Anim & Speed</label>
                        <div className="flex gap-1">
                          <select 
                            value={songAnimation} 
                            onChange={e => setSongAnimation(e.target.value)}
                            className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none text-xs flex-1"
                          >
                            <option value="None">None</option>
                            <option value="Fade In">Fade In</option>
                            <option value="Fade Out">Fade Out</option>
                            <option value="Fade">Fade</option>
                            <option value="Zoom In/Out">Zoom In/Out</option>
                            <option value="Slide Left">Slide Left</option>
                            <option value="Slide Right">Slide Right</option>
                            <option value="Slide Up">Slide Up</option>
                          </select>
                          <div className="flex items-center gap-1 bg-appPanel border border-[var(--border-app)] rounded px-2 py-0.5 flex-1">
                            <input 
                              type="text" 
                              value={songSpeed} 
                              onChange={e => setSongSpeed(e.target.value)}
                              placeholder="0.6s"
                              className="w-full bg-transparent text-textMain text-xs focus:outline-none"
                            />
                            <span className="text-[10px] text-textMuted font-mono">Secs</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <textarea 
                        rows="18"
                        value={editSongSlidesRaw}
                        onSelect={(e) => handleTextareaCursorChange(e, false)}
                        onChange={(e) => { setEditSongSlidesRaw(e.target.value); handleTextareaCursorChange(e, false); }}
                        className="p-2.5 bg-appBg border border-t-0 border-[var(--border-app)] rounded-b-lg focus:border-brand focus:outline-none font-mono leading-relaxed text-textMain"
                      ></textarea>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">Chords & Lead Sheet Chart (Image 1 Format)</span>
                      </div>
                      <span className="text-[10px] text-amber-300/80 font-mono">
                        Displayed on Mobile Prompter when "Chords: ON" is toggled
                      </span>
                    </div>

                    <textarea 
                      rows="18"
                      placeholder={`Verse 1\nD\nYou were the Word at the beginning\n            G      Bm      A\nOne with God the Lord Most High\n\nChorus 1\n                  D\nWhat a beautiful Name it is\n                  A\nWhat a beautiful Name it is`}
                      value={editSongChordsRaw}
                      onChange={(e) => setEditSongChordsRaw(e.target.value)}
                      className="p-3 bg-slate-950 text-amber-300 border border-[var(--border-app)] rounded-lg focus:border-amber-500 focus:outline-none font-mono text-xs leading-relaxed"
                    ></textarea>
                  </div>
                )}
              </form>

              {/* Right Column: Live Slide Previewer (5 cols) */}
              <div className="lg:col-span-5 flex flex-col bg-appBg/50 border border-[var(--border-app)] rounded-lg p-3 overflow-y-auto max-h-[70vh] space-y-4">
                <span className="text-[10px] text-textMuted uppercase font-mono tracking-wider font-bold block border-b border-[var(--border-app)] pb-2">
                  Live View Preview (Double Newlines divide slides)
                </span>
                
                {editPreviewSlides.length > 0 ? (
                  editPreviewSlides.map((slide, idx) => {
                    const isCurrent = idx === activeEditPreviewIdx;
                    const hex = slide.style.bgColor || '#000000';
                    const opacityStr = slide.style.bgOpacity || '0%';
                    const opacity = parseInt(opacityStr) || 0;
                    const rgbaBg = opacity === 0 
                      ? 'transparent' 
                      : (() => {
                          const r = parseInt(hex.slice(1, 3), 16) || 0;
                          const g = parseInt(hex.slice(3, 5), 16) || 0;
                          const b = parseInt(hex.slice(5, 7), 16) || 0;
                          return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
                        })();

                    const flexAlignClass = slide.style.align === 'left' ? 'items-start' : slide.style.align === 'right' ? 'items-end' : 'items-center';
                    const verticalClass = slide.style.vertical === 'top' ? 'justify-start' : slide.style.vertical === 'bottom' ? 'justify-end' : 'justify-center';

                    return (
                      <div 
                        key={idx} 
                        id={`edit-preview-card-${idx}`}
                        onClick={() => {
                          setActiveEditPreviewIdx(idx);
                          // Sync text cursor position and highlight block in the textarea
                          const textarea = document.querySelector('form textarea');
                          if (textarea) {
                            const textVal = textarea.value;
                            const blocks = textVal.split('\n\n');
                            let startPos = 0;
                            for (let i = 0; i < idx && i < blocks.length; i++) {
                              startPos += blocks[i].length + 2; // block length plus double newline
                            }
                            const endPos = startPos + (blocks[idx] ? blocks[idx].length : 0);
                            textarea.focus();
                            textarea.setSelectionRange(startPos, endPos);
                            // Scroll the textarea to line up
                            const lineCount = textVal.substring(0, startPos).split('\n').length;
                            textarea.scrollTop = (lineCount - 1) * 20;
                          }
                        }}
                        className={`space-y-1 bg-appPanel/30 p-2 rounded border cursor-pointer hover:bg-appPanel/50 transition-all duration-200 ${getSlideCardBorderClass(slide.label, isCurrent, false, true)}`}
                      >
                        <div className="flex justify-between items-center text-[9px] font-mono text-textMuted uppercase font-semibold">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${getLabelBadgeStyle(slide.label).bg} ${getLabelBadgeStyle(slide.label).text}`}>
                            {slide.label || `SLIDE ${idx + 1}`} {isCurrent && '• Editing'}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-appBg/50 rounded overflow-hidden border border-appPanel">
                              <span className="px-1 text-[8px] text-textMuted border-r border-appPanel" title="Slide Font Size">px</span>
                              <input 
                                type="number" 
                                value={slide.style?.size || songSize} 
                                onChange={(e) => handleUpdateSlideSpecificSize(idx, parseInt(e.target.value) || 60, true)}
                                className="w-10 text-center bg-transparent text-textMain text-[9px] py-0.5 focus:outline-none"
                              />
                            </div>
                            <span className="font-mono bg-appBg px-1.5 py-0.5 rounded">{idx + 1}</span>
                          </div>
                        </div>
                        <div 
                          className={`aspect-video w-full rounded relative overflow-hidden flex flex-col p-3 ${slide.style?.background && isBgColor(slide.style.background) ? '' : 'bg-checkerboard'} ${verticalClass} ${flexAlignClass}`}
                          style={{ 
                            containerType: 'inline-size',
                            backgroundColor: (slide.style?.background && isBgColor(slide.style.background)) ? slide.style.background : undefined
                          }}
                        >
                          {slide.style?.background && !isBgColor(slide.style.background) && (
                            <img src={slide.style.background} className="absolute inset-0 w-full h-full object-cover opacity-35 z-0" alt="" />
                          )}
                          <div 
                            className="z-10"
                            style={{
                              backgroundColor: rgbaBg,
                              borderRadius: slide.style?.bgRadius !== undefined ? `${((slide.style.bgRadius) / 19.2).toFixed(3)}cqw` : '0.208cqw',
                              height: slide.style?.bgHeight !== undefined ? (typeof slide.style.bgHeight === 'number' || !slide.style.bgHeight.toString().endsWith('%') ? `${slide.style.bgHeight}%` : slide.style.bgHeight) : '100%',
                              width: slide.style?.bgWidth !== undefined ? (typeof slide.style.bgWidth === 'number' || !slide.style.bgWidth.toString().endsWith('%') ? `${slide.style.bgWidth}%` : slide.style.bgWidth) : '100%',
                              padding: opacity > 0 ? '0.4em 0.8em' : '0',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: slide.style?.vertical === 'top' ? 'flex-start' : slide.style?.vertical === 'bottom' ? 'flex-end' : 'center',
                              alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
                            }}
                          >
                            <p 
                              style={{
                                fontFamily: `'${slide.style.font || 'Inter'}', sans-serif`,
                                fontSize: `${((slide.style.size || 90) / 19.2).toFixed(3)}cqw`,
                                fontWeight: { 'normal': 400, 'semibold': 600, 'bold': 700, 'extrabold': 800 }[slide.style.weight] || slide.style.weight || 700,
                                lineHeight: slide.style.lineHeight || 1.4,
                                letterSpacing: `${((slide.style.letterSpacing || 0) / 19.2).toFixed(3)}cqw`,
                                color: slide.style.color || '#ffffff',
                                textAlign: slide.style.align || 'center',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'keep-all',
                                overflowWrap: 'break-word'
                              }}
                              className="projector-text-shadow"
                            >
                              {slide.text || '[EMPTY]'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-20 text-textMuted text-xs">
                    Start typing below to see live previews...
                  </div>
                )}
              </div>

            </div>
            
            <div className="p-4 border-t border-[var(--border-app)] flex justify-end gap-2 bg-appPanel rounded-b-lg">
              <button 
                type="button" 
                onClick={() => setIsEditSongOpen(false)}
                className="px-4 py-2 border border-[var(--border-app)] text-textMuted hover:text-textMain hover:bg-appBg rounded transition font-mono text-xs"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="edit-song-form"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded flex items-center gap-1.5 transition font-mono text-xs shadow-md"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- REMOTE SYNC MODAL --- */}
      {isRemoteSyncOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-appPanel border border-[var(--border-app)] w-full max-w-sm rounded-xl shadow-2xl flex flex-col p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border-app)]">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <Smartphone className="h-4.5 w-4.5 text-brand" />
                Wireless Sync & Prompter
              </h3>
              <button onClick={() => setIsRemoteSyncOpen(false)} className="text-textMuted hover:text-textMain transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab selector */}
            <div className="flex bg-appBg p-1 rounded-lg border border-[var(--border-app)]">
              <button
                onClick={() => setRemoteSyncTab('remote')}
                className={`flex-1 py-1.5 text-[11px] font-bold font-mono rounded-md transition ${
                  remoteSyncTab === 'remote'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-textMuted hover:text-textMain'
                }`}
              >
                Mobile Remote
              </button>
              <button
                onClick={() => setRemoteSyncTab('lyrics')}
                className={`flex-1 py-1.5 text-[11px] font-bold font-mono rounded-md transition ${
                  remoteSyncTab === 'lyrics'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-textMuted hover:text-textMain'
                }`}
              >
                2-Col Lyrics View
              </button>
            </div>

            {remoteSyncTab === 'remote' ? (
              <div className="flex flex-col items-center justify-center text-center p-3 bg-appBg/50 rounded-xl border border-[var(--border-app)] space-y-3">
                <p className="text-[11px] text-textMuted leading-relaxed">
                  Scan this QR code with your phone/tablet on <strong>Wi-Fi</strong> to control slides, search Bibles, & trigger overrides.
                </p>

                {remoteQrData ? (
                  <div className="p-3 bg-white rounded-lg shadow-inner">
                    <img src={remoteQrData} alt="Remote Sync QR Code" className="h-40 w-40 object-contain" />
                  </div>
                ) : (
                  <div className="h-40 w-40 rounded-lg bg-slate-800 animate-pulse flex items-center justify-center text-[10px] text-textMuted">Generating...</div>
                )}

                <div className="w-full space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider text-textMuted font-bold block">Remote URL</span>
                  <input 
                    type="text" 
                    readOnly 
                    value={remoteUrl} 
                    onClick={(e) => { e.target.select(); }}
                    className="w-full p-2 text-center bg-appBg border border-[var(--border-app)] rounded-lg text-xs font-mono text-brand font-bold focus:outline-none cursor-pointer"
                    title="Click to select all"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-3 bg-appBg/50 rounded-xl border border-[var(--border-app)] space-y-3">
                <p className="text-[11px] text-textMuted leading-relaxed">
                  Scan for <strong>Lyrics Prompter View (2-Column)</strong>. Clean white layout for singers with active slide box outlines.
                </p>

                {lyricsQrData ? (
                  <div className="p-3 bg-white rounded-lg shadow-inner">
                    <img src={lyricsQrData} alt="Lyrics Prompter QR Code" className="h-40 w-40 object-contain" />
                  </div>
                ) : (
                  <div className="h-40 w-40 rounded-lg bg-slate-800 animate-pulse flex items-center justify-center text-[10px] text-textMuted">Generating...</div>
                )}

                <div className="w-full space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-wider text-textMuted font-bold block">2-Column Lyrics Prompter URL</span>
                  <input 
                    type="text" 
                    readOnly 
                    value={lyricsUrl} 
                    onClick={(e) => { e.target.select(); }}
                    className="w-full p-2 text-center bg-appBg border border-[var(--border-app)] rounded-lg text-xs font-mono text-emerald-400 font-bold focus:outline-none cursor-pointer"
                    title="Click to select all"
                  />
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsRemoteSyncOpen(false)}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg text-xs transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

      {/* --- SETTINGS TABBED DIALOG MODAL (With Appearance customizer) --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-appPanel border border-[var(--border-app)] w-full max-w-2xl rounded-lg shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className="p-4 border-b border-[var(--border-app)] flex justify-between items-center bg-appPanel">
              <h3 className="font-bold text-sm text-textMain flex items-center gap-2">
                <Settings className="h-4 w-4 text-brand" />
                System Settings
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-textMuted hover:text-textMain transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              
              {/* Tab selector menu */}
              <div className="w-1/4 bg-appBg border-r border-[var(--border-app)] p-2.5 flex flex-col gap-1 text-[11px] font-mono">
                <button 
                  onClick={() => setActiveSettingsTab('appearance')}
                  className={`w-full p-2.5 rounded text-left font-bold transition flex items-center gap-2 ${
                    activeSettingsTab === 'appearance' 
                    ? 'bg-brand/10 text-brand border border-brand/40' 
                    : 'text-textMuted hover:text-textMain hover:bg-appPanel/30 border border-transparent'
                  }`}
                >
                  Appearance Theme
                </button>
                <button 
                  onClick={() => setActiveSettingsTab('projector')}
                  className={`w-full p-2.5 rounded text-left font-bold transition flex items-center gap-2 ${
                    activeSettingsTab === 'projector' 
                    ? 'bg-brand/10 text-brand border border-brand/40' 
                    : 'text-textMuted hover:text-textMain hover:bg-appPanel/30 border border-transparent'
                  }`}
                >
                  Projector Output
                </button>
                <button 
                  onClick={() => setActiveSettingsTab('updates')}
                  className={`w-full p-2.5 rounded text-left font-bold transition flex items-center gap-2 ${
                    activeSettingsTab === 'updates' 
                    ? 'bg-brand/10 text-brand border border-brand/40' 
                    : 'text-textMuted hover:text-textMain hover:bg-appPanel/30 border border-transparent'
                  }`}
                >
                  Updates
                </button>
                <button 
                  onClick={() => setActiveSettingsTab('songlibrary')}
                  className={`w-full p-2.5 rounded text-left font-bold transition flex items-center gap-2 ${
                    activeSettingsTab === 'songlibrary' 
                    ? 'bg-brand/10 text-brand border border-brand/40' 
                    : 'text-textMuted hover:text-textMain hover:bg-appPanel/30 border border-transparent'
                  }`}
                >
                  Song Library
                </button>
              </div>

              {/* Settings content pane */}
              <div className="flex-1 p-5 overflow-y-auto text-xs space-y-5">
                
                {/* 1. APPEARANCE TAB */}
                {activeSettingsTab === 'appearance' && (
                  <div className="space-y-4 font-sans">
                    <div>
                      <h4 className="text-xs font-bold text-textMain mb-1">Appearance</h4>
                    </div>

                    {/* Section 1: Appearance Mode */}
                    <div className="bg-appBg border border-[var(--border-app)] rounded p-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-bold text-textMain block">Appearance</span>
                        <span className="text-[10px] text-textMuted block">Select light, dark, or inherit system settings.</span>
                      </div>
                      <select 
                        value={appearanceMode}
                        onChange={e => setAppearanceMode(e.target.value)}
                        className="p-1.5 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none min-w-[120px] font-mono"
                      >
                        <option value="System">System</option>
                        <option value="Light">Light</option>
                        <option value="Dark">Dark</option>
                      </select>
                    </div>

                    {/* Section 2: Light Theme customizer */}
                    <div>
                      <h4 className="text-[10px] font-bold text-textMuted uppercase font-mono tracking-wider mb-2">Light Theme</h4>
                      <div className="bg-appBg border border-[var(--border-app)] rounded p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--border-app)]/40 pb-2.5">
                          <span className="font-semibold text-textMuted">Preset</span>
                          <select 
                            value={lightPreset}
                            onChange={e => handleLightPresetChange(e.target.value)}
                            className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none font-mono text-[10px]"
                          >
                            <option value="Default Light">Default Light</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between border-b border-[var(--border-app)]/40 pb-2.5">
                          <span className="font-semibold text-textMuted">Background</span>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={lightBg}
                              onChange={e => { setLightBg(e.target.value); setLightPreset('Custom'); }}
                              className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                            />
                            <span className="text-[10px] font-mono text-textMuted uppercase">{lightBg}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-b border-[var(--border-app)]/40 pb-2.5">
                          <span className="font-semibold text-textMuted">Foreground</span>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={lightFg}
                              onChange={e => { setLightFg(e.target.value); setLightPreset('Custom'); }}
                              className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                            />
                            <span className="text-[10px] font-mono text-textMuted uppercase">{lightFg}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-textMuted">Accent</span>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={lightAccent}
                              onChange={e => { setLightAccent(e.target.value); setLightPreset('Custom'); }}
                              className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                            />
                            <span className="text-[10px] font-mono text-textMuted uppercase">{lightAccent}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Dark Theme customizer */}
                    <div>
                      <h4 className="text-[10px] font-bold text-textMuted uppercase font-mono tracking-wider mb-2">Dark Theme</h4>
                      <div className="bg-appBg border border-[var(--border-app)] rounded p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-[var(--border-app)]/40 pb-2.5">
                          <span className="font-semibold text-textMuted">Preset</span>
                          <select 
                            value={darkPreset}
                            onChange={e => handleDarkPresetChange(e.target.value)}
                            className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain focus:outline-none font-mono text-[10px]"
                          >
                            <option value="Default Dark">Default Dark</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between border-b border-[var(--border-app)]/40 pb-2.5">
                          <span className="font-semibold text-textMuted">Background</span>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={darkBg}
                              onChange={e => { setDarkBg(e.target.value); setDarkPreset('Custom'); }}
                              className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                            />
                            <span className="text-[10px] font-mono text-textMuted uppercase">{darkBg}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-b border-[var(--border-app)]/40 pb-2.5">
                          <span className="font-semibold text-textMuted">Foreground</span>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={darkFg}
                              onChange={e => { setDarkFg(e.target.value); setDarkPreset('Custom'); }}
                              className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                            />
                            <span className="text-[10px] font-mono text-textMuted uppercase">{darkFg}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-textMuted">Accent</span>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="color" 
                              value={darkAccent}
                              onChange={e => { setDarkAccent(e.target.value); setDarkPreset('Custom'); }}
                              className="w-5 h-5 bg-transparent border-0 cursor-pointer p-0 rounded-full"
                            />
                            <span className="text-[10px] font-mono text-textMuted uppercase">{darkAccent}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* 2. PROJECTOR TAB */}
                {activeSettingsTab === 'projector' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-textMain mb-1">Projector Display Aspect Ratio</h4>
                      <p className="text-[10px] text-textMuted">Select layout aspect constraints to match church projector screen grids.</p>
                    </div>

                    <div className="flex gap-2 mt-1">
                      <button 
                        type="button"
                        onClick={() => setAspectRatio('video')}
                        className={`flex-1 py-3 text-center rounded font-semibold border transition font-mono ${
                          aspectRatio === 'video' 
                          ? 'bg-brand text-white border-brand' 
                          : 'bg-appBg border border-[var(--border-app)] text-textMuted hover:text-textMain'
                        }`}
                      >
                        16:9 (Widescreen Presentation)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAspectRatio('[4/3]')}
                        className={`flex-1 py-3 text-center rounded font-semibold border transition font-mono ${
                          aspectRatio === '[4/3]' 
                          ? 'bg-brand text-white border-brand' 
                          : 'bg-appBg border border-[var(--border-app)] text-textMuted hover:text-textMain'
                        }`}
                      >
                        4:3 (Standard Monitor Preset)
                      </button>
                    </div>

                    {/* Stage Display Controls */}
                    <div className="mt-4 bg-appBg border border-[var(--border-app)] rounded p-4">
                      <h4 className="text-[10px] font-bold text-textMuted uppercase font-mono tracking-wider mb-2">Stage Display</h4>
                      <div className="flex gap-2 items-center mb-2">
                        <label className="text-[10px] text-textMuted w-36">Display target</label>
                        <select id="stage-display-index" className="p-1 bg-appPanel border border-[var(--border-app)] rounded text-textMain text-[12px]" defaultValue="auto">
                          <option value="auto">Auto (any non-primary)</option>
                          <option value="0">Primary</option>
                          <option value="1">Secondary</option>
                          <option value="2">Tertiary</option>
                        </select>
                      </div>

                      <div className="flex gap-2 mb-3">
                        <button onClick={async () => { const idx = document.getElementById('stage-display-index').value; await window.api.openStage(idx === 'auto' ? undefined : parseInt(idx)); }} className="flex-1 py-2 bg-brand text-white rounded text-xs">Open Stage Window</button>
                        <button onClick={async () => { await window.api.closeStage(); }} className="flex-1 py-2 bg-appPanel border border-[var(--border-app)] rounded text-xs">Close Stage Window</button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-[10px] text-textMuted w-36">Left column width</label>
                        <input type="range" min="20" max="80" defaultValue={useStageLayoutStore.getState().stageLayout.leftWidthPct || 60} onChange={(e) => { const v = parseFloat(e.target.value); useStageLayoutStore.getState().setLeftWidthPct(v); }} />
                        <span className="text-[11px] font-mono ml-2">{useStageLayoutStore.getState().stageLayout.leftWidthPct}%</span>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={async () => { const res = await window.stageServer.start(5174); if (res && res.url) { alert('Stage server running: ' + res.url); } }} className="flex-1 py-2 bg-emerald-600 text-white rounded text-xs">Start Stage Server</button>
                        <button onClick={async () => { await window.stageServer.stop(); alert('Stage server stopped'); }} className="flex-1 py-2 bg-appPanel border border-[var(--border-app)] rounded text-xs">Stop Server</button>
                      </div>

                      <div className="text-[10px] text-textMuted mt-2">Note: Stage window will render exact slide text & styling. Use the left width slider to tune default layout.</div>
                    </div>
                  </div>
                )}

                {/* 3. UPDATES TAB */}
                {activeSettingsTab === 'updates' && (
                  <div className="space-y-4 font-sans">
                    <div>
                      <h4 className="text-xs font-bold text-textMain mb-1">Check for Updates</h4>
                      <p className="text-[10px] text-textMuted font-sans">Keep your WorshipFlow application up to date with the latest features and bug fixes.</p>
                    </div>

                    <div className="bg-appBg border border-[var(--border-app)] rounded p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-textMain block">WorshipFlow App</span>
                          <span className="text-[10px] text-textMuted font-mono">Current Version: v{appVersion}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCheckForUpdates}
                          disabled={checkingUpdates || updating}
                          className="px-4 py-2 bg-[#1E4E79] hover:bg-[#1E4E79]/85 text-white font-bold rounded text-xs transition"
                        >
                          {checkingUpdates ? 'Checking...' : 'Check for Updates'}
                        </button>
                      </div>

                      {updateInfo && (
                        <div className="border-t border-[var(--border-app)]/50 pt-3 space-y-3">
                          {updateInfo.hasUpdate ? (
                            <>
                              <div className="bg-[#10B981]/10 border border-[#10B981]/30 p-3 rounded text-[#10B981] flex flex-col gap-1">
                                <span className="font-bold text-xs">Update Available: v{updateInfo.latestVersion}</span>
                                <span className="text-[10px]">A newer version of WorshipFlow has been found.</span>
                              </div>
                              
                              {updateInfo.notes && (
                                <div className="space-y-1">
                                  <span className="font-bold text-textMuted text-[10px] uppercase font-mono block">Release Notes</span>
                                  <div className="bg-appPanel border border-[var(--border-app)] p-3 rounded max-h-[150px] overflow-y-auto font-mono text-[10px] text-textMain whitespace-pre-wrap leading-normal">
                                    {updateInfo.notes}
                                  </div>
                                </div>
                              )}

                              {updating ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-textMuted">Downloading installer...</span>
                                    <span className="font-mono text-brand font-bold">{updateProgress}%</span>
                                  </div>
                                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-[var(--border-app)]">
                                    <div 
                                      className="bg-brand h-2 rounded-full transition-all duration-150" 
                                      style={{ width: `${updateProgress}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleInstallUpdate}
                                  disabled={!updateInfo.downloadUrl}
                                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition"
                                >
                                  Download & Install Update
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="bg-[#1E293B] border border-[var(--border-app)] p-3 rounded text-textMuted text-center font-medium">
                              WorshipFlow is up to date! (v{appVersion} is the latest version)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. SONG LIBRARY TAB */}
                {activeSettingsTab === 'songlibrary' && (
                  <div className="space-y-4 font-sans">
                    <div>
                      <h4 className="text-xs font-bold text-textMain mb-1">Song Library</h4>
                      <p className="text-[10px] text-textMuted">Export your song library to a file for backup or to transfer to another computer via USB drive.</p>
                    </div>

                    <div className="bg-appBg border border-[var(--border-app)] rounded p-4 space-y-3">
                      <div>
                        <span className="font-bold text-textMain block text-xs">Export Song Library</span>
                        <span className="text-[10px] text-textMuted block mt-0.5">Saves all your songs to a <code className="font-mono">.wfl-songs</code> file. Copy this file to a USB drive to transfer songs to another laptop.</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.api?.exportSongs) return;
                          const res = await window.api.exportSongs();
                          if (res?.success) alert(`✅ Exported ${res.count} songs to:\n${res.filePath}`);
                          else if (!res?.canceled) alert('Export failed: ' + (res?.error || 'Unknown error'));
                        }}
                        className="w-full py-2.5 bg-brand hover:bg-brand/80 text-white font-bold rounded text-xs transition"
                      >
                        Export Songs (.wfl-songs)
                      </button>
                    </div>

                    <div className="bg-appBg border border-[var(--border-app)] rounded p-4 space-y-3">
                      <div>
                        <span className="font-bold text-textMain block text-xs">Import Song Library</span>
                        <span className="text-[10px] text-textMuted block mt-0.5">Load songs from a <code className="font-mono">.wfl-songs</code> file. Imported songs are merged into your existing library — nothing is deleted.</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.api?.importSongs) return;
                          const res = await window.api.importSongs();
                          if (res?.success) { await fetchSongs(); alert(`✅ Imported ${res.count} songs into your library!`); }
                          else if (!res?.canceled) alert('Import failed: ' + (res?.error || 'Unknown error'));
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition"
                      >
                        Import Songs from File
                      </button>
                    </div>

                    <div className="bg-appBg border border-[var(--border-app)] rounded p-3">
                      <p className="text-[10px] text-textMuted leading-relaxed">
                        💡 <strong className="text-textMain">How to transfer songs to another laptop:</strong><br/>
                        1. Click <em>Export Songs</em> and save the file to a USB drive.<br/>
                        2. On the other laptop, open WorshipFlow → Settings → Song Library.<br/>
                        3. Click <em>Import Songs from File</em> and select the file from the USB drive.<br/>
                        4. All songs will appear in the Song Library instantly.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="p-3 border-t border-[var(--border-app)] flex justify-end bg-appPanel">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 bg-brand text-white font-bold rounded hover:bg-brand/80 transition text-xs font-mono"
              >
                Apply & Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Context Menu for deleting songs */}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed bg-appPanel border border-[var(--border-app)] rounded-md shadow-2xl py-1.5 z-[999] min-w-[120px] font-sans"
        >
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this song?')) {
                deleteSong(contextMenu.songId);
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-liveDanger/10 hover:text-red-400 font-medium transition flex items-center gap-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Song
          </button>
        </div>
      )}
    </div>
  );
}

let root = window._operatorRoot;
if (!root) {
  root = ReactDOM.createRoot(document.getElementById('root'));
  window._operatorRoot = root;
}
root.render(
  <React.StrictMode>
    <OperatorDashboard />
  </React.StrictMode>
);
