import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const getMediaType = (url) => {
  if (!url) return 'unknown';
  const cleanUrl = url.toLowerCase().split('?')[0];
  if (/\.(mp4|webm|mov|avi)$/i.test(cleanUrl)) return 'video';
  if (/\.(jpg|jpeg|png|webp|gif)$/i.test(cleanUrl)) return 'image';
  if (/\.(mp3|wav|m4a|aac|ogg)$/i.test(cleanUrl)) return 'audio';
  return 'unknown';
};

const formatBgPath = (pathStr) => {
  if (!pathStr) return '';
  let str = pathStr.toString().trim();
  if (str.startsWith('#') || str.startsWith('rgb') || str.startsWith('hsl') || str === 'transparent') {
    return str;
  }
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('worshipflow-asset://')) {
    return str;
  }
  while (str.toLowerCase().startsWith('file:/')) {
    str = str.replace(/^file:\/+/i, '');
  }
  const cleanPath = str.replace(/\\/g, '/');
  return `file:///${cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath}`;
};

function ProjectorScreen() {
  const [slide, setSlide] = useState({
    text: '',
    label: '',
    bgAsset: '',
    style: null,
    isBible: false,
    blackout: false,
    clearLyrics: false
  });

  // State to drive smooth opacity transitions (crossfades) on text updates
  const [isFading, setIsFading] = useState(false);

  // Track clearLyrics state to apply fast transitions on hide/show toggles
  const [prevClearLyrics, setPrevClearLyrics] = useState(false);
  const [isClearLyricsToggling, setIsClearLyricsToggling] = useState(false);

  // Background transition states
  const [prevBgAsset, setPrevBgAsset] = useState('');
  const [activeBgAsset, setActiveBgAsset] = useState('');
  const [bgTransitioning, setBgTransitioning] = useState(false);

  const [scale, setScale] = useState(1);

  // Keep a ref of current slide to prevent stale closure comparison
  const slideRef = React.useRef(slide);
  useEffect(() => {
    slideRef.current = slide;
  }, [slide]);

  // Handle clearLyrics toggle transitions
  useEffect(() => {
    if (slide.clearLyrics !== prevClearLyrics) {
      setIsClearLyricsToggling(true);
      setPrevClearLyrics(slide.clearLyrics);
      const timer = setTimeout(() => {
        setIsClearLyricsToggling(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [slide.clearLyrics, prevClearLyrics]);

  useEffect(() => {
    const handleResize = () => {
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      setScale(Math.min(scaleX, scaleY));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Background rendering states
  const [currentBg, setCurrentBg] = useState({ src: '', type: 'none' });
  const [prevBg, setPrevBg] = useState({ src: '', type: 'none' });
  const [isCrossfading, setIsCrossfading] = useState(false);

  const currentVideoRef = React.useRef(null);
  const prevVideoRef = React.useRef(null);

  // Deterministic background asset manager effect
  useEffect(() => {
    const rawBg = slide.blackout ? '' : (slide.bgAsset || '');
    if (slide.blackout || !rawBg) {
      setCurrentBg({ src: '', type: 'none' });
      setPrevBg({ src: '', type: 'none' });
      return;
    }

    const formatted = formatBgPath(rawBg);
    const type = isBgColor(rawBg) ? 'color' : (/\.(mp4|webm|mov|avi)($|\?)/i.test(rawBg) ? 'video' : 'image');

    setCurrentBg(prev => {
      // If the current background asset and type are ALREADY identical, return unchanged state!
      if (prev.src === formatted && prev.type === type) {
        return prev;
      }

      const isFade = slide.transitionToNext === 'fade';
      if (isFade && prev.src) {
        setPrevBg(prev);
        setIsCrossfading(true);
        setTimeout(() => {
          setIsCrossfading(false);
          setPrevBg({ src: '', type: 'none' });
        }, 2200);
      } else {
        setPrevBg({ src: '', type: 'none' });
        setIsCrossfading(false);
      }

      return { src: formatted, type };
    });
  }, [slide.bgAsset, slide.blackout, slide.transitionToNext]);

  // Sync playback attributes on active video element
  useEffect(() => {
    if (currentVideoRef.current && currentBg.type === 'video') {
      currentVideoRef.current.loop = !!slide.mediaLoop;
      currentVideoRef.current.volume = (slide.mediaVolume !== undefined ? slide.mediaVolume : 100) / 100;
      if (slide.mediaPlaying !== false) {
        currentVideoRef.current.play().catch(() => {});
      } else {
        currentVideoRef.current.pause();
      }
    }
  }, [slide.mediaPlaying, slide.mediaLoop, slide.mediaVolume, currentBg.src, currentBg.type]);

  const parseSpeedToMs = (speedStr) => {
    if (!speedStr) return 600;
    const match = speedStr.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) * 1000 : 600;
  };

  const textAnimTimeoutRef = React.useRef(null);

  const handleIncomingSlide = (slideData) => {
    if (!slideData) return;

    const current = slideRef.current;
    const isNewSlide = current.text !== slideData.text || 
                       current.label !== slideData.label || 
                       current.bgAsset !== slideData.bgAsset;

    if (!isNewSlide) {
      setSlide(slideData);
      return;
    }

    const anim = slideData.style?.animation || 'Zoom In/Out';
    if (anim === 'Instant' || anim === 'None') {
      if (textAnimTimeoutRef.current) clearTimeout(textAnimTimeoutRef.current);
      setSlide(slideData);
      setIsFading(false);
      return;
    }

    const totalMs = parseSpeedToMs(slideData.style?.speed);
    const halfMs = Math.max(40, totalMs / 2);

    if (textAnimTimeoutRef.current) clearTimeout(textAnimTimeoutRef.current);

    // Phase 1: Current text slide plays exit transition
    setIsFading(true);

    // Phase 2: After exit transition finishes (opacity is 0), switch to new slide text and play entrance transition
    textAnimTimeoutRef.current = setTimeout(() => {
      setSlide(slideData);
      setIsFading(false);
    }, halfMs);
  };

  useEffect(() => {
    // 1. Electron IPC Listener
    if (window.api && window.api.onSlideRender) {
      window.api.onSlideRender(handleIncomingSlide);
    }

    // 2. BroadcastChannel Listener (For browser tabs & popouts)
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('worshipflow-slide-channel');
      bc.onmessage = (event) => {
        if (event.data) {
          handleIncomingSlide(event.data);
        }
      };
    }

    // 3. StorageEvent Listener
    const handleStorage = (e) => {
      if (e.key === 'worshipflow-current-slide' && e.newValue) {
        try {
          handleIncomingSlide(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Initial check from localStorage if present
    try {
      const saved = localStorage.getItem('worshipflow-current-slide');
      if (saved) {
        handleIncomingSlide(JSON.parse(saved));
      }
    } catch (e) {}

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const getLyricsContainerStyle = () => {
    if (!slide.style) return { fontWeight: 'bold', fontSize: '90px', whiteSpace: 'pre-wrap' };
    const baseSize = slide.style.size || 90;
    const fontVal = slide.style.font || 'Inter';
    const colorVal = slide.style.color || '#ffffff';

    const weightMap = { 'normal': 400, 'semibold': 600, 'bold': 700, 'extrabold': 800 };
    const baseStyle = {
      fontFamily: `'${fontVal}', sans-serif`,
      fontSize: `${baseSize}px`,
      fontWeight: weightMap[slide.style.weight] || slide.style.weight || 700,
      lineHeight: slide.style.lineHeight || 1.4,
      letterSpacing: `${slide.style.letterSpacing || 0}px`,
      color: colorVal,
      textAlign: slide.style.align || 'center',
      whiteSpace: 'pre-wrap',
      wordBreak: 'keep-all',
      overflowWrap: 'break-word',
      margin: 0,
      padding: 0
    };

    if (slide.style.bgOpacity && slide.style.bgOpacity > 0) {
      const hex = slide.style.bgColor || '#000000';
      const alpha = slide.style.bgOpacity;
      let r = 0, g = 0, b = 0;
      if (hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      }
      const rgbaBg = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      const radiusVal = slide.style.bgRadius !== undefined ? slide.style.bgRadius : 12;
      const bgW = slide.style.bgWidth !== undefined ? slide.style.bgWidth : 100;
      const bgH = slide.style.bgHeight !== undefined ? slide.style.bgHeight : 100;
      const formattedW = typeof bgW === 'number' || !bgW.toString().endsWith('%') ? `${bgW}%` : bgW;
      const formattedH = typeof bgH === 'number' || !bgH.toString().endsWith('%') ? `${bgH}%` : bgH;

      return {
        ...baseStyle,
        backgroundColor: rgbaBg,
        borderRadius: `${radiusVal}px`,
        width: formattedW,
        height: formattedH,
        padding: '0.4em 0.8em',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: slide.style.vertical === 'top' ? 'flex-start' : slide.style.vertical === 'bottom' ? 'flex-end' : 'center',
        alignItems: slide.style.align === 'left' ? 'flex-start' : slide.style.align === 'right' ? 'flex-end' : 'center'
      };
    }
    return baseStyle;
  };

  const isBgColor = (bg) => {
    if (!bg) return false;
    return bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl');
  };

  const getOverlayPillStyle = () => {
    if (!slide.style) return {};
    const hex = slide.style.bgColor || '#000000';
    const opacityStr = slide.style.bgOpacity !== undefined ? slide.style.bgOpacity : '0%';
    const opacity = typeof opacityStr === 'number' ? opacityStr : (parseInt(opacityStr) || 0);
    if (opacity === 0) return { backgroundColor: 'transparent' };
    
    let r = 0, g = 0, b = 0;
    if (typeof hex === 'string' && hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16) || 0;
      g = parseInt(hex.slice(3, 5), 16) || 0;
      b = parseInt(hex.slice(5, 7), 16) || 0;
    }
    
    const radius = slide.style.bgRadius !== undefined ? slide.style.bgRadius : 12;

    const baseStyle = {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity > 1 ? opacity / 100 : opacity})`,
      borderRadius: `${radius}px`,
      padding: '0.4em 0.8em',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: slide.style.vertical === 'top' ? 'flex-start' : slide.style.vertical === 'bottom' ? 'flex-end' : 'center',
      alignItems: slide.style.align === 'left' ? 'flex-start' : slide.style.align === 'right' ? 'flex-end' : 'center'
    };
    
    if (slide.style.bgWidth !== undefined) {
      baseStyle.width = typeof slide.style.bgWidth === 'number' || !slide.style.bgWidth.toString().endsWith('%') 
        ? `${slide.style.bgWidth}%` 
        : slide.style.bgWidth;
    }
    if (slide.style.bgHeight !== undefined) {
      baseStyle.height = typeof slide.style.bgHeight === 'number' || !slide.style.bgHeight.toString().endsWith('%') 
        ? `${slide.style.bgHeight}%` 
        : slide.style.bgHeight;
    }
    
    return baseStyle;
  };

  const getTransitionDuration = () => {
    if (!slide.style || !slide.style.speed) return '300ms';
    const totalMs = parseSpeedToMs(slide.style.speed);
    return `${totalMs / 2}ms`;
  };

  const getAnimationStyles = () => {
    const anim = slide.style?.animation || 'Zoom In/Out';
    const slideDuration = (anim === 'Instant' || anim === 'None') ? '0ms' : getTransitionDuration();
    const opacityDuration = isClearLyricsToggling ? '150ms' : slideDuration;
    
    let transformVal = 'translate3d(0,0,0)';
    if (anim === 'Zoom In/Out') {
      transformVal = isFading ? 'scale3d(0.96, 0.96, 1)' : 'scale3d(1, 1, 1)';
    } else if (anim === 'Slide Left') {
      transformVal = isFading ? 'translate3d(-40px, 0, 0)' : 'translate3d(0, 0, 0)';
    } else if (anim === 'Slide Right') {
      transformVal = isFading ? 'translate3d(40px, 0, 0)' : 'translate3d(0, 0, 0)';
    } else if (anim === 'Slide Up') {
      transformVal = isFading ? 'translate3d(0, 40px, 0)' : 'translate3d(0, 0, 0)';
    }

    let targetOpacity = 1;
    if (slide.clearLyrics) {
      targetOpacity = 0;
    } else if (anim === 'Fade Out') {
      targetOpacity = isFading ? 0 : 1;
    } else if (isFading) {
      targetOpacity = 0;
    }

    return {
      transition: (anim === 'Instant' || anim === 'None') ? 'none' : `opacity ${opacityDuration} ease-in-out, transform ${slideDuration} ease-in-out`,
      opacity: targetOpacity,
      transform: transformVal,
      willChange: 'transform, opacity',
      width: '96%',
      maxWidth: '1850px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
    };
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative flex items-center justify-center">
      {/* Scaled 1920x1080 Canvas Viewport */}
      <div 
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          backgroundColor: currentBg.type === 'color' ? currentBg.src : '#000000',
          position: 'relative',
          overflow: 'hidden',
          zIndex: 10
        }}
        className="select-none font-sans"
      >
        {/* Previous Background Layer (Fading Out 1 -> 0 over 2200ms) */}
        {prevBg.src && (
          <div 
            className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-10"
            style={{
              transition: 'opacity 2200ms cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: isCrossfading ? 0 : 1
            }}
          >
            {prevBg.type === 'video' && (
              <video 
                ref={prevVideoRef}
                src={prevBg.src} 
                autoPlay 
                muted={slide.mediaPlaying !== undefined ? false : true} 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            )}
            {prevBg.type === 'image' && (
              <img 
                src={prevBg.src} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                alt="" 
              />
            )}
            {prevBg.type === 'color' && (
              <div style={{ width: '100%', height: '100%', backgroundColor: prevBg.src }} />
            )}
          </div>
        )}

        {/* Current Active Background Layer (Fading In 0 -> 1 over 2200ms when crossfading) */}
        {currentBg.src && (
          <div 
            className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-20"
            style={{
              transition: slide.transitionToNext === 'fade' ? 'opacity 2200ms cubic-bezier(0.4, 0, 0.2, 1)' : 'opacity 300ms ease-in-out',
              opacity: 1
            }}
          >
            {currentBg.type === 'video' && (
              <video 
                ref={currentVideoRef}
                src={currentBg.src} 
                autoPlay 
                loop={!!slide.mediaLoop}
                muted={slide.mediaPlaying !== undefined ? false : true} 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            )}
            {currentBg.type === 'image' && (
              <img 
                src={currentBg.src} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                alt="WorshipFlow Background" 
              />
            )}
            {currentBg.type === 'color' && (
              <div style={{ width: '100%', height: '100%', backgroundColor: currentBg.src }} />
            )}
          </div>
        )}

        {/* Foreground Canvas: Text Lyrics Render Layer */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            padding: '4rem',
            boxSizing: 'border-box',
            justifyContent: slide.style?.vertical === 'top' ? 'flex-start' : slide.style?.vertical === 'bottom' ? 'flex-end' : 'center',
            alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
          }}
        >
          <div style={getAnimationStyles()}>
            {slide.isBible && slide.label && !slide.blackout && !slide.clearLyrics && (
              <div 
                style={{
                  backgroundColor: slide.style?.refColor || '#ef4444',
                  color: '#ffffff',
                  padding: '8px 24px',
                  borderRadius: '9999px',
                  fontSize: `${(slide.style?.size || 90) * 0.45}px`,
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: '24px',
                  display: 'inline-block',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}
              >
                {slide.label}
              </div>
            )}
            <div style={getOverlayPillStyle()}>
              {slide.text ? (
                <p 
                  style={getLyricsContainerStyle()}
                  className="projector-text-shadow"
                >
                  {slide.text}
                </p>
              ) : (
                /* Graceful standby/empty layout (no hardcoded slides) */
                !slide.blackout && !window.api && (
                  <p className="text-sm font-mono text-slate-700 tracking-widest uppercase text-center">
                    Awaiting connection from control panel...
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Countdown Timer Overlay Layer (renders outside 16:9 inner scale at absolute viewport bounds) */}
      {slide.countdownActive && !slide.blackout && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 35,
            backgroundColor: slide.countdownBgColor || '#000000',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            color: '#ffffff',
            padding: '60px',
            boxSizing: 'border-box'
          }}
        >
          {(slide.countdownBgMedia || slide.countdownBgAsset) && (
            <div className="absolute inset-0 z-0 overflow-hidden">
              {/\.(mp4|webm|mov|avi)($|\?)/i.test(slide.countdownBgMedia || slide.countdownBgAsset) ? (
                <video src={slide.countdownBgMedia || slide.countdownBgAsset} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={slide.countdownBgMedia || slide.countdownBgAsset} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              )}
            </div>
          )}
          <div className="z-10 flex flex-col items-center">
            <div style={{ fontSize: `${slide.countdownTitleSize || 56}px`, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '24px', fontWeight: 'bold' }}>
              {slide.countdownTitle || 'Countdown'}
            </div>
            <div style={{ fontSize: `${slide.countdownTimeSize || 180}px`, fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1, margin: '20px 0', color: slide.countdownTextColor || '#ffffff' }}>
              {slide.countdownTime || '00:00'}
            </div>
            {slide.countdownSubtext && (
              <div style={{ fontSize: `${slide.countdownSubtextSize || 36}px`, opacity: 0.6, fontStyle: 'italic', marginTop: '24px' }}>
                {slide.countdownSubtext}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Count-Up Timer Overlay Layer */}
      {slide.timerActive && !slide.blackout && !slide.countdownActive && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 34,
            backgroundColor: slide.timerBgColor || '#000000',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            color: '#ffffff',
            padding: '60px',
            boxSizing: 'border-box'
          }}
        >
          {slide.timerBgMedia && (
            <div className="absolute inset-0 z-0 overflow-hidden">
              {/\.(mp4|webm|mov|avi)($|\?)/i.test(slide.timerBgMedia) ? (
                <video src={slide.timerBgMedia} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={slide.timerBgMedia} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              )}
            </div>
          )}
          <div className="z-10 flex flex-col items-center">
            <div style={{ fontSize: `${slide.timerTitleSize || 56}px`, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '24px', fontWeight: 'bold' }}>
              {slide.timerTitle || 'Timer'}
            </div>
            <div style={{ fontSize: `${slide.timerTimeSize || 180}px`, fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1, margin: '20px 0', color: slide.timerTextColor || '#ffffff' }}>
              {slide.timerTime || '00:00'}
            </div>
          </div>
        </div>
      )}

      {/* Blackout Layer: Emergency black overlay (renders outside 16:9 scale) */}
      <div 
        className={`absolute inset-0 bg-black z-40 transition-opacity duration-300 ease-in-out ${
          slide.blackout ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      ></div>
    </div>
  );
}

let root = window._projectorRoot;
if (!root) {
  root = ReactDOM.createRoot(document.getElementById('root'));
  window._projectorRoot = root;
}
root.render(
  <React.StrictMode>
    <ProjectorScreen />
  </React.StrictMode>
);
