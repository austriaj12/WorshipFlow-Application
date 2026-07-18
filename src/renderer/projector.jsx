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

  // Double buffering video states
  const [videoA, setVideoA] = useState({ src: '', active: false, opacity: 0 });
  const [videoB, setVideoB] = useState({ src: '', active: false, opacity: 0 });
  const [activeImage, setActiveImage] = useState('');
  
  const videoRefA = React.useRef(null);
  const videoRefB = React.useRef(null);

  // Single-fire background asset sync effect with double buffering preloading logic
  useEffect(() => {
    const targetBg = slide.blackout ? '' : (slide.bgAsset || '');
    const isVid = /\.(mp4|webm|mov|avi)($|\?)/i.test(targetBg);
    
    if (slide.blackout || !targetBg) {
      setVideoA({ src: '', active: false, opacity: 0 });
      setVideoB({ src: '', active: false, opacity: 0 });
      setActiveImage('');
      return;
    }

    if (!isVid) {
      // It's an image or other static asset: clear/unload videos, set image
      setVideoA({ src: '', active: false, opacity: 0 });
      setVideoB({ src: '', active: false, opacity: 0 });
      setActiveImage(targetBg);
      if (videoRefA.current) videoRefA.current.pause();
      if (videoRefB.current) videoRefB.current.pause();
      return;
    }

    // It's a video. Determine which buffer to load.
    // If Video A is currently active/visible, load into B. Otherwise load into A.
    setActiveImage('');
    const useB = videoA.active || videoA.opacity > 0;

    if (useB) {
      if (videoB.src !== targetBg) {
        setVideoB({ src: targetBg, active: false, opacity: 0 });
      } else {
        // Already loaded or loading in B, force activate
        setVideoB(prev => ({ ...prev, active: true, opacity: 1 }));
        setVideoA(prev => ({ ...prev, active: false, opacity: 0 }));
        if (videoRefA.current) videoRefA.current.pause();
        if (videoRefB.current) {
          videoRefB.current.play().catch(() => {});
        }
      }
    } else {
      if (videoA.src !== targetBg) {
        setVideoA({ src: targetBg, active: false, opacity: 0 });
      } else {
        // Already loaded or loading in A, force activate
        setVideoA(prev => ({ ...prev, active: true, opacity: 1 }));
        setVideoB(prev => ({ ...prev, active: false, opacity: 0 }));
        if (videoRefB.current) videoRefB.current.pause();
        if (videoRefA.current) {
          videoRefA.current.play().catch(() => {});
        }
      }
    }
  }, [slide.bgAsset, slide.blackout]);

  // Sync playback attributes on active/inactive video elements
  useEffect(() => {
    const applyVideoState = (videoEl, isCurrentActive) => {
      if (!videoEl) return;
      videoEl.loop = !!slide.mediaLoop;
      videoEl.volume = (slide.mediaVolume !== undefined ? slide.mediaVolume : 100) / 100;
      if (isCurrentActive && slide.mediaPlaying) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    };
    applyVideoState(videoRefA.current, videoA.active);
    applyVideoState(videoRefB.current, videoB.active);
  }, [slide.mediaPlaying, slide.mediaLoop, slide.mediaVolume, videoA.active, videoB.active, videoA.src, videoB.src]);

  // Sync audio tag directly if applicable
  useEffect(() => {
    const audioEl = document.getElementById('projector-audio');
    if (audioEl) {
      audioEl.loop = !!slide.mediaLoop;
      audioEl.volume = (slide.mediaVolume !== undefined ? slide.mediaVolume : 100) / 100;
      if (slide.mediaPlaying) {
        audioEl.play().catch(() => {});
      } else {
        audioEl.pause();
      }
    }
  }, [slide.mediaPlaying, slide.mediaLoop, slide.mediaVolume, slide.bgAsset]);

  const handleVideoCanPlay = (bufferName) => {
    if (bufferName === 'A') {
      setVideoA(prev => ({ ...prev, active: true, opacity: 1 }));
      setVideoB(prev => ({ ...prev, active: false, opacity: 0 }));
      if (videoRefB.current) videoRefB.current.pause();
      if (videoRefA.current && slide.mediaPlaying) {
        videoRefA.current.play().catch(() => {});
      }
    } else {
      setVideoB(prev => ({ ...prev, active: true, opacity: 1 }));
      setVideoA(prev => ({ ...prev, active: false, opacity: 0 }));
      if (videoRefA.current) videoRefA.current.pause();
      if (videoRefB.current && slide.mediaPlaying) {
        videoRefB.current.play().catch(() => {});
      }
    }
  };

  const parseSpeedToMs = (speedStr) => {
    if (!speedStr) return 600;
    const match = speedStr.match(/(\d+(\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]) * 1000;
    }
    return 600;
  };

  useEffect(() => {
    if (window.api) {
      window.api.onSlideRender((slideData) => {
        const currentSlide = slideRef.current;

        if (
          currentSlide.text === slideData.text &&
          currentSlide.label === slideData.label &&
          currentSlide.blackout === slideData.blackout &&
          currentSlide.clearLyrics === slideData.clearLyrics &&
          currentSlide.bgAsset === slideData.bgAsset
        ) {
          setSlide(slideData);
          return;
        }

        // Determine if this slide transition is set to manual 'fade'
        const isFadeForced = slideData.transitionToNext === 'fade';
        const speedStr = (slideData.style && slideData.style.speed) || 'Medium (0.6s)';
        const anim = (slideData.style && slideData.style.animation) || 'Zoom In/Out';

        if (!isFadeForced) {
          // If no transition has been explicitly added, make it instant
          setSlide(slideData);
          setIsFading(false);
          return;
        }

        // Trigger smooth fade transition
        setIsFading(true);
        
        // Immediately sync the background asset so it doesn't lag/revert
        setSlide(prev => ({
          ...prev,
          bgAsset: slideData.bgAsset,
          blackout: slideData.blackout,
          mediaPlaying: slideData.mediaPlaying,
          mediaLoop: slideData.mediaLoop,
          mediaVolume: slideData.mediaVolume
        }));

        const speedMs = parseSpeedToMs(speedStr) / 2;
        setTimeout(() => {
          setSlide(slideData);
          setIsFading(false);
        }, speedMs);
      });
    }
  }, []);

  const getLyricsContainerStyle = () => {
    if (!slide.style) return { fontWeight: 'bold', fontSize: '64px', whiteSpace: 'pre-wrap' };
    const baseSize = slide.style.size || 90;
    const fontVal = slide.style.font || 'Inter';
    const colorVal = slide.style.color || '#ffffff';
    
    const weightMap = {
      'normal': 400,
      'semibold': 600,
      'bold': 700,
      'extrabold': 800
    };
    const weightVal = weightMap[slide.style.weight] || slide.style.weight || 700;
    
    return {
      fontFamily: `'${fontVal}', sans-serif`,
      fontSize: `${baseSize}px`,
      fontWeight: weightVal,
      color: colorVal,
      textAlign: slide.style.align || 'center',
      lineHeight: slide.style.lineHeight || 1.4,
      letterSpacing: `${slide.style.letterSpacing || 0}px`,
      whiteSpace: 'pre-wrap',
      willChange: 'transform, opacity',
      transform: 'translate3d(0,0,0)'
    };
  };

  const getOverlayPillStyle = () => {
    if (!slide.style) return {};
    const hex = slide.style.bgColor || '#000000';
    const opacityStr = slide.style.bgOpacity || '0%';
    const opacity = parseInt(opacityStr) || 0;
    if (opacity === 0) return { backgroundColor: 'transparent' };
    
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    const radius = slide.style.bgRadius !== undefined ? slide.style.bgRadius : 8;
    const paddingX = slide.style.bgPaddingX !== undefined ? slide.style.bgPaddingX : 48;
    const paddingY = slide.style.bgPaddingY !== undefined ? slide.style.bgPaddingY : 24;

    const baseStyle = {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity / 100})`,
      borderRadius: `${radius}px`,
      padding: `${paddingY}px ${paddingX}px`,
      willChange: 'transform, opacity',
      transform: 'translate3d(0,0,0)'
    };
    
    if (slide.style.bgWidth) {
      baseStyle.width = typeof slide.style.bgWidth === 'number' || !slide.style.bgWidth.toString().endsWith('%') 
        ? `${slide.style.bgWidth}%` 
        : slide.style.bgWidth;
    }
    if (slide.style.bgHeight) {
      baseStyle.height = typeof slide.style.bgHeight === 'number' || !slide.style.bgHeight.toString().endsWith('%') 
        ? `${slide.style.bgHeight}%` 
        : slide.style.bgHeight;
      baseStyle.display = 'flex';
      baseStyle.flexDirection = 'column';
      baseStyle.justifyContent = 'center';
      baseStyle.alignItems = 'center';
    }
    
    return baseStyle;
  };

  const getTransitionDuration = () => {
    if (!slide.style || !slide.style.speed) return '300ms';
    const totalMs = parseSpeedToMs(slide.style.speed);
    return `${totalMs / 2}ms`;
  };

  const isBgColor = (bg) => {
    if (!bg) return false;
    return bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl');
  };

  const getAnimationStyles = () => {
    const anim = slide.style?.animation || 'Zoom In/Out';
    const slideDuration = anim === 'Instant' ? '0ms' : getTransitionDuration();
    const opacityDuration = isClearLyricsToggling ? '150ms' : slideDuration;
    const transformDuration = slideDuration;
    
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
    
    return {
      transition: anim === 'Instant' ? 'none' : `opacity ${opacityDuration} ease-in-out, transform ${transformDuration} ease-in-out`,
      opacity: (slide.clearLyrics || isFading) ? 0 : 1,
      transform: transformVal,
      willChange: 'transform, opacity',
      width: '100%',
      maxWidth: '1760px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
    };
  };

  const bgOpacityVal = 1.0;

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative flex items-center justify-center">
      {/* Double Buffering Video Layers with will-change GPU Layer Promotion */}
      {videoA.src && (
        <div 
          className="absolute inset-x-0 w-full"
          style={{
            height: '100%',
            top: '50%',
            transform: 'translate3d(0, -50%, 0)',
            zIndex: 1,
            transition: 'opacity 500ms ease-in-out',
            opacity: videoA.opacity,
            willChange: 'opacity'
          }}
        >
          <video 
            ref={videoRefA}
            src={videoA.src} 
            preload="auto"
            muted={slide.mediaPlaying !== undefined ? false : true}
            playsInline 
            onCanPlayThrough={() => handleVideoCanPlay('A')}
            onLoadedData={() => handleVideoCanPlay('A')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', willChange: 'transform', transform: 'translate3d(0,0,0)' }} 
          />
        </div>
      )}

      {videoB.src && (
        <div 
          className="absolute inset-x-0 w-full"
          style={{
            height: '100%',
            top: '50%',
            transform: 'translate3d(0, -50%, 0)',
            zIndex: 2,
            transition: 'opacity 500ms ease-in-out',
            opacity: videoB.opacity,
            willChange: 'opacity'
          }}
        >
          <video 
            ref={videoRefB}
            src={videoB.src} 
            preload="auto"
            muted={slide.mediaPlaying !== undefined ? false : true}
            playsInline 
            onCanPlayThrough={() => handleVideoCanPlay('B')}
            onLoadedData={() => handleVideoCanPlay('B')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', willChange: 'transform', transform: 'translate3d(0,0,0)' }} 
          />
        </div>
      )}

      {/* Image Layer */}
      {activeImage && (
        <div 
          className="absolute inset-x-0 w-full z-3"
          style={{
            height: '100%',
            top: '50%',
            transform: 'translate3d(0, -50%, 0)'
          }}
        >
          <img 
            src={activeImage} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: bgOpacityVal }} 
            alt="WorshipFlow Background" 
          />
        </div>
      )}

      {/* 2.5 Solid Color Background Layer */}
      {((slide.bgAsset && isBgColor(slide.bgAsset)) || (slide.style?.background && isBgColor(slide.style.background))) && !slide.blackout && (
        <div 
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: slide.bgAsset && isBgColor(slide.bgAsset) ? slide.bgAsset : slide.style?.background || '#000000',
            zIndex: 10
          }}
        />
      )}

      {/* 3. Audio Layer (Pushes audio playback to projector window when track active) */}
      {activeBgAsset && getMediaType(activeBgAsset) === 'audio' && (
        <audio 
          id="projector-audio"
          src={activeBgAsset} 
          autoPlay 
          style={{ display: 'none' }} 
        />
      )}

      {/* 3. Gradient Dimming Overlay (Removed to show full-brightness backgrounds) */}

      <div 
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          backgroundColor: slide.bgAsset && !slide.blackout && isBgColor(slide.bgAsset) ? slide.bgAsset : 'transparent',
          position: 'relative',
          overflow: 'hidden',
          zIndex: 30
        }}
        className="select-none font-sans"
      >
        {/* Top Left Reference Label (Removed, now rendered inline above text) */}

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
                  className="tracking-wide leading-relaxed uppercase projector-text-shadow"
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
