document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.history-card[data-operation-type]');
  if (!sidebar) return;

  const operationType = sidebar.dataset.operationType;
  const emptyState = sidebar.querySelector('.history-empty');
  const emptyTitle = emptyState.querySelector('.empty-title');
  const emptyText = emptyState.querySelector('.empty-text');
  const historyList = sidebar.querySelector('.history-list');
  const clearButton = sidebar.querySelector('.btn-clear-history');

  function showEmptyState(title, message) {
    emptyTitle.textContent = title;
    emptyText.textContent = message;
    emptyState.style.display = 'flex';
    historyList.style.display = 'none';
  }

  function renderHistory(records) {
    historyList.replaceChildren();
    clearButton.disabled = records.length === 0;

    if (records.length === 0) {
      showEmptyState('No history yet', `Your ${operationType.toLowerCase()} operations will appear here.`);
      return;
    }

    emptyState.style.display = 'none';
    historyList.style.display = 'flex';

    records.slice(0, 5).forEach((record) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const top = document.createElement('div');
      top.className = 'history-item-top';

      const algorithm = String(record.algorithm || 'Unknown');
      const algorithmBadge = document.createElement('span');
      const algorithmClass = algorithm.toLowerCase() === '3des'
        ? 'badge-3des'
        : `badge-${algorithm.toLowerCase()}`;
      algorithmBadge.className = `badge ${algorithmClass}`;
      algorithmBadge.textContent = algorithm;

      const summary = document.createElement('span');
      summary.className = 'history-preview';
      summary.textContent = `${record.status || 'Unknown'} - ${record.message_length ?? 0} chars`;

      const timestamp = document.createElement('div');
      timestamp.className = 'history-time';
      const date = new Date(record.timestamp);
      timestamp.textContent = Number.isNaN(date.getTime())
        ? String(record.timestamp || '')
        : date.toLocaleString();

      top.append(algorithmBadge, summary);
      item.append(top, timestamp);
      historyList.append(item);
    });
  }

  async function loadHistory() {
    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load operation history.');
      }
      if (!Array.isArray(data.records)) {
        throw new Error('The history response was invalid.');
      }

      const records = data.records.filter((record) =>
        record.operation_type === operationType
      );
      renderHistory(records);
    } catch (error) {
      clearButton.disabled = true;
      showEmptyState('History unavailable', error.message || 'Could not load operation history.');
    }
  }

  clearButton.addEventListener('click', async () => {
    if (clearButton.disabled || !window.confirm(`Clear all ${operationType.toLowerCase()} history?`)) {
      return;
    }

    clearButton.disabled = true;
    try {
      const response = await fetch(`/api/history?type=${encodeURIComponent(operationType)}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not clear operation history.');
      }
      await loadHistory();
    } catch (error) {
      window.alert(error.message || 'Could not clear operation history.');
      clearButton.disabled = false;
    }
  });

  window.addEventListener('history-updated', loadHistory);
  loadHistory();
});