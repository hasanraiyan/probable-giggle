document.addEventListener('DOMContentLoaded', () => {
  const sitesTableBody = document.querySelector('#sites-table tbody');
  if (!sitesTableBody) return;

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
      sitesTableBody.innerHTML = '<tr><td colspan="6" class="py-8 px-4 text-center text-red-500">Could not load site data. The server might be busy. Retrying...</td></tr>';
    }
  };

  const renderTable = (sites) => {
    sitesTableBody.innerHTML = ''; // Clear existing rows

    if (sites.length === 0) {
      sitesTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 px-4 text-center text-gray-500">
            <p class="text-lg font-semibold">No sites are being monitored yet.</p>
            <p>Add one above to get started!</p>
          </td>
        </tr>`;
      return;
    }

    sites.forEach(site => {
      let statusBadge;
      if (site.is_paused) {
        statusBadge = '<span class="bg-yellow-100 text-yellow-800 text-sm font-semibold px-3 py-1 rounded-full">PAUSED</span>';
      } else if (site.status === 'UP') {
        statusBadge = '<span class="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">UP</span>';
      } else if (site.status === 'DOWN') {
        statusBadge = '<span class="bg-red-100 text-red-800 text-sm font-semibold px-3 py-1 rounded-full">DOWN</span>';
      } else {
        statusBadge = '<span class="bg-gray-100 text-gray-800 text-sm font-semibold px-3 py-1 rounded-full">N/A</span>';
      }

      const responseTime = site.response_time !== null ? `${site.response_time} ms` : 'N/A';
      const checkedAt = site.checked_at ? new Date(site.checked_at).toLocaleString() : 'Never';
      const details = site.details || '';

      const row = `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="py-4 px-4 font-medium text-gray-900">
            <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${site.url}</a>
          </td>
          <td class="py-4 px-4">${statusBadge}</td>
          <td class="py-4 px-4 text-gray-700">${responseTime}</td>
          <td class="py-4 px-4 text-gray-700">${checkedAt}</td>
          <td class="py-4 px-4 text-sm text-gray-500 truncate" style="max-width: 200px;" title="${details}">${details}</td>
          <td class="py-4 px-4">
            <div class="flex items-center space-x-2">
              <form action="/check/${site.id}" method="POST" class="m-0">
                <button type="submit" class="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold py-2 px-3 rounded-md transition-colors ${site.is_paused ? 'opacity-50 cursor-not-allowed' : ''}" ${site.is_paused ? 'disabled' : ''}>Check</button>
              </form>
              <form action="/site/${site.id}/toggle-pause" method="POST" class="m-0">
                <button type="submit" class="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs font-bold py-2 px-3 rounded-md transition-colors">
                  ${site.is_paused ? 'Resume' : 'Pause'}
                </button>
              </form>
              <a href="/site/${site.id}" class="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold py-2 px-3 rounded-md transition-colors">Logs</a>
              <form action="/delete/${site.id}" method="POST" class="m-0 delete-form">
                <button type="submit" class="bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold py-2 px-3 rounded-md transition-colors">Delete</button>
              </form>
            </div>
          </td>
        </tr>
      `;
      sitesTableBody.insertAdjacentHTML('beforeend', row);
    });
  };

  // Add a single event listener to the table for handling delete clicks.
  // This is more efficient than adding a listener to every single delete form.
  document.getElementById('sites-table').addEventListener('submit', function(event) {
    // Check if the submitted form is a delete form
    if (event.target.classList.contains('delete-form')) {
      // Prevent the form from submitting immediately
      event.preventDefault();

      const confirmed = confirm('Are you sure you want to delete this site and all its logs? This action cannot be undone.');
      if (confirmed) {
        // If the user confirmed, submit the form
        event.target.submit();
      }
    }
  });

  // Initial fetch and render
  fetchAndUpdateDashboard();

  // Refresh data every 10 seconds
  setInterval(fetchAndUpdateDashboard, 10000);
});
