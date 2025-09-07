document.addEventListener('DOMContentLoaded', () => {
  const sitesTableBody = document.querySelector('#sites-table tbody');
  if (!sitesTableBody) return; // Exit if table not found

  const fetchAndUpdateDashboard = async () => {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const sites = await response.json();
      renderTable(sites);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      sitesTableBody.innerHTML = '<tr><td colspan="6" class="py-4 px-4 text-center text-red-500">Error loading data. Retrying in 10 seconds...</td></tr>';
    }
  };

  const renderTable = (sites) => {
    // Clear existing table rows
    sitesTableBody.innerHTML = '';

    if (sites.length === 0) {
      sitesTableBody.innerHTML = '<tr><td colspan="6" class="py-4 px-4 text-center text-gray-500">No sites are being monitored yet. Add one above to get started!</td></tr>';
      return;
    }

    sites.forEach(site => {
      const statusBadge = site.status === 'UP'
        ? '<span class="bg-green-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">UP</span>'
        : site.status === 'DOWN'
          ? '<span class="bg-red-500 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">DOWN</span>'
          : '<span class="bg-gray-400 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">N/A</span>';

      const responseTime = site.response_time !== null ? `${site.response_time} ms` : 'N/A';
      const checkedAt = site.checked_at ? new Date(site.checked_at).toLocaleString() : 'Never';
      const details = site.details || '';

      const row = `
        <tr class="border-b hover:bg-gray-50">
          <td class="py-3 px-4"><a href="${site.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${site.url}</a></td>
          <td class="py-3 px-4">${statusBadge}</td>
          <td class="py-3 px-4">${responseTime}</td>
          <td class="py-3 px-4">${checkedAt}</td>
          <td class="py-3 px-4 text-sm text-gray-600 truncate" style="max-width: 200px;" title="${details}">${details}</td>
          <td class="py-3 px-4 flex items-center space-x-2">
            <form action="/check/${site.id}" method="POST" class="m-0">
              <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded">Check</button>
            </form>
            <a href="/site/${site.id}" class="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold py-1 px-3 rounded">Logs</a>
            <form action="/delete/${site.id}" method="POST" onsubmit="return confirm('Are you sure you want to delete this site and all its logs?');">
              <button type="submit" class="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-3 rounded">Delete</button>
            </form>
          </td>
        </tr>
      `;
      sitesTableBody.insertAdjacentHTML('beforeend', row);
    });
  };

  // Fetch data immediately on page load
  fetchAndUpdateDashboard();

  // Then fetch every 10 seconds
  setInterval(fetchAndUpdateDashboard, 10000);
});
