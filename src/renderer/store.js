import { create } from 'zustand';

// 1. Library State Store (Songs catalog, searching, loading indicators)
export const useLibraryStore = create((set, get) => ({
  songs: [],
  loading: false,
  selectedSong: null,
  searchQuery: '',

  fetchSongs: async () => {
    set({ loading: true });
    try {
      if (window.api) {
        const list = await window.api.getAllSongs();
        set({ songs: list || [] });
      }
    } catch (err) {
      console.error('fetchSongs database query error:', err);
    } finally {
      set({ loading: false });
    }
  },

  searchSongs: async (query) => {
    set({ searchQuery: query, loading: true });
    try {
      if (window.api) {
        // Safe fuzzy lookup over IPC
        const results = await window.api.searchSongs(query);
        set({ songs: results || [] });
      }
    } catch (err) {
      console.error('searchSongs IPC call failed:', err);
    } finally {
      set({ loading: false });
    }
  },

  selectSong: async (songId) => {
    if (!songId) {
      set({ selectedSong: null });
      return;
    }
    set({ loading: true });
    try {
      if (window.api) {
        const fullSong = await window.api.getSong(songId);
        set({ selectedSong: fullSong });
      }
    } catch (err) {
      console.error('selectSong query error:', err);
    } finally {
      set({ loading: false });
    }
  },
  
  saveSong: async (songData) => {
    set({ loading: true });
    try {
      if (window.api) {
        const saved = await window.api.saveSong(songData);
        await get().fetchSongs();
        // Refresh detail window if editing active song
        if (get().selectedSong && get().selectedSong.id === saved.id) {
          await get().selectSong(saved.id);
        }
        return saved;
      }
    } catch (err) {
      console.error('saveSong mutation error:', err);
    } finally {
      set({ loading: false });
    }
  },

  deleteSong: async (songId) => {
    set({ loading: true });
    try {
      if (window.api) {
        await window.api.deleteSong(songId);
        if (get().selectedSong && get().selectedSong.id === songId) {
          set({ selectedSong: null });
        }
        await get().fetchSongs();
        // Sync cascade deletions in presentation lineup
        if (usePresentationStore) {
          await usePresentationStore.getState().fetchPlaylist();
        }
      }
    } catch (err) {
      console.error('deleteSong query execution error:', err);
    } finally {
      set({ loading: false });
    }
  }
}));

// 2. Playlist / Service Flow Store (Order lists)
export const usePresentationStore = create((set, get) => ({
  playlist: [],
  loading: false,

  fetchPlaylist: async () => {
    set({ loading: true });
    try {
      if (window.api) {
        const list = await window.api.getPlaylist();
        set({ playlist: list || [] });
      }
    } catch (err) {
      console.error('fetchPlaylist error:', err);
    } finally {
      set({ loading: false });
    }
  },

  addToPlaylist: async (name, type, songId) => {
    try {
      if (window.api) {
        await window.api.addToPlaylist({ name, type, songId });
        await get().fetchPlaylist();
      }
    } catch (err) {
      console.error('addToPlaylist execution error:', err);
    }
  },

  removeFromPlaylist: async (playlistId) => {
    try {
      if (window.api) {
        await window.api.removeFromPlaylist(playlistId);
        await get().fetchPlaylist();
      }
    } catch (err) {
      console.error('removeFromPlaylist execution error:', err);
    }
  },

  reorderPlaylist: async (items) => {
    set({ playlist: items });
    try {
      if (window.api) {
        await window.api.reorderPlaylist(items);
      }
    } catch (err) {
      console.error('reorderPlaylist sync error:', err);
      await get().fetchPlaylist(); // rollback on transaction fail
    }
  },

  clearPlaylist: async () => {
    try {
      if (window.api) {
        await window.api.clearPlaylist();
        set({ playlist: [] });
      }
    } catch (err) {
      console.error('clearPlaylist error:', err);
    }
  },

  importPlaylist: async (items) => {
    try {
      if (window.api) {
        await window.api.importPlaylist(items);
        await get().fetchPlaylist();
      }
    } catch (err) {
      console.error('importPlaylist error:', err);
    }
  }
}));

// 3. Live Output Store (Projector synchronization + blackout layers)
export const useLiveOutputStore = create((set, get) => ({
  activeSlideText: '',
  activeSlideLabel: '',
  activeBgAsset: '',
  activeSlideStyle: null,
  isBible: false,
  blackout: false,
  clearLyrics: false,

  setLiveSlide: (text, label, bgAsset, style, isBible = false) => {
    set({ 
      activeSlideText: text, 
      activeSlideLabel: label, 
      activeBgAsset: bgAsset, 
      activeSlideStyle: style,
      isBible: isBible
    });
  },

  setBlackout: (val) => {
    set({ blackout: val });
  },

  setClearLyrics: (val) => {
    set({ clearLyrics: val });
  }
}));

// 4. Stage Layout Store
export const useStageLayoutStore = create((set, get) => ({
  stageLayout: (() => {
    try {
      const saved = localStorage.getItem('stageLayout');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      panes: {},
      gridConfig: { cols: 2, gapPx: 12 },
      leftWidthPct: parseFloat(localStorage.getItem('stageLayout_leftWidthPct') || '60'),
      rightPanels: null
    };
  })(),

  setStageLayout: (layout) => {
    set({ stageLayout: layout });
    try { localStorage.setItem('stageLayout', JSON.stringify(layout)); } catch(e){}
    try { if (layout && layout.leftWidthPct !== undefined) localStorage.setItem('stageLayout_leftWidthPct', String(layout.leftWidthPct)); } catch(e){}
    try { if (layout && layout.rightPanels) localStorage.setItem('stageLayout_rightPanels', JSON.stringify(layout.rightPanels)); } catch(e){}
  },

  setRightPanels: (panels) => {
    const layout = get().stageLayout || {};
    layout.rightPanels = panels;
    set({ stageLayout: layout });
    try { localStorage.setItem('stageLayout_rightPanels', JSON.stringify(panels)); } catch(e){}
  },

  setPaneSize: (paneId, { heightPx, widthPct, fontSizePx }) => {
    const layout = get().stageLayout || { panes: {}, gridConfig: { cols: 2, gapPx: 12 } };
    layout.panes = layout.panes || {};
    layout.panes[paneId] = { ...(layout.panes[paneId] || {}), heightPx, widthPct, fontSizePx };
    set({ stageLayout: layout });
    try { localStorage.setItem('stageLayout', JSON.stringify(layout)); } catch(e){}
  },

  setLeftWidthPct: (pct) => {
    const layout = get().stageLayout || {};
    layout.leftWidthPct = pct;
    set({ stageLayout: layout });
    try { localStorage.setItem('stageLayout_leftWidthPct', String(pct)); } catch(e){}
  },

  resetStageLayout: () => {
    const defaults = { panes: {}, gridConfig: { cols: 2, gapPx: 12 }, leftWidthPct: 60 };
    set({ stageLayout: defaults });
    try { localStorage.removeItem('stageLayout'); localStorage.setItem('stageLayout_leftWidthPct', '60'); } catch(e){}
  }
}));
