/**
 * ExamShade Search — Fuzzy search across all tickets
 */

const Search = (() => {
  /**
   * Search all tickets across all profiles
   * @param {string} query - Search query
   * @param {Array} profiles - All profiles
   * @returns {Array} Search results with highlights
   */
  function searchAll(query, profiles) {
    if (!query || query.trim().length < 2) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const results = [];

    for (const profile of profiles) {
      for (let i = 0; i < profile.tickets.length; i++) {
        const ticket = profile.tickets[i];
        if (!ticket.content) continue;

        const content = ticket.content.toLowerCase();
        const matchIndex = content.indexOf(normalizedQuery);

        if (matchIndex !== -1) {
          // Extract context around the match
          const contextStart = Math.max(0, matchIndex - 30);
          const contextEnd = Math.min(ticket.content.length, matchIndex + normalizedQuery.length + 50);
          let preview = ticket.content.substring(contextStart, contextEnd);

          if (contextStart > 0) preview = '...' + preview;
          if (contextEnd < ticket.content.length) preview = preview + '...';

          results.push({
            profileId: profile.id,
            profileName: profile.name,
            ticketIndex: i,
            ticketId: ticket.id,
            ticketNumber: i + 1,
            preview,
            matchIndex: matchIndex - contextStart,
            queryLength: normalizedQuery.length,
          });
        }
      }
    }

    return results;
  }

  /**
   * Highlight matches in text
   * @param {string} text - Original text
   * @param {string} query - Search query
   * @returns {string} HTML with highlighted matches
   */
  function highlightMatches(text, query) {
    if (!query || query.length < 2) return escapeHtml(text);

    const escaped = escapeHtml(text);
    const escapedQuery = escapeHtml(query);
    const regex = new RegExp(`(${escapeRegex(escapedQuery)})`, 'gi');

    return escaped.replace(regex, '<span class="search-results__highlight">$1</span>');
  }

  /**
   * Escape HTML entities
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   */
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Render search results to the DOM
   * @param {Array} results - Search results
   * @param {string} query - Original query
   * @param {HTMLElement} container - Container element
   * @param {Function} onSelect - Callback when result is selected
   */
  function renderResults(results, query, container, onSelect) {
    container.innerHTML = '';

    if (results.length === 0) {
      container.innerHTML = '<div class="search-results__empty">Нічого не знайдено</div>';
      container.classList.add('search-results--visible');
      return;
    }

    for (const result of results.slice(0, 20)) { // Limit to 20 results
      const item = document.createElement('div');
      item.className = 'search-results__item';
      item.innerHTML = `
        <div class="search-results__ticket-name">
          ${escapeHtml(result.profileName)} → Білет ${result.ticketNumber}
        </div>
        <div class="search-results__preview">
          ${highlightMatches(result.preview, query)}
        </div>
      `;
      item.addEventListener('click', () => onSelect(result));
      container.appendChild(item);
    }

    container.classList.add('search-results--visible');
  }

  /**
   * Hide search results
   */
  function hideResults(container) {
    container.classList.remove('search-results--visible');
    container.innerHTML = '';
  }

  return {
    searchAll,
    highlightMatches,
    renderResults,
    hideResults,
  };
})();
