/**
 * ExamShade Store — Data persistence layer
 * Uses tauri-plugin-store for JSON persistence
 */

const Store = (() => {
  let storeInstance = null;
  const STORE_FILE = 'examshade-data.json';

  // Default data structure
  const DEFAULT_DATA = {
    profiles: [
      {
        id: 'default',
        name: 'Основний',
        tickets: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          title: '',
          content: ''
        }))
      }
    ],
    activeProfileId: 'default',
    settings: {
      opacity: 1.0,
      activeGroup: 0, // 0 = Group A, 1 = Group B (offset by ticketsPerGroup)
    }
  };

  /**
   * Initialize the store
   */
  async function init() {
    try {
      // Use Tauri global API
      if (window.__TAURI__) {
        const { LazyStore } = await import('@tauri-apps/plugin-store');
        storeInstance = new LazyStore(STORE_FILE);

        // Check if store has data, if not initialize with defaults
        const profiles = await storeInstance.get('profiles');
        if (!profiles) {
          await storeInstance.set('profiles', DEFAULT_DATA.profiles);
          await storeInstance.set('activeProfileId', DEFAULT_DATA.activeProfileId);
          await storeInstance.set('settings', DEFAULT_DATA.settings);
          await storeInstance.save();
        }
      }
    } catch (e) {
      console.warn('Store init failed, using localStorage fallback:', e);
      storeInstance = null;
    }
  }

  /**
   * Get a value from store
   */
  async function get(key) {
    try {
      if (storeInstance) {
        const val = await storeInstance.get(key);
        return val !== null && val !== undefined ? val : DEFAULT_DATA[key];
      }
    } catch (e) {
      console.warn('Store get error:', e);
    }
    // Fallback to localStorage
    const stored = localStorage.getItem(`examshade_${key}`);
    return stored ? JSON.parse(stored) : DEFAULT_DATA[key];
  }

  /**
   * Set a value in store
   */
  async function set(key, value) {
    try {
      if (storeInstance) {
        await storeInstance.set(key, value);
        await storeInstance.save();
        return;
      }
    } catch (e) {
      console.warn('Store set error:', e);
    }
    // Fallback to localStorage
    localStorage.setItem(`examshade_${key}`, JSON.stringify(value));
  }

  // === Profile Operations ===

  async function getProfiles() {
    return await get('profiles') || DEFAULT_DATA.profiles;
  }

  async function getActiveProfileId() {
    return await get('activeProfileId') || 'default';
  }

  async function setActiveProfileId(id) {
    await set('activeProfileId', id);
  }

  async function getActiveProfile() {
    const profiles = await getProfiles();
    const activeId = await getActiveProfileId();
    return profiles.find(p => p.id === activeId) || profiles[0];
  }

  async function createProfile(name) {
    const profiles = await getProfiles();
    const id = 'profile_' + Date.now();
    const newProfile = {
      id,
      name,
      tickets: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: '',
        content: ''
      }))
    };
    profiles.push(newProfile);
    await set('profiles', profiles);
    return newProfile;
  }

  async function deleteProfile(id) {
    let profiles = await getProfiles();
    if (profiles.length <= 1) return false; // Can't delete last profile
    profiles = profiles.filter(p => p.id !== id);
    await set('profiles', profiles);

    const activeId = await getActiveProfileId();
    if (activeId === id) {
      await setActiveProfileId(profiles[0].id);
    }
    return true;
  }

  // === Ticket Operations ===

  async function saveTickets(profileId, tickets) {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      profile.tickets = tickets;
      await set('profiles', profiles);
    }
  }

  async function getTickets(profileId) {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    return profile ? profile.tickets : [];
  }

  async function addTicket(profileId) {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      const maxId = profile.tickets.reduce((max, t) => Math.max(max, t.id), 0);
      const newTicket = { id: maxId + 1, title: '', content: '' };
      profile.tickets.push(newTicket);
      await set('profiles', profiles);
      return newTicket;
    }
    return null;
  }

  async function deleteTicket(profileId, ticketId) {
    const profiles = await getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (profile && profile.tickets.length > 1) {
      profile.tickets = profile.tickets.filter(t => t.id !== ticketId);
      await set('profiles', profiles);
      return true;
    }
    return false;
  }

  // === Settings ===

  async function getSettings() {
    return await get('settings') || DEFAULT_DATA.settings;
  }

  async function saveSettings(settings) {
    await set('settings', settings);
  }

  return {
    init,
    get,
    set,
    getProfiles,
    getActiveProfileId,
    setActiveProfileId,
    getActiveProfile,
    createProfile,
    deleteProfile,
    saveTickets,
    getTickets,
    addTicket,
    deleteTicket,
    getSettings,
    saveSettings,
  };
})();
