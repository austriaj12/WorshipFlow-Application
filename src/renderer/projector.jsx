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

  // Background transition states
  const [prevBgAsset, setPrevBgAsset] = useState('');
  const [activeBgAsset, setActiveBgAsset] = useState('');
  const [bgTransitioning, setBgTransitioning] = useState(false);

  const [scale, setScale] = useState(1);

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

  // Single-fire background asset sync effect
  useEffect(() => {
    const targetBg = slide.blackout ? '' : (slide.bgAsset || '');
    if (targetBg !== activeBgAsset) {
      setPrevBgAsset(activeBgAsset);
      setActiveBgAsset(targetBg);
      setBgTransitioning(true);
      
      const timer = setTimeout(() => {
        setBgTransitioning(false);
      }, 600);
      
      return () => clearTimeout(timer);
    }
  }, [slide.bgAsset, slide.blackout]);

  // Sync media player playback state directly on HTML5 video & audio DOM tags
  useEffect(() => {
    const videoEl = document.getElementById('projector-video');
    const audioEl = document.getElementById('projector-audio');
    
    [videoEl, audioEl].forEach(mediaEl => {
      if (mediaEl) {
        mediaEl.loop = !!slide.mediaLoop;
        mediaEl.volume = (slide.mediaVolume !== undefined ? slide.mediaVolume : 100) / 100;
        if (slide.mediaPlaying) {
          mediaEl.play().catch(e => {});
        } else {
          mediaEl.pause();
        }
      }
    });
  }, [slide.mediaPlaying, slide.mediaLoop, slide.mediaVolume, activeBgAsset]);

  useEffect(() => {
    if (window.api) {
      window.api.onSlideRender((slideData) => {
        // Trigger fade out
        setIsFading(true);
        
        // Wait for fade out animation before changing text
        const speedStr = (slideData.style && slideData.style.speed) || 'Medium (0.6s)';
        const anim = (slideData.style && slideData.style.animation) || 'Zoom In/Out';
        
        let speedMs = 250; 
        if (slideData.isImportedSlide || slideData.mediaPlaying !== undefined) {
          speedMs = 0; // Snapey flip for PPT/PDF slide pages and active media assets
        } else if (anim === 'Instant') {
          speedMs = 0;
        } else if (speedStr.includes('0.3s')) {
          speedMs = 120;
        } else if (speedStr.includes('1.0s')) {
          speedMs = 450;
        }
        
        setTimeout(() => {
          setSlide(slideData);
          setIsFading(false);
        }, speedMs);
      });
    }
  }, []);

  // Translate styling parameters to inline CSS styles
  const getLyricsContainerStyle = () => {
    if (!slide.style) return { fontWeight: 'bold', fontSize: '64px', whiteSpace: 'pre-wrap' };
    
    // Dynamic styling from payload
    const baseSize = slide.style.size || 90;
    const fontVal = slide.style.font || 'Inter';
    const colorVal = slide.style.color || '#ffffff';
    
    // Strict Font Weight Map to support integer-based standard weights
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
      whiteSpace: 'pre-wrap'
    };
  };

  const getOverlayPillStyle = () => {
    if (!slide.style) return {};
    
    const hex = slide.style.bgColor || '#000000';
    const opacityStr = slide.style.bgOpacity || '0%';
    const opacity = parseInt(opacityStr) || 0;
    
    if (opacity === 0) return { backgroundColor: 'transparent' };
    
    // Convert hex to rgb
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity / 100})`,
      borderRadius: '8px',
      padding: '1.5rem 3rem'
    };
  };

  const getTransitionDuration = () => {
    if (!slide.style || !slide.style.speed) return '600ms';
    const speedStr = slide.style.speed;
    if (speedStr.includes('0.3s')) return '300ms';
    if (speedStr.includes('1.0s')) return '1000ms';
    return '600ms';
  };

  const isBgColor = (bg) => {
    if (!bg) return false;
    return bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl');
  };

  const getAnimationStyles = () => {
    const anim = slide.style?.animation || 'Zoom In/Out';
    const duration = anim === 'Instant' ? '0ms' : getTransitionDuration();
    
    let transformVal = 'none';
    if (anim === 'Zoom In/Out') {
      transformVal = isFading ? 'scale(0.96)' : 'scale(1)';
    } else if (anim === 'Slide Left') {
      transformVal = isFading ? 'translateX(-40px)' : 'translateX(0)';
    } else if (anim === 'Slide Right') {
      transformVal = isFading ? 'translateX(40px)' : 'translateX(0)';
    } else if (anim === 'Slide Up') {
      transformVal = isFading ? 'translateY(40px)' : 'translateY(0)';
    }
    
    return {
      transition: anim === 'Instant' ? 'none' : `opacity ${duration} ease-in-out, transform ${duration} ease-in-out`,
      opacity: (slide.clearLyrics || isFading) ? 0 : 1,
      transform: transformVal,
      width: '100%',
      maxWidth: '1760px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: slide.style?.align === 'left' ? 'flex-start' : slide.style?.align === 'right' ? 'flex-end' : 'center'
    };
  };

  const bgOpacityVal = (slide.isImportedSlide || slide.mediaPlaying !== undefined) ? 1.0 : 0.75;

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative flex items-center justify-center">
      {/* Viewport-level Background Media Layers: Covers 100% of display regardless of 16:9 inner window scaling */}
      {/* 1. Bottom Layer (Previous Background) */}
      {prevBgAsset && !slide.blackout && !isBgColor(prevBgAsset) && (
        <div 
          className="absolute inset-x-0 z-0 w-full"
          style={{
            height: slide.style?.bgHeight || '100%',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          {/\.(mp4|webm|mov|avi)($|\?)/i.test(prevBgAsset) ? (
            <video 
              src={prevBgAsset} 
              autoPlay 
              muted={slide.mediaPlaying !== undefined ? false : true}
              loop 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: bgOpacityVal }} 
            />
          ) : (
            <img 
              src={prevBgAsset} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: bgOpacityVal }} 
              alt="" 
            />
          )}
        </div>
      )}

      {/* 2. Top Layer (Active Background Overlay) */}
      {activeBgAsset && !slide.blackout && !isBgColor(activeBgAsset) && (
        <div 
          className={`absolute inset-x-0 z-10 w-full transition-opacity duration-700 ease-in-out ${
            bgTransitioning ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            height: slide.style?.bgHeight || '100%',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          {/\.(mp4|webm|mov|avi)($|\?)/i.test(activeBgAsset) ? (
            <video 
              id="projector-video"
              src={activeBgAsset} 
              autoPlay 
              muted={slide.mediaPlaying !== undefined ? false : true}
              loop 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: bgOpacityVal }} 
            />
          ) : (
            <img 
              src={activeBgAsset} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: bgOpacityVal }} 
              alt="WorshipFlow Background" 
            />
          )}
        </div>
      )}

      {/* 2.5 Solid Color Background Layer */}
      {((slide.bgAsset && isBgColor(slide.bgAsset)) || (slide.style?.background && isBgColor(slide.style.background))) && !slide.blackout && (
        <div 
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: slide.style?.bgHeight || '100%',
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

      {/* 3. Gradient Dimming Overlay (Kept above media, below lyrics) - Suppressed for high-quality PPTX/PDF slide graphics */}
      {!slide.blackout && !slide.isImportedSlide && ((activeBgAsset && !isBgColor(activeBgAsset)) || (prevBgAsset && !isBgColor(prevBgAsset))) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/40 to-black/55 z-20"></div>
      )}

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
        {/* Top Left Reference Label (e.g. Genesis 1:1, etc.) */}
        {slide.label && !slide.blackout && !slide.clearLyrics && slide.isBible && (
          <div 
            style={{
              position: 'absolute',
              top: '50px',
              left: '60px',
              zIndex: 40,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              textTransform: 'uppercase',
              color: '#f8fafc',
              fontSize: '32px',
              fontWeight: 800,
              letterSpacing: '0.15em',
              opacity: 0.85,
              textShadow: '0 2px 4px rgba(0,0,0,0.8)'
            }}
          >
            <span 
              style={{
                width: '8px',
                height: '32px',
                borderRadius: '999px',
                background: '#38bdf8' // Sky blue accent
              }} 
            />
            <span>{slide.label}</span>
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
          <div style={{ fontSize: `${slide.countdownTitleSize || 56}px`, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '24px', fontWeight: 'bold' }}>
            {slide.countdownTitle || 'Countdown'}
          </div>
          <div style={{ fontSize: `${slide.countdownTimeSize || 180}px`, fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1, margin: '20px 0' }}>
            {slide.countdownTime || '00:00'}
          </div>
          {slide.countdownSubtext && (
            <div style={{ fontSize: `${slide.countdownSubtextSize || 36}px`, opacity: 0.6, fontStyle: 'italic', marginTop: '24px' }}>
              {slide.countdownSubtext}
            </div>
          )}
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
          <div style={{ fontSize: `${slide.timerTitleSize || 56}px`, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '24px', fontWeight: 'bold' }}>
            {slide.timerTitle || 'Timer'}
          </div>
          <div style={{ fontSize: `${slide.timerTimeSize || 180}px`, fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1, margin: '20px 0' }}>
            {slide.timerTime || '00:00'}
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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ProjectorScreen />
  </React.StrictMode>
);
