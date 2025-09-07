document.addEventListener('DOMContentLoaded', () => {
  let currentView = 'grid';
  let lastUpdateTime = new Date();
  let latencyChart = null;

  // UI Elements
  const sitesGrid = document.getElementById('sites-grid');
  const sitesTableContainer = document.getElementById('sites-table-container');
  const sitesTableBody = document.querySelector('#sites-table tbody');
  const gridViewBtn = document.getElementById('grid-view-btn');
  const tableViewBtn = document.getElementById('table-view-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const addSiteForm = document.getElementById('add-site-form');
  const loadingOverlay = document.getElementById('loading-overlay');
  const lastUpdatedSpan = document.getElementById('last-updated');

  // Stats elements
  const totalSitesEl = document.getElementById('total-sites');
  const sitesUpEl = document.getElementById('sites-up');
  const sitesDownEl = document.getElementById('sites-down');
  const avgResponseEl = document.getElementById('avg-response');

  // Latency chart elements
  const latencyChartCanvas = document.getElementById('latency-chart');
  const currentLatencyEl = document.getElementById('current-latency');
  const latencyChangeEl = document.getElementById('latency-change');
  const latencyRefreshBtn = document.getElementById('latency-refresh');

  // Toast notification system
  const showToast = (message, type = 'info') => {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full opacity-0 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'warning' ? 'bg-yellow-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    toast.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  // Loading state management
  const showLoading = () => {
    loadingOverlay.classList.remove('hidden');
  };

  const hideLoading = () => {
    loadingOverlay.classList.add('hidden');
  };

  // View toggle functionality
  const toggleView = (view) => {
    currentView = view;
    if (view === 'grid') {
      sitesGrid.classList.remove('hidden');
      sitesTableContainer.classList.add('hidden');
      gridViewBtn.classList.add('bg-primary-100', 'text-primary-700');
      gridViewBtn.classList.remove('bg-white/50', 'text-slate-600');
      tableViewBtn.classList.remove('bg-primary-100', 'text-primary-700');
      tableViewBtn.classList.add('bg-white/50', 'text-slate-600');
    } else {
      sitesGrid.classList.add('hidden');
      sitesTableContainer.classList.remove('hidden');
      tableViewBtn.classList.add('bg-primary-100', 'text-primary-700');
      tableViewBtn.classList.remove('bg-white/50', 'text-slate-600');
      gridViewBtn.classList.remove('bg-primary-100', 'text-primary-700');
      gridViewBtn.classList.add('bg-white/50', 'text-slate-600');
    }
    localStorage.setItem('preferredView', view);
  };

  // Event listeners for view toggle
  gridViewBtn?.addEventListener('click', () => toggleView('grid'));
  tableViewBtn?.addEventListener('click', () => toggleView('table'));

  // Load preferred view from localStorage
  const preferredView = localStorage.getItem('preferredView') || 'grid';
  toggleView(preferredView);

  // Update stats
  const updateStats = (sites) => {
    const totalSites = sites.length;
    const sitesUp = sites.filter(site => !site.is_paused && site.status === 'UP').length;
    const sitesDown = sites.filter(site => !site.is_paused && site.status === 'DOWN').length;
    const responseTimes = sites.filter(site => site.response_time !== null).map(site => site.response_time);
    const avgResponse = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;

    totalSitesEl.textContent = totalSites;
    sitesUpEl.textContent = sitesUp;
    sitesDownEl.textContent = sitesDown;
    avgResponseEl.textContent = avgResponse > 0 ? `${avgResponse}ms` : '0ms';

    // Animate numbers
    [totalSitesEl, sitesUpEl, sitesDownEl, avgResponseEl].forEach(el => {
      el.classList.add('animate-pulse');
      setTimeout(() => el.classList.remove('animate-pulse'), 500);
    });
  };

  // Initialize latency chart
  const initLatencyChart = () => {
    if (!latencyChartCanvas) return;
    
    const ctx = latencyChartCanvas.getContext('2d');
    const canvas = latencyChartCanvas;
    
    let latencyData = [];

    const drawChart = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      
      const width = rect.width;
      const height = rect.height;
      const padding = 20;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Find min/max for scaling
      const latencies = latencyData.map(d => d.latency);
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);
      const range = maxLatency - minLatency || 1;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
      gradient.addColorStop(0, 'rgba(134, 142, 150, 0.3)');
      gradient.addColorStop(1, 'rgba(134, 142, 150, 0.05)');

      // Draw filled area
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      
      latencyData.forEach((point, index) => {
        const x = padding + (index / (latencyData.length - 1)) * chartWidth;
        const y = padding + (1 - (point.latency - minLatency) / range) * chartHeight;
        
        if (index === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.lineTo(padding + chartWidth, height - padding);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      latencyData.forEach((point, index) => {
        const x = padding + (index / (latencyData.length - 1)) * chartWidth;
        const y = padding + (1 - (point.latency - minLatency) / range) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.strokeStyle = 'rgba(134, 142, 150, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    // Fetch latency data from API
    const fetchLatencyData = async () => {
      try {
        const response = await fetch('/api/latency?hours=24');
        if (!response.ok) throw new Error('Failed to fetch latency data');
        
        const data = await response.json();
        latencyData = data.filter(point => point.latency !== null);
        
        // Update current latency display
        if (latencyData.length > 0) {
          const latestPoint = latencyData[latencyData.length - 1];
          currentLatencyEl.textContent = `${latestPoint.latency}ms`;
          
          // Calculate change percentage (compare with 24h ago)
          if (latencyData.length > 1) {
            const firstPoint = latencyData[0];
            const change = ((latestPoint.latency - firstPoint.latency) / firstPoint.latency * 100);
            const changeText = change > 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`;
            const changeColor = change > 0 ? 'text-red-600' : 'text-green-600';
            
            latencyChangeEl.textContent = changeText;
            latencyChangeEl.className = `text-sm font-medium ${changeColor}`;
          }
        } else {
          currentLatencyEl.textContent = '—';
          latencyChangeEl.textContent = '—';
          latencyChangeEl.className = 'text-sm font-medium text-slate-500';
        }
        
        drawChart();
      } catch (error) {
        console.error('Error fetching latency data:', error);
        currentLatencyEl.textContent = '—';
        latencyChangeEl.textContent = '—';
      }
    };

    const updateLatencyChart = () => {
      fetchLatencyData();
    };

    // Initial fetch and draw
    fetchLatencyData();
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      drawChart();
    });
    resizeObserver.observe(canvas);

    return { updateLatencyChart, fetchLatencyData, drawChart };
  };

  // Initialize chart
  const chartControls = initLatencyChart();

  // Update last updated time
  const updateLastUpdatedTime = () => {
    const now = new Date();
    const diff = Math.floor((now - lastUpdateTime) / 1000);
    let timeText;
    
    if (diff < 60) {
      timeText = 'Just now';
    } else if (diff < 3600) {
      timeText = `${Math.floor(diff / 60)}m ago`;
    } else {
      timeText = `${Math.floor(diff / 3600)}h ago`;
    }
    
    lastUpdatedSpan.textContent = timeText;
  };

  // Fetch and update dashboard
  const fetchAndUpdateDashboard = async (showLoadingState = false) => {
    try {
      if (showLoadingState) showLoading();
      
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const sites = await response.json();
      
      updateStats(sites);
      renderSites(sites);
      
      // Update latency chart
      if (chartControls && chartControls.updateLatencyChart) {
        chartControls.updateLatencyChart();
      }
      
      lastUpdateTime = new Date();
      updateLastUpdatedTime();
      
      if (showLoadingState) hideLoading();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showToast('Failed to update dashboard data', 'error');
      if (showLoadingState) hideLoading();
    }
  };

  // Render sites in both grid and table
  const renderSites = (sites) => {
    renderGrid(sites);
    renderTable(sites);
  };

  // Render grid view
  const renderGrid = (sites) => {
    if (!sitesGrid) return;
    
    if (sites.length === 0) {
      sitesGrid.innerHTML = `
        <div class="col-span-full text-center py-12">
          <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-globe text-slate-400 text-2xl"></i>
          </div>
          <p class="font-semibold text-slate-900 mb-2">No sites are being monitored yet</p>
          <p class="text-sm text-slate-500">Add your first website above to get started with monitoring!</p>
        </div>
      `;
      return;
    }

    sitesGrid.innerHTML = sites.map(site => {
      const statusIcon = site.is_paused ? 'pause' : site.status === 'UP' ? 'check-circle' : site.status === 'DOWN' ? 'times-circle' : 'question-circle';
      const statusColor = site.is_paused ? 'yellow' : site.status === 'UP' ? 'green' : site.status === 'DOWN' ? 'red' : 'slate';
      const statusText = site.is_paused ? 'PAUSED' : site.status || 'N/A';
      
      return `
        <div class="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/30 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 animate-slide-up">
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-slate-900 truncate" title="${site.url}">
                <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="hover:text-primary-600 transition-colors">
                  <i class="fas fa-external-link-alt text-xs mr-2"></i>${site.url.replace(/^https?:\/\//, '')}
                </a>
              </h3>
            </div>
            <div class="ml-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800">
                <i class="fas fa-${statusIcon} mr-1"></i>${statusText}
              </span>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="text-center p-3 bg-white/50 rounded-lg">
              <p class="text-xs text-slate-500 mb-1">24h Uptime</p>
              <p class="font-semibold text-slate-900">${site.uptime ? site.uptime['24h'] : '—'}</p>
            </div>
            <div class="text-center p-3 bg-white/50 rounded-lg">
              <p class="text-xs text-slate-500 mb-1">7d Uptime</p>
              <p class="font-semibold text-slate-900">${site.uptime ? site.uptime['7d'] : '—'}</p>
            </div>
          </div>

          <div class="flex items-center justify-between text-sm text-slate-600 mb-4">
            <span><i class="fas fa-clock mr-1"></i>${site.response_time !== null ? `${site.response_time}ms` : '—'}</span>
            <span><i class="fas fa-calendar mr-1"></i>${site.checked_at ? new Date(site.checked_at).toLocaleTimeString() : '—'}</span>
          </div>

          <div class="flex items-center justify-between space-x-2">
            <div class="flex space-x-2">
              <form action="/check/${site.id}" method="POST" class="m-0">
                <button type="submit" class="bg-primary-100 hover:bg-primary-200 text-primary-700 text-xs font-semibold py-2 px-3 rounded-lg transition-colors ${site.is_paused ? 'opacity-50 cursor-not-allowed' : ''}" ${site.is_paused ? 'disabled' : ''}>
                  <i class="fas fa-sync mr-1"></i>Check
                </button>
              </form>
              <form action="/site/${site.id}/toggle-pause" method="POST" class="m-0">
                <button type="submit" class="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs font-semibold py-2 px-3 rounded-lg transition-colors">
                  <i class="fas fa-${site.is_paused ? 'play' : 'pause'} mr-1"></i>${site.is_paused ? 'Resume' : 'Pause'}
                </button>
              </form>
            </div>
            <div class="flex space-x-2">
              <a href="/site/${site.id}" class="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-2 px-3 rounded-lg transition-colors">
                <i class="fas fa-chart-line mr-1"></i>Logs
              </a>
              <form action="/delete/${site.id}" method="POST" class="m-0 delete-form">
                <button type="submit" class="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold py-2 px-3 rounded-lg transition-colors">
                  <i class="fas fa-trash mr-1"></i>Delete
                </button>
              </form>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  // Render table view
  const renderTable = (sites) => {
    if (!sitesTableBody) return;
    
    sitesTableBody.innerHTML = '';

    if (sites.length === 0) {
      sitesTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="py-12 px-4 text-center text-slate-500">
            <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-globe text-slate-400 text-2xl"></i>
            </div>
            <p class="font-semibold text-slate-900 mb-2">No sites are being monitored yet</p>
            <p class="text-sm text-slate-500">Add your first website above to get started with monitoring!</p>
          </td>
        </tr>`;
      return;
    }
  
    sites.forEach(site => {
      const statusIcon = site.is_paused ? 'pause' : site.status === 'UP' ? 'check-circle' : site.status === 'DOWN' ? 'times-circle' : 'question-circle';
      const statusColor = site.is_paused ? 'yellow' : site.status === 'UP' ? 'green' : site.status === 'DOWN' ? 'red' : 'slate';
      const statusText = site.is_paused ? 'PAUSED' : site.status || 'N/A';
      
      const row = `
        <tr class="hover:bg-white/50 transition-colors">
          <td class="py-3 px-4 font-medium text-slate-900">
            <a href="${site.url}" target="_blank" rel="noopener noreferrer" class="hover:text-primary-600 transition-colors">
              <i class="fas fa-external-link-alt text-xs mr-2"></i>${site.url}
            </a>
          </td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-${statusColor}-100 text-${statusColor}-800">
              <i class="fas fa-${statusIcon} mr-1"></i>${statusText}
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-slate-600">${site.uptime ? site.uptime['24h'] : '—'}</td>
          <td class="py-3 px-4 text-sm text-slate-600">${site.uptime ? site.uptime['7d'] : '—'}</td>
          <td class="py-3 px-4 text-sm text-slate-600">${site.response_time !== null ? `${site.response_time} ms` : '—'}</td>
          <td class="py-3 px-4 text-sm text-slate-600">${site.checked_at ? new Date(site.checked_at).toLocaleString() : '—'}</td>
          <td class="py-3 px-4 text-sm text-slate-500 truncate" style="max-width: 180px;" title="${site.details || ''}">${site.details || ''}</td>
          <td class="py-3 px-4">
            <div class="flex items-center space-x-2">
              <form action="/check/${site.id}" method="POST" class="m-0">
                <button type="submit" class="bg-primary-100 hover:bg-primary-200 text-primary-700 text-xs font-semibold py-1 px-3 rounded-md transition-colors ${site.is_paused ? 'opacity-50 cursor-not-allowed' : ''}" ${site.is_paused ? 'disabled' : ''}>
                  <i class="fas fa-sync mr-1"></i>Check
                </button>
              </form>
              <form action="/site/${site.id}/toggle-pause" method="POST" class="m-0">
                <button type="submit" class="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs font-semibold py-1 px-3 rounded-md transition-colors">
                  <i class="fas fa-${site.is_paused ? 'play' : 'pause'} mr-1"></i>${site.is_paused ? 'Resume' : 'Pause'}
                </button>
              </form>
              <a href="/site/${site.id}" class="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold py-1 px-3 rounded-md transition-colors">
                <i class="fas fa-chart-line mr-1"></i>Logs
              </a>
              <form action="/delete/${site.id}" method="POST" class="m-0 delete-form">
                <button type="submit" class="bg-red-100 hover:bg-red-200 text-red-600 text-xs font-semibold py-1 px-3 rounded-md transition-colors">
                  <i class="fas fa-trash mr-1"></i>Delete
                </button>
              </form>
            </div>
          </td>
        </tr>
      `;
      sitesTableBody.insertAdjacentHTML('beforeend', row);
    });
  };

  // Event listeners
  refreshBtn?.addEventListener('click', () => {
    fetchAndUpdateDashboard(true);
    showToast('Dashboard refreshed', 'success');
  });

  // Latency refresh button
  latencyRefreshBtn?.addEventListener('click', () => {
    if (chartControls && chartControls.fetchLatencyData) {
      chartControls.fetchLatencyData();
      showToast('Latency chart refreshed', 'success');
    }
  });

  // Add site form enhancement
  addSiteForm?.addEventListener('submit', (e) => {
    const submitBtn = addSiteForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adding...';
    submitBtn.disabled = true;
    
    // Re-enable after 3 seconds (form will redirect anyway)
    setTimeout(() => {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }, 3000);
  });

  // Delete confirmation with enhanced UI
  document.addEventListener('submit', function(event) {
    if (event.target.classList.contains('delete-form')) {
      event.preventDefault();
      
      const siteUrl = event.target.closest('tr, .bg-white\\/60')?.querySelector('a')?.textContent || 'this site';
      
      if (confirm(`Are you sure you want to delete ${siteUrl} and all its logs? This action cannot be undone.`)) {
        showLoading();
        event.target.submit();
      }
    }
  });

  // Update time every minute
  setInterval(updateLastUpdatedTime, 60000);

  // Initial fetch and render
  fetchAndUpdateDashboard();

  // Refresh data every 10 seconds
  setInterval(() => fetchAndUpdateDashboard(false), 10000);

  // Show welcome message for new users
  if (document.querySelector('#sites-grid .col-span-full, #sites-table tbody tr td[colspan="8"]')) {
    setTimeout(() => {
      showToast('Welcome! Add your first website to start monitoring.', 'info');
    }, 1000);
  }
});
