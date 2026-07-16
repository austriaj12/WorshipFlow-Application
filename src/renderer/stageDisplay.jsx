import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function StageDisplay() {
  const [stageData, setStageData] = useState({
    text: '',
    label: '',
    bgAsset: '',
    style: null,
    blackout: false,
    clearLyrics: false,
    showClock: true,
    showSlideIndex: true,
    showNextPreview: true,
    stageTextStyle: 'Upper-case Bold',
    nextSlideText: '',
    nextSlideBg: '',
    nextSlideLabel: '',
    countdownTime: '00:00',
    isBible: false,
    stageMainFontSize: 90,
    stageUpNextFontSize: 60,
    bibleFontSize: 48,
    bibleRefColor: '#ef4444'
  });
  const [clockTime, setClockTime] = useState('');
  const rowDragState = useRef({ dragging: false, index: -1, startY: 0, startHeights: null });

  const [rowHeights, setRowHeights] = useState(() => {
    try {
      const saved = localStorage.getItem('stageLayout_rowHeights');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { top: 18, middle: 57, bottom: 25 };
  });

  const handleStartRowDrag = (index, e) => {
    e.preventDefault();
    rowDragState.current = {
      dragging: true,
      index,
      startY: e.clientY,
      startHeights: { ...rowHeights }
    };
    window.addEventListener('mousemove', handleRowDrag);
    window.addEventListener('mouseup', handleEndRowDrag);
  };

  const handleRowDrag = (e) => {
    if (!rowDragState.current.dragging) return;
    const { index, startY, startHeights } = rowDragState.current;
    const deltaY = e.clientY - startY;
    const deltaPct = (deltaY / 1080) * 100;
    let next = { ...startHeights };

    if (index === 0) {
      next.top = Math.max(10, Math.min(70, startHeights.top + deltaPct));
      next.middle = Math.max(20, 100 - next.top - startHeights.bottom);
    } else {
      next.bottom = Math.max(10, Math.min(70, startHeights.bottom - deltaPct));
      next.middle = Math.max(20, 100 - startHeights.top - next.bottom);
    }

    next.middle = Math.max(20, Math.min(80, next.middle));
    if (next.top + next.middle + next.bottom !== 100) {
      next.middle = 100 - next.top - next.bottom;
    }
    setRowHeights(next);
  };

  const handleEndRowDrag = () => {
    rowDragState.current.dragging = false;
    localStorage.setItem('stageLayout_rowHeights', JSON.stringify(rowHeights));
    window.removeEventListener('mousemove', handleRowDrag);
    window.removeEventListener('mouseup', handleEndRowDrag);
  };

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

  useEffect(() => {
    if (window.api && window.api.onStageRender) {
      window.api.onStageRender((data) => {
        setStageData((prev) => ({
          ...prev,
          text: data.text || '',
          label: data.label || '',
          bgAsset: data.bgAsset || '',
          style: data.style || null,
          blackout: !!data.blackout,
          clearLyrics: !!data.clearLyrics,
          showClock: data.showClock !== undefined ? data.showClock : prev.showClock,
          showSlideIndex: data.showSlideIndex !== undefined ? data.showSlideIndex : prev.showSlideIndex,
          showNextPreview: data.showNextPreview !== undefined ? data.showNextPreview : prev.showNextPreview,
          stageTextStyle: data.stageTextStyle || prev.stageTextStyle,
          nextSlideText: data.nextSlideText || '',
          nextSlideBg: data.nextSlideBg || '',
          nextSlideLabel: data.nextSlideLabel || '',
          countdownTime: data.countdownTime || prev.countdownTime || '00:00',
          countdownActive: data.countdownActive !== undefined ? data.countdownActive : prev.countdownActive,
          countdownTextColor: data.countdownTextColor || prev.countdownTextColor || '#ffffff',
          timerTime: data.timerTime || prev.timerTime || '00:00',
          timerActive: data.timerActive !== undefined ? data.timerActive : prev.timerActive,
          timerTextColor: data.timerTextColor || prev.timerTextColor || '#ffffff',
          topLineColor: data.topLineColor || prev.topLineColor,
          middleLineColor: data.middleLineColor || prev.middleLineColor,
          mainLineColor: data.mainLineColor || prev.mainLineColor,
          upNextLineColor: data.upNextLineColor || prev.upNextLineColor,
          isBible: data.isBible || false,
          stageMainFontSize: data.stageMainFontSize || prev.stageMainFontSize,
          stageUpNextFontSize: data.stageUpNextFontSize || prev.stageUpNextFontSize,
          bibleFontSize: data.bibleFontSize || prev.bibleFontSize,
          bibleRefColor: data.bibleRefColor || prev.bibleRefColor
        }));
      });
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'stage-update') {
            const data = message.payload;
            setStageData((prev) => ({
              ...prev,
              text: data.text || '',
              label: data.label || '',
              bgAsset: data.bgAsset || '',
              style: data.style || null,
              blackout: !!data.blackout,
              clearLyrics: !!data.clearLyrics,
              showClock: data.showClock !== undefined ? data.showClock : prev.showClock,
              showSlideIndex: data.showSlideIndex !== undefined ? data.showSlideIndex : prev.showSlideIndex,
              showNextPreview: data.showNextPreview !== undefined ? data.showNextPreview : prev.showNextPreview,
              stageTextStyle: data.stageTextStyle || prev.stageTextStyle,
              nextSlideText: data.nextSlideText || '',
              nextSlideBg: data.nextSlideBg || '',
              nextSlideLabel: data.nextSlideLabel || '',
              countdownTime: data.countdownTime || prev.countdownTime || '00:00',
              countdownActive: data.countdownActive !== undefined ? data.countdownActive : prev.countdownActive,
              countdownTextColor: data.countdownTextColor || prev.countdownTextColor || '#ffffff',
              timerTime: data.timerTime || prev.timerTime || '00:00',
              timerActive: data.timerActive !== undefined ? data.timerActive : prev.timerActive,
              timerTextColor: data.timerTextColor || prev.timerTextColor || '#ffffff',
              topLineColor: data.topLineColor || prev.topLineColor,
              middleLineColor: data.middleLineColor || prev.middleLineColor,
              mainLineColor: data.mainLineColor || prev.mainLineColor,
              upNextLineColor: data.upNextLineColor || prev.upNextLineColor,
              isBible: data.isBible || false,
              stageMainFontSize: data.stageMainFontSize || prev.stageMainFontSize,
              stageUpNextFontSize: data.stageUpNextFontSize || prev.stageUpNextFontSize,
              bibleFontSize: data.bibleFontSize || prev.bibleFontSize,
              bibleRefColor: data.bibleRefColor || prev.bibleRefColor
            }));
          }
        } catch (err) {
          console.error('Failed parsing stage WS message:', err);
        }
      };
      
      return () => ws.close();
    }
  }, []);

  useEffect(() => {
    if (!stageData.showClock) {
      setClockTime('');
      return;
    }

    const updateClock = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [stageData.showClock]);

  const [resizeTrigger, setResizeTrigger] = useState(0);
  const mainTextRef = useRef(null);
  const nextTextRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setResizeTrigger(prev => prev + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mainTextRef.current) return;
    const parent = mainTextRef.current.parentElement;
    if (!parent) return;

    const baseSize = stageData.isBible 
      ? (stageData.bibleFontSize || 48) 
      : (stageData.stageMainFontSize || 70);

    let size = baseSize;
    mainTextRef.current.style.fontSize = `${size}px`;

    const rowContainer = parent.closest('.stage-row-middle');
    if (!rowContainer) return;

    const maxAllowedHeight = rowContainer.clientHeight * 0.85;
    let iterations = 0;

    const adjustSize = () => {
      while (
        mainTextRef.current.scrollHeight > maxAllowedHeight && 
        size > 18 && 
        iterations < 30
      ) {
        size -= 2;
        mainTextRef.current.style.fontSize = `${size}px`;
        iterations++;
      }
    };
    
    adjustSize();
    requestAnimationFrame(adjustSize);
  }, [stageData.text, stageData.bibleFontSize, stageData.stageMainFontSize, stageData.isBible, rowHeights.middle, resizeTrigger]);

  useEffect(() => {
    if (!nextTextRef.current) return;
    const parent = nextTextRef.current.parentElement;
    if (!parent) return;

    const baseSize = stageData.stageUpNextFontSize || 40;
    let size = baseSize;
    nextTextRef.current.style.fontSize = `${size}px`;

    const rowContainer = parent.closest('.stage-row-bottom');
    if (!rowContainer) return;

    const maxAllowedHeight = rowContainer.clientHeight * 0.75;
    let iterations = 0;

    const adjustSize = () => {
      while (
        nextTextRef.current.scrollHeight > maxAllowedHeight && 
        size > 14 && 
        iterations < 30
      ) {
        size -= 2;
        nextTextRef.current.style.fontSize = `${size}px`;
        iterations++;
      }
    };
    
    adjustSize();
    requestAnimationFrame(adjustSize);
  }, [stageData.nextSlideText, stageData.stageUpNextFontSize, rowHeights.bottom, resizeTrigger]);

  const slideStyle = stageData.style
    ? {
        fontFamily: stageData.style.font || 'Inter',
        fontWeight: stageData.style.weight || 'bold',
        color: stageData.style.color || '#ffffff',
        textAlign: stageData.style.align || 'center',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.1
      }
    : {
        fontFamily: 'Inter',
        color: '#fff',
        textAlign: 'center',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.1
      };

  const transformText = (text) => {
    if (!text) return '';
    if (stageData.stageTextStyle === 'Upper-case Bold') {
      return text.toUpperCase();
    }
    return text;
  };

  const backgroundElement = () => {
    if (stageData.bgAsset) {
      if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(stageData.bgAsset)) {
        return (
          <video
            src={stageData.bgAsset}
            autoPlay
            muted
            loop
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        );
      }
      return (
        <img
          src={stageData.bgAsset}
          alt="stage background"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );
    }
    return null;
  };

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', color: '#fff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div 
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#000'
        }}
      >
        {/* Top Clocks Row */}
        <div style={{ height: `${rowHeights.top}%`, minHeight: '140px', display: 'flex', borderBottom: `4px solid ${stageData.topLineColor || '#334155'}`, boxSizing: 'border-box' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '72px', fontWeight: '800', fontFamily: 'Inter', borderRight: '2px solid rgba(255,255,255,0.12)' }}>
            {clockTime || '12:00:00 AM'}
          </div>
          <div style={{ flex: 1, display: 'flex', gap: '40px', alignItems: 'center', justifyContent: 'center', fontSize: '72px', fontWeight: '800', fontFamily: 'Inter', color: '#fff' }}>
            {stageData.countdownActive && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                <span style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>Countdown</span>
                <span style={{ color: stageData.countdownTextColor || '#ffffff' }}>{stageData.countdownTime || '00:00'}</span>
              </div>
            )}
            {stageData.timerActive && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, borderLeft: stageData.countdownActive ? '2px solid rgba(255,255,255,0.15)' : 'none', paddingLeft: stageData.countdownActive ? '40px' : '0' }}>
                <span style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}>Timer</span>
                <span style={{ color: stageData.timerTextColor || '#ffffff' }}>{stageData.timerTime || '00:00'}</span>
              </div>
            )}
            {!stageData.countdownActive && !stageData.timerActive && (
              <span style={{ fontSize: '32px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No Timer Active</span>
            )}
          </div>
        </div>
         <div
          onMouseDown={(e) => handleStartRowDrag(0, e)}
          style={{ height: '12px', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
        />

        {/* Middle Main Lyrics Row */}
        <div className="stage-row-middle" style={{ height: `${rowHeights.middle}%`, display: 'flex', flexDirection: 'column', borderBottom: `4px solid ${stageData.middleLineColor || '#0284c7'}`, boxSizing: 'border-box', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          {/* Render background/slide graphics only for PPT, PDF, or Media loops (suppressed for song lyrics) */}
          {!stageData.blackout && !stageData.text && stageData.bgAsset && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
              {/\.(mp4|webm|mov|avi)(\?|$)/i.test(stageData.bgAsset) ? (
                <video
                  src={stageData.bgAsset}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <img
                  src={stageData.bgAsset}
                  alt="Current Slide"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
            </div>
          )}

          <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'inline-flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', color: '#f8fafc', fontSize: '18px', fontWeight: 800, letterSpacing: '0.2em', zIndex: 10 }}>
            <span style={{ width: '10px', height: '28px', borderRadius: '999px', background: stageData.mainLineColor || '#7dd3fc' }} />
            <span>{stageData.label ? stageData.label.toUpperCase() : 'MAIN'}</span>
          </div>

          <div style={{ display: 'flex', flex: 1, width: '100%', minHeight: 0, marginTop: '10px', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            {stageData.text ? (
              <div style={{ width: '100%', textAlign: slideStyle.textAlign, maxWidth: '100%' }}>
                {stageData.isBible && stageData.label && !stageData.blackout && !stageData.clearLyrics && (
                  <div 
                    style={{
                      backgroundColor: stageData.bibleRefColor || '#ef4444',
                      color: '#ffffff',
                      padding: '6px 18px',
                      borderRadius: '9999px',
                      fontSize: `${stageData.bibleFontSize * 0.45}px`,
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: '16px',
                      display: 'inline-block',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    {stageData.label}
                  </div>
                )}
                <div ref={mainTextRef} style={{ ...slideStyle, lineHeight: 1.1 }} className="projector-text-shadow">
                  {transformText(stageData.text)}
                </div>
              </div>
            ) : (
              /* Clear text layout when showing visual slides or media */
              null
            )}
          </div>
        </div>
         <div
          onMouseDown={(e) => handleStartRowDrag(1, e)}
          style={{ height: '12px', cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
        />

        {/* Bottom Next Lyrics Row */}
        <div className="stage-row-bottom" style={{ height: `${rowHeights.bottom}%`, background: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px', boxSizing: 'border-box', overflow: 'hidden', position: 'relative' }}>
          {/* Render background/slide preview graphics only for the UP NEXT slide (PPT/PDF pages, suppressed for lyrics) */}
          {!stageData.blackout && !stageData.nextSlideText && stageData.nextSlideBg && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
              {/\.(mp4|webm|mov|avi)(\?|$)/i.test(stageData.nextSlideBg) ? (
                <video
                  src={stageData.nextSlideBg}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }}
                />
              ) : (
                <img
                  src={stageData.nextSlideBg}
                  alt="Next Slide Preview"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.8 }}
                />
              )}
            </div>
          )}

          <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'inline-flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', color: '#f8fafc', fontSize: '18px', fontWeight: 800, letterSpacing: '0.2em', zIndex: 10 }}>
            <span style={{ width: '10px', height: '28px', borderRadius: '999px', background: stageData.upNextLineColor || '#f97316' }} />
            <span>{stageData.nextSlideLabel ? stageData.nextSlideLabel.toUpperCase() : 'UP NEXT'}</span>
          </div>
          <div style={{ width: '100%', textAlign: 'center', maxWidth: '92%', zIndex: 10 }}>
            {stageData.nextSlideText ? (
              <div ref={nextTextRef} style={{ color: '#fff', fontWeight: '700', opacity: 0.85, whiteSpace: 'pre-wrap', lineHeight: 1.2 }}>
                {transformText(stageData.nextSlideText)}
              </div>
            ) : (
              !stageData.nextSlideBg && (
                <div style={{ color: '#64748b', fontSize: '32px', fontWeight: '600' }}>
                  END OF SONG
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <StageDisplay />
  </React.StrictMode>
);
