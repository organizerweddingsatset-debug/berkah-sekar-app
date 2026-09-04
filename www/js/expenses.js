// ==========================================================================
// TokoKu POS - Operational Expenses Management
// Track Store Overhead (Electricity, Rent, Wages, Packaging, Transport)
// ==========================================================================

class ExpenseManager {
  constructor() {
    this.selectedMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
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
    await this.renderExpenses();
  }

  setupListeners() {
    const monthPicker = document.getElementById('expense-month-picker');
    if (monthPicker) {
      monthPicker.value = this.selectedMonth;
      monthPicker.addEventListener('change', (e) => {
        this.selectedMonth = e.target.value;
        this.renderExpenses();
      });
    }

    const btnAdd = document.getElementById('btn-add-expense');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        this.openExpenseModal();
      });
    }
  }

  async renderExpenses() {
    const container = document.getElementById('expenses-list-container');
    const totalDisplay = document.getElementById('expense-total-display');
    if (!container) return;

    let expenses = await window.db.getAll('expenses');
    
    // Filter by selected month (YYYY-MM)
    if (this.selectedMonth) {
      expenses = expenses.filter(e => e.date && e.date.startsWith(this.selectedMonth));
    }

    // Sort newest first
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    if (totalDisplay) {
      totalDisplay.textContent = this.formatRupiah(totalAmount);
    }

    if (expenses.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 40px 20px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">💸</div>
          <div style="font-weight: 600;">Belum ada catatan pengeluaran di bulan ini</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Klik tombol "+ Catat Pengeluaran" untuk menambahkan.</div>
        </div>
      `;
      return;
    }

    let html = '';
    expenses.forEach(e => {
      html += `
        <div class="data-row">
          <div class="data-row-main">
            <div class="data-row-title">${e.category}</div>
            <div class="data-row-sub">
              ${new Date(e.date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
              ${e.notes ? `• ${e.notes}` : ''}
            </div>
          </div>
          <div class="data-row-end">
            <div class="font-mono font-bold text-danger" style="font-size: 1rem;">
              -${this.formatRupiah(e.amount)}
            </div>
            <button class="btn btn-outline btn-sm" style="margin-top: 4px; padding: 2px 8px; font-size: 0.72rem;" onclick="window.expenses.deleteExpense(${e.id})">
              Hapus
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  openExpenseModal() {
    const form = document.getElementById('expense-form');
    form.reset();
    document.getElementById('expense-date-input').value = new Date().toISOString().split('T')[0];
    window.app.openModal('expense-modal');
  }

  async saveExpense() {
    const category = document.getElementById('expense-category-select').value;
    const amount = parseFloat(document.getElementById('expense-amount-input').value) || 0;
    const date = document.getElementById('expense-date-input').value;
    const notes = document.getElementById('expense-notes-input').value.trim();

    if (amount <= 0) {
      window.app.showToast('Masukkan jumlah nominal pengeluaran yang valid', 'error');
      return;
    }

    await window.db.add('expenses', {
      category,
      amount,
      date: date || new Date().toISOString().split('T')[0],
      notes,
      createdBy: window.auth.currentUser
    });

    window.app.showToast('Catatan pengeluaran berhasil disimpan!', 'success');
    window.app.closeModal('expense-modal');
    await this.renderExpenses();
    if (window.reports) window.reports.renderAllReports();
  }

  async deleteExpense(id) {
    if (confirm('Hapus catatan pengeluaran ini?')) {
      await window.db.delete('expenses', id);
      window.app.showToast('Pengeluaran berhasil dihapus', 'info');
      await this.renderExpenses();
      if (window.reports) window.reports.renderAllReports();
    }
  }
}

window.expenses = new ExpenseManager();
