document.addEventListener('DOMContentLoaded', () => {
  const pageSize = 10;
  const historyTableBody = document.getElementById('historyTableBody');
  const tableHeaderBar = document.getElementById('tableHeaderBar');
  const tableWrapper = document.getElementById('tableWrapper');
  const emptyState = document.getElementById('emptyState');
  const emptyTitle = emptyState.querySelector('.empty-title');
  const emptySubtitle = emptyState.querySelector('.empty-subtitle');
  const recordCountText = document.getElementById('recordCountText');
  const searchInput = document.getElementById('searchInput');
  const paginationContainer = document.getElementById('paginationContainer');
  const pageNumbers = document.getElementById('pageNumbers');
  const previousButton = document.getElementById('prevBtn');
  const nextButton = document.getElementById('nextBtn');
  const clearButton = document.getElementById('clearBtn');
  const clearModal = document.getElementById('clearModal');
  const confirmClearButton = document.getElementById('confirmClearBtn');
  const detailModal = document.getElementById('detailModal');
  const detailModalContent = document.getElementById('detailModalContent');

  let records = [];
  let currentPage = 1;

  function setEmptyState(title, message) {
    emptyTitle.textContent = title;
    emptySubtitle.textContent = message;
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? String(timestamp)
      : date.toLocaleString();
  }

  function createCell(value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = value == null ? '' : String(value);
    if (className) cell.className = className;
    return cell;
  }

  function getFilteredRecords() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) => [
      record.operation_type,
      record.algorithm,
      record.message_length,
      record.status,
      record.timestamp
    ].some((value) => String(value ?? '').toLowerCase().includes(query)));
  }

  function renderPagination(totalPages) {
    pageNumbers.replaceChildren();
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= totalPages;
    paginationContainer.classList.toggle('hidden', totalPages <= 1);

    const firstPage = Math.max(1, currentPage - 2);
    const lastPage = Math.min(totalPages, currentPage + 2);

    for (let page = firstPage; page <= lastPage; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'page-btn';
      button.textContent = String(page);
      button.setAttribute('aria-label', `Page ${page}`);
      if (page === currentPage) {
        button.classList.add('active');
        button.setAttribute('aria-current', 'page');
      }
      button.addEventListener('click', () => {
        currentPage = page;
        renderRecords();
      });
      pageNumbers.append(button);
    }
  }

  function showModal(modal) {
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('active'));
  }

  function hideModal(modal) {
    modal.classList.remove('active');
    window.setTimeout(() => modal.classList.add('hidden'), 200);
  }

  function openDetails(record) {
    const details = [
      ['Record ID', record.id],
      ['Date & Time', formatTimestamp(record.timestamp)],
      ['Operation', record.operation_type],
      ['Algorithm', record.algorithm],
      ['Message Length', record.message_length],
      ['Status', record.status]
    ];

    detailModalContent.replaceChildren();
    details.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'detail-row';

      const detailLabel = document.createElement('span');
      detailLabel.className = 'detail-label';
      detailLabel.textContent = label;

      const detailValue = document.createElement('span');
      detailValue.className = 'detail-val';
      detailValue.textContent = value == null ? '' : String(value);

      row.append(detailLabel, detailValue);
      detailModalContent.append(row);
    });

    showModal(detailModal);
  }

  function renderRecords() {
    const filteredRecords = getFilteredRecords();
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageRecords = filteredRecords.slice(startIndex, startIndex + pageSize);

    historyTableBody.replaceChildren();
    pageRecords.forEach((record) => {
      const row = document.createElement('tr');
      row.append(
        createCell(formatTimestamp(record.timestamp)),
        createCell(record.operation_type, 'type-cell'),
        createCell(record.algorithm),
        createCell(record.message_length)
      );

      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = String(record.status).toLowerCase() === 'success'
        ? 'badge-success'
        : 'badge-failure';
      statusBadge.textContent = record.status || 'Unknown';
      statusCell.append(statusBadge);
      row.append(statusCell);

      const actionCell = document.createElement('td');
      actionCell.className = 'text-right';
      const detailsButton = document.createElement('button');
      detailsButton.type = 'button';
      detailsButton.className = 'btn btn-outline';
      detailsButton.textContent = 'Details';
      detailsButton.setAttribute('aria-label', 'View operation details');
      detailsButton.addEventListener('click', () => openDetails(record));
      actionCell.append(detailsButton);
      row.append(actionCell);
      historyTableBody.append(row);
    });

    const hasRecords = records.length > 0;
    const hasMatches = filteredRecords.length > 0;
    tableHeaderBar.classList.toggle('hidden', !hasRecords);
    tableWrapper.classList.toggle('hidden', !hasMatches);
    emptyState.classList.toggle('hidden', hasMatches);
    clearButton.disabled = !hasRecords;

    if (!hasRecords) {
      setEmptyState('No activity history yet', 'Perform an encryption or decryption operation to record metadata here.');
      recordCountText.textContent = 'Showing 0 records';
    } else if (!hasMatches) {
      setEmptyState('No matching records', 'Try another search term.');
      recordCountText.textContent = 'Showing 0 records';
    } else {
      const lastRecord = Math.min(startIndex + pageSize, filteredRecords.length);
      setEmptyState('', '');
      recordCountText.textContent = `Showing ${startIndex + 1}-${lastRecord} of ${filteredRecords.length} records`;
    }

    renderPagination(totalPages);
  }

  async function loadHistory() {
    setEmptyState('Loading history...', 'Fetching operation records.');

    try {
      const response = await fetch('/api/history');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load operation history.');
      }
      if (!Array.isArray(data.records)) {
        throw new Error('The history response was invalid.');
      }

      records = data.records;
      renderRecords();
    } catch (error) {
      records = [];
      renderRecords();
      setEmptyState('History unavailable', error.message || 'Could not load operation history.');
    }
  }

  async function clearHistory() {
    confirmClearButton.disabled = true;
    confirmClearButton.textContent = 'Clearing...';

    try {
      const response = await fetch('/api/history', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not clear operation history.');
      }

      records = [];
      currentPage = 1;
      searchInput.value = '';
      renderRecords();
      setEmptyState('History cleared', 'No activity history is stored.');
      hideModal(clearModal);
    } catch (error) {
      window.alert(error.message || 'Could not clear operation history.');
    } finally {
      confirmClearButton.disabled = false;
      confirmClearButton.textContent = 'Clear All';
    }
  }

  searchInput.addEventListener('input', () => {
    currentPage = 1;
    renderRecords();
  });
  previousButton.addEventListener('click', () => {
    currentPage -= 1;
    renderRecords();
  });
  nextButton.addEventListener('click', () => {
    currentPage += 1;
    renderRecords();
  });
  clearButton.addEventListener('click', () => showModal(clearModal));
  confirmClearButton.addEventListener('click', clearHistory);
  document.getElementById('clearCancelBtn').addEventListener('click', () => hideModal(clearModal));
  document.getElementById('closeDetailBtn').addEventListener('click', () => hideModal(detailModal));
  document.getElementById('closeDetailFooterBtn').addEventListener('click', () => hideModal(detailModal));

  window.addEventListener('click', (event) => {
    if (event.target === detailModal) hideModal(detailModal);
    if (event.target === clearModal) hideModal(clearModal);
  });

  loadHistory();
});