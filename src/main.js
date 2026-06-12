/**
 * ExamShade — Main Application Logic
 */

(async function () {
  // === State ===
  let currentProfileId = null;
  let tickets = [];
  let activeTicketIndex = 0;
  let currentGroup = 0; // 0 = A, 1 = B
  let ticketsPerGroup = 10;
  let saveTimeout = null;
  let allProfiles = [];

  // === DOM Elements ===
  const $ = (sel) => document.querySelector(sel);
  const ticketList = $('#ticket-list');
  const ticketTitle = $('#ticket-title');
  const ticketTitleInput = $('#ticket-title-input');
  const editorTextarea = $('#editor-textarea');
  const groupToggle = $('#group-toggle');
  const searchInput = $('#search-input');
  const searchResults = $('#search-results');
  const profileSelect = $('#profile-select');
  const opacitySlider = $('#opacity-slider');
  const statusTicket = $('#status-ticket');
  const statusGroup = $('#status-group');
  const statusSaved = $('#status-saved');
  const addTicketBtn = $('#add-ticket');
  const btnImport = $('#btn-import');
  const btnProfiles = $('#btn-profiles');
  const btnDeleteTicket = $('#btn-delete-ticket');

  // === Initialize ===
  await Store.init();
  await loadApp();

  // === Core Functions ===

  async function loadApp() {
    const settings = await Store.getSettings();
    currentGroup = settings.activeGroup || 0;

    // Apply saved opacity
    if (settings.opacity !== undefined) {
      opacitySlider.value = Math.round(settings.opacity * 100);
      applyOpacity(settings.opacity);
    }

    // Load profiles
    allProfiles = await Store.getProfiles();
    currentProfileId = await Store.getActiveProfileId();
    renderProfileSelect();

    // Load tickets for active profile
    await loadProfile(currentProfileId);
  }

  async function loadProfile(profileId) {
    currentProfileId = profileId;
    await Store.setActiveProfileId(profileId);
    tickets = await Store.getTickets(profileId);

    if (!tickets || tickets.length === 0) {
      tickets = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, content: '' }));
    }

    activeTicketIndex = 0;
    updateGroupDisplay();
    renderTicketList();
    loadTicketContent(activeTicketIndex);
  }

  function getVisibleTickets() {
    const start = currentGroup * ticketsPerGroup;
    const end = Math.min(start + ticketsPerGroup, tickets.length);
    return { start, end, tickets: tickets.slice(start, end) };
  }

  // === Rendering ===

  function renderTicketList() {
    ticketList.innerHTML = '';
    const { start, end } = getVisibleTickets();

    for (let i = start; i < end; i++) {
      const ticket = tickets[i];
      if (!ticket) continue;

      const el = document.createElement('div');
      el.className = 'sidebar__ticket';
      if (i === activeTicketIndex) el.classList.add('sidebar__ticket--active');
      if (ticket.content && ticket.content.trim()) el.classList.add('sidebar__ticket--has-content');

      el.innerHTML = `
        <span class="sidebar__ticket-number">${(i - start) + 1}</span>
        <span class="sidebar__ticket-title" title="${escapeHtml(ticket.title || '')}">${escapeHtml(ticket.title || '')}</span>
      `;
      el.dataset.index = i;
      el.addEventListener('click', () => switchToTicket(i));
      ticketList.appendChild(el);
    }
  }

  function renderProfileSelect() {
    profileSelect.innerHTML = '';
    for (const profile of allProfiles) {
      const opt = document.createElement('option');
      opt.value = profile.id;
      opt.textContent = profile.name;
      if (profile.id === currentProfileId) opt.selected = true;
      profileSelect.appendChild(opt);
    }
  }

  function updateGroupDisplay() {
    const isGroupA = currentGroup === 0;
    groupToggle.textContent = isGroupA ? 'A' : 'B';
    groupToggle.className = `sidebar__group-toggle sidebar__group-toggle--${isGroupA ? 'a' : 'b'}`;
    statusGroup.textContent = `Група ${isGroupA ? 'A' : 'B'}`;
  }

  function loadTicketContent(index) {
    activeTicketIndex = index;
    const ticket = tickets[index];
    if (!ticket) return;

    editorTextarea.value = ticket.content || '';
    ticketTitleInput.value = ticket.title || '';
    ticketTitle.textContent = `Білет ${index + 1}`;
    statusTicket.textContent = `Білет ${index + 1}`;

    renderTicketList(); // Update active highlight
    editorTextarea.focus();
  }

  // === Actions ===

  function switchToTicket(index) {
    saveCurrentTicket();
    loadTicketContent(index);
  }

  function saveCurrentTicket() {
    const ticket = tickets[activeTicketIndex];
    if (ticket) {
      ticket.content = editorTextarea.value;
      ticket.title = ticketTitleInput.value;
      scheduleSave();
    }
  }

  function scheduleSave() {
    statusSaved.textContent = '⏳ Зберігання...';
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await Store.saveTickets(currentProfileId, tickets);
      statusSaved.textContent = '✓ Збережено';
      // Update the has-content indicator
      renderTicketList();
    }, 800);
  }

  async function toggleGroup() {
    saveCurrentTicket();
    const maxGroups = Math.ceil(tickets.length / ticketsPerGroup);
    currentGroup = (currentGroup + 1) % Math.max(1, maxGroups);
    updateGroupDisplay();

    const settings = await Store.getSettings();
    settings.activeGroup = currentGroup;
    await Store.saveSettings(settings);

    // Switch to first ticket in new group
    const newIndex = currentGroup * ticketsPerGroup;
    if (newIndex < tickets.length) {
      loadTicketContent(newIndex);
    }
    renderTicketList();
  }

  async function applyOpacity(value) {
    document.body.style.opacity = value;
  }

  // === Keyboard Navigation ===

  function handleKeyboardNav(e) {
    // Don't intercept when typing in editor or search
    const active = document.activeElement;
    const isEditor = active === editorTextarea;
    const isSearch = active === searchInput;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

    // Tab — toggle group (always works)
    if (e.key === 'Tab' && !isSearch) {
      e.preventDefault();
      toggleGroup();
      return;
    }

    // Number keys 1-0 — switch ticket (only when NOT in editor/search)
    if (!isInput && e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      let num = parseInt(e.key);
      if (num === 0) num = 10;
      const targetIndex = currentGroup * ticketsPerGroup + num - 1;
      if (targetIndex < tickets.length) {
        switchToTicket(targetIndex);
      }
      return;
    }

    // Escape — close search, blur editor
    if (e.key === 'Escape') {
      Search.hideResults(searchResults);
      searchInput.value = '';
      if (isSearch) searchInput.blur();
      if (isEditor) editorTextarea.blur();
      closeAllModals();
      return;
    }

    // Ctrl/Cmd + F — focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      return;
    }

    // Ctrl/Cmd + I — import
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      openImportDialog();
      return;
    }
  }

  document.addEventListener('keydown', handleKeyboardNav);

  // === Search ===

  let searchDebounce = null;
  searchInput.addEventListener('input', () => {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(async () => {
      const query = searchInput.value.trim();
      if (query.length < 2) {
        Search.hideResults(searchResults);
        return;
      }
      allProfiles = await Store.getProfiles();
      const results = Search.searchAll(query, allProfiles);
      Search.renderResults(results, query, searchResults, onSearchSelect);
    }, 200);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) {
      // Re-trigger search on focus
      searchInput.dispatchEvent(new Event('input'));
    }
  });

  // Close search when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      Search.hideResults(searchResults);
    }
  });

  async function onSearchSelect(result) {
    Search.hideResults(searchResults);
    searchInput.value = '';

    // Switch profile if needed
    if (result.profileId !== currentProfileId) {
      profileSelect.value = result.profileId;
      await loadProfile(result.profileId);
      allProfiles = await Store.getProfiles();
      renderProfileSelect();
    }

    // Switch to ticket
    switchToTicket(result.ticketIndex);
  }

  // === Profile Select ===

  profileSelect.addEventListener('change', async () => {
    saveCurrentTicket();
    await loadProfile(profileSelect.value);
  });

  // === Opacity ===

  opacitySlider.addEventListener('input', async () => {
    const value = parseInt(opacitySlider.value) / 100;
    applyOpacity(value);
    const settings = await Store.getSettings();
    settings.opacity = value;
    await Store.saveSettings(settings);
  });

  // === Group Toggle ===

  groupToggle.addEventListener('click', toggleGroup);

  // === Add Ticket ===

  addTicketBtn.addEventListener('click', async () => {
    saveCurrentTicket();
    const newTicket = await Store.addTicket(currentProfileId);
    if (newTicket) {
      tickets = await Store.getTickets(currentProfileId);
      const newIndex = tickets.length - 1;

      // Switch to the group containing the new ticket
      const targetGroup = Math.floor(newIndex / ticketsPerGroup);
      if (targetGroup !== currentGroup) {
        currentGroup = targetGroup;
        updateGroupDisplay();
      }

      renderTicketList();
      loadTicketContent(newIndex);
    }
  });

  // === Delete Ticket ===

  btnDeleteTicket.addEventListener('click', () => {
    if (tickets.length <= 1) return;
    $('#delete-message').textContent =
      `Ви впевнені, що хочете видалити Білет ${activeTicketIndex + 1}?`;
    openModal('modal-delete');
  });

  $('#btn-delete-confirm').addEventListener('click', async () => {
    const ticketId = tickets[activeTicketIndex].id;
    const deleted = await Store.deleteTicket(currentProfileId, ticketId);
    if (deleted) {
      tickets = await Store.getTickets(currentProfileId);
      if (activeTicketIndex >= tickets.length) {
        activeTicketIndex = tickets.length - 1;
      }
      renderTicketList();
      loadTicketContent(activeTicketIndex);
    }
    closeModal('modal-delete');
  });

  $('#btn-delete-cancel').addEventListener('click', () => closeModal('modal-delete'));
  $('#modal-delete-close').addEventListener('click', () => closeModal('modal-delete'));

  // === Profiles Modal ===

  btnProfiles.addEventListener('click', async () => {
    allProfiles = await Store.getProfiles();
    renderProfilesModal();
    openModal('modal-profiles');
  });

  $('#modal-profiles-close').addEventListener('click', () => closeModal('modal-profiles'));

  function renderProfilesModal() {
    const list = $('#profiles-list');
    list.innerHTML = '';
    for (const profile of allProfiles) {
      const item = document.createElement('div');
      item.className = 'modal__profile-item';
      if (profile.id === currentProfileId) item.classList.add('modal__profile-item--active');

      const ticketCount = profile.tickets.filter(t => t.content && t.content.trim()).length;

      item.innerHTML = `
        <div>
          <div class="modal__profile-name">${escapeHtml(profile.name)}</div>
          <div class="modal__profile-count">${profile.tickets.length} білетів, ${ticketCount} заповнено</div>
        </div>
        ${allProfiles.length > 1 ? '<button class="btn btn--icon btn--danger profile-delete-btn" title="Видалити">🗑</button>' : ''}
      `;

      item.addEventListener('click', async (e) => {
        if (e.target.closest('.profile-delete-btn')) {
          // Delete profile
          const deleted = await Store.deleteProfile(profile.id);
          if (deleted) {
            allProfiles = await Store.getProfiles();
            currentProfileId = await Store.getActiveProfileId();
            await loadProfile(currentProfileId);
            renderProfileSelect();
            renderProfilesModal();
          }
          return;
        }
        // Select profile
        saveCurrentTicket();
        await loadProfile(profile.id);
        renderProfileSelect();
        closeModal('modal-profiles');
      });

      list.appendChild(item);
    }
  }

  $('#btn-create-profile').addEventListener('click', async () => {
    const nameInput = $('#new-profile-name');
    const name = nameInput.value.trim();
    if (!name) return;

    await Store.createProfile(name);
    allProfiles = await Store.getProfiles();
    nameInput.value = '';
    renderProfilesModal();
    renderProfileSelect();
  });

  $('#new-profile-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('#btn-create-profile').click();
    }
  });

  // === Import ===

  let importedTickets = [];

  btnImport.addEventListener('click', openImportDialog);

  async function openImportDialog() {
    if (window.__TAURI__) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const filePath = await open({
          title: 'Імпорт білетів',
          filters: [
            { name: 'Текстові файли', extensions: ['txt', 'md'] }
          ],
          multiple: false,
        });

        if (filePath) {
          const { invoke } = window.__TAURI__.core;
          const content = await invoke('read_file_content', { path: filePath });
          processImport(content);
        }
      } catch (e) {
        console.error('Import error:', e);
      }
    } else {
      // Browser fallback — file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.md';
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          const content = await file.text();
          processImport(content);
        }
      });
      input.click();
    }
  }

  function processImport(content) {
    // Split by double newline
    const parts = content.split(/\n\s*\n/).filter(p => p.trim());
    importedTickets = parts.map((text, i) => ({
      id: Date.now() + i,
      content: text.trim()
    }));

    // Show preview
    const preview = $('#import-preview');
    const count = $('#import-count');
    const items = $('#import-items');

    count.textContent = `Знайдено ${importedTickets.length} білетів:`;
    items.innerHTML = importedTickets.slice(0, 10).map((t, i) =>
      `<div class="import-preview__item">${i + 1}. ${escapeHtml(t.content.substring(0, 80))}${t.content.length > 80 ? '...' : ''}</div>`
    ).join('');

    if (importedTickets.length > 10) {
      items.innerHTML += `<div class="import-preview__item" style="color: var(--text-muted);">...та ще ${importedTickets.length - 10}</div>`;
    }

    preview.style.display = 'block';
    $('#btn-import-confirm').disabled = false;
    openModal('modal-import');
  }

  $('#btn-import-confirm').addEventListener('click', async () => {
    if (importedTickets.length > 0) {
      // Replace current profile's tickets
      tickets = importedTickets;
      await Store.saveTickets(currentProfileId, tickets);
      activeTicketIndex = 0;
      currentGroup = 0;
      updateGroupDisplay();
      renderTicketList();
      loadTicketContent(0);
    }
    closeModal('modal-import');
    resetImportModal();
  });

  $('#btn-import-cancel').addEventListener('click', () => {
    closeModal('modal-import');
    resetImportModal();
  });

  $('#modal-import-close').addEventListener('click', () => {
    closeModal('modal-import');
    resetImportModal();
  });

  function resetImportModal() {
    importedTickets = [];
    $('#import-preview').style.display = 'none';
    $('#btn-import-confirm').disabled = true;
  }

  // === Editor auto-save ===

  editorTextarea.addEventListener('input', () => {
    const ticket = tickets[activeTicketIndex];
    if (ticket) {
      ticket.content = editorTextarea.value;
      scheduleSave();
    }
  });

  ticketTitleInput.addEventListener('input', () => {
    const ticket = tickets[activeTicketIndex];
    if (ticket) {
      ticket.title = ticketTitleInput.value;
      scheduleSave();
      renderTicketList();
    }
  });

  // === Modal Helpers ===

  function openModal(id) {
    const modal = $(`#${id}`);
    if (modal) modal.classList.add('modal-overlay--visible');
  }

  function closeModal(id) {
    const modal = $(`#${id}`);
    if (modal) modal.classList.remove('modal-overlay--visible');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m =>
      m.classList.remove('modal-overlay--visible')
    );
  }

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('modal-overlay--visible');
      }
    });
  });

  // === Utilities ===

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
