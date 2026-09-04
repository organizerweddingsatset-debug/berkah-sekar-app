// ==========================================================================
// TokoKu POS - Reports & Financial Analytics
// Profit/Loss Calculation, Omset Chart, Top Products, Excel/CSV Export
// ==========================================================================

class ReportsManager {
  constructor() {
    this.dateFilter = 'today'; // 'today' | 'yesterday' | '7days' | 'this_month' | 'all'
    this.chartInstance = null;
  }

  formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num || 0);
  }

  async init() {
    this.setupListeners();
    await this.renderAllReports();
  }

  setupListeners() {
    const filterSelect = document.getElementById('report-date-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.dateFilter = e.target.value;
        this.renderAllReports();
      });
    }

    const btnExport = document.getElementById('btn-export-excel');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        window.auth.requireOwner(() => {
          this.exportToCSV();
        });
      });
    }

    const btnSendDailyTG = document.getElementById('btn-send-daily-tg');
    if (btnSendDailyTG) {
      btnSendDailyTG.addEventListener('click', async () => {
        window.auth.requireOwner(async () => {
          const reportData = await this.getCalculatedReportData();
          window.notifications.notifyDailySummary(reportData);
        });
      });
    }
  }

  getDateRange() {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (this.dateFilter === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (this.dateFilter === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (this.dateFilter === '7days') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (this.dateFilter === 'this_month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setTime(0); // All time
    }

    return { start, end };
  }

  async getCalculatedReportData() {
    const { start, end } = this.getDateRange();
    const allTrx = await window.db.getAll('transactions');
    const allExpenses = await window.db.getAll('expenses');
    const allDebts = await window.db.getAll('debts');

    // Filter Transactions
    const filteredTrx = allTrx.filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    // Filter Expenses
    const filteredExpenses = allExpenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });

    // Filter Unpaid Debts in period
    const unpaidDebts = allDebts
      .filter(d => d.type === 'receivable' && d.status !== 'paid')
      .reduce((sum, d) => sum + (d.remainingAmount || 0), 0);

    const totalRevenue = filteredTrx.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalCost = filteredTrx.reduce((sum, t) => sum + (t.totalCost || 0), 0);
    const grossProfit = totalRevenue - totalCost;
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = grossProfit - totalExpenses;
    const totalTransactions = filteredTrx.length;
    const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return {
      filteredTrx,
      filteredExpenses,
      totalRevenue,
      totalCost,
      grossProfit,
      totalExpenses,
      netProfit,
      totalTransactions,
      avgOrderValue,
      unpaidDebts
    };
  }

  async renderAllReports() {
    const isOwner = window.auth.isOwner();
    const data = await this.getCalculatedReportData();

    // Update Stat Widgets
    const omsetEl = document.getElementById('report-stat-revenue');
    const trxCountEl = document.getElementById('report-stat-trx-count');
    const hppEl = document.getElementById('report-stat-cost');
    const expenseEl = document.getElementById('report-stat-expense');
    const netProfitEl = document.getElementById('report-stat-net-profit');

    if (omsetEl) omsetEl.textContent = this.formatRupiah(data.totalRevenue);
    if (trxCountEl) trxCountEl.textContent = `${data.totalTransactions} Trx`;
    
    // Restricted metrics for owner only
    if (hppEl) hppEl.textContent = isOwner ? this.formatRupiah(data.totalCost) : '***';
    if (expenseEl) expenseEl.textContent = isOwner ? this.formatRupiah(data.totalExpenses) : '***';
    if (netProfitEl) {
      if (isOwner) {
        netProfitEl.textContent = this.formatRupiah(data.netProfit);
        netProfitEl.style.color = data.netProfit >= 0 ? 'var(--primary-400)' : 'var(--danger-500)';
      } else {
        netProfitEl.textContent = 'Akses Terkunci';
      }
    }

    this.renderSalesTrendChart(data.filteredTrx);
    this.renderTopSellingProducts(data.filteredTrx);
    this.renderRecentTransactionsTable(data.filteredTrx);
  }

  // Draw Simple Responsive Canvas Trend Line Chart
  renderSalesTrendChart(transactions) {
    const canvas = document.getElementById('sales-trend-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth || 320);
    const height = (canvas.height = 160);

    ctx.clearRect(0, 0, width, height);

    // Group sales by day/hour
    const buckets = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('id-ID', { weekday: 'short' });
      buckets[key] = 0;
    }

    transactions.forEach(t => {
      const d = new Date(t.date);
      const key = d.toLocaleDateString('id-ID', { weekday: 'short' });
      if (buckets[key] !== undefined) {
        buckets[key] += t.totalAmount || 0;
      }
    });

    const labels = Object.keys(buckets);
    const values = Object.values(buckets);
    const maxVal = Math.max(...values, 10000);

    const padding = 25;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padding + (chartH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw Gradient Area & Line
    const points = values.map((val, idx) => {
      const x = padding + (chartW / (values.length - 1)) * idx;
      const y = height - padding - (val / maxVal) * chartH;
      return { x, y, val };
    });

    if (points.length > 1) {
      // Area Gradient
      const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, height - padding);
      ctx.lineTo(points[0].x, height - padding);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw Dots and Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';

      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.fillText(labels[i], p.x, height - 8);
      });
    }
  }

  // Top Selling Items
  renderTopSellingProducts(transactions) {
    const container = document.getElementById('top-selling-products-list');
    if (!container) return;

    const itemMap = {};
    transactions.forEach(t => {
      (t.items || []).forEach(item => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = { name: item.name, totalQty: 0, totalSales: 0 };
        }
        itemMap[item.name].totalQty += item.qty;
        itemMap[item.name].totalSales += item.subtotal;
      });
    });

    const sortedItems = Object.values(itemMap).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);

    if (sortedItems.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="padding: 16px;">Belum ada data penjualan pada periode ini.</div>`;
      return;
    }

    let html = '';
    sortedItems.forEach((item, idx) => {
      html += `
        <div class="data-row" style="padding: 8px 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-weight: 800; font-size: 0.9rem; color: var(--primary-400); width: 20px;">#${idx + 1}</div>
            <div>
              <div style="font-weight: 600; font-size: 0.85rem;">${item.name}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Terjual: ${item.totalQty} item</div>
            </div>
          </div>
          <div class="font-mono font-bold" style="font-size: 0.85rem;">
            ${this.formatRupiah(item.totalSales)}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Recent Transactions List
  renderRecentTransactionsTable(transactions) {
    const container = document.getElementById('recent-transactions-list');
    if (!container) return;

    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

    if (sorted.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="padding: 24px;">Tidak ada transaksi pada periode ini</div>`;
      return;
    }

    let html = '';
    sorted.forEach(t => {
      const itemCount = (t.items || []).reduce((sum, i) => sum + i.qty, 0);
      html += `
        <div class="data-row">
          <div class="data-row-main">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="data-row-title">${t.id}</span>
              <span class="badge ${t.paymentMethod === 'debt' ? 'badge-warning' : 'badge-success'}">
                ${t.paymentMethod.toUpperCase()}
              </span>
            </div>
            <div class="data-row-sub">
              ${new Date(t.date).toLocaleDateString('id-ID')} ${new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • ${itemCount} barang
            </div>
          </div>
          <div class="data-row-end">
            <div class="font-mono font-bold" style="font-size: 0.95rem;">
              ${this.formatRupiah(t.totalAmount)}
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 0.72rem;" onclick="window.pos.openSuccessModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">
              Struk
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Export to CSV / Excel
  async exportToCSV() {
    const transactions = await window.db.getAll('transactions');
    if (transactions.length === 0) {
      window.app.showToast('Belum ada transaksi untuk diekspor', 'warning');
      return;
    }

    let csvContent = 'No Transaksi,Tanggal,Metode Pembayaran,Kasir,Pelanggan,Total Belanja,Modal HPP,Estimasi Laba,Detail Barang\n';

    transactions.forEach(t => {
      const itemsDetail = (t.items || []).map(i => `${i.name} (${i.qty}x)`).join('; ');
      const cleanItems = `"${itemsDetail.replace(/"/g, '""')}"`;
      const dateStr = new Date(t.date).toLocaleString('id-ID');
      
      csvContent += `${t.id},"${dateStr}",${t.paymentMethod},"${t.cashierName || ''}","${t.customerName || ''}",${t.totalAmount || 0},${t.totalCost || 0},${t.totalProfit || 0},${cleanItems}\n`;
    });

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Penjualan_TokoKu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.app.showToast('Laporan berhasil diekspor ke format Excel (.CSV)!', 'success');
  }
}

window.reports = new ReportsManager();
