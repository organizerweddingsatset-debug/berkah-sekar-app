// ==========================================================================
// Toko Berkah Sekar - Debts & Receivables (Buku Kasbon & Hutang Toko)
// WhatsApp Reminder Generator, Installment Tracking, Supplier & Customer Logs
// ==========================================================================

class DebtManager {
  constructor() {
    this.activeType = 'receivable'; // 'receivable' (piutang pelanggan) | 'payable' (hutang supplier)
    this.statusFilter = 'unpaid'; // 'unpaid' | 'all'
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
    await this.renderDebts();
  }

  setupListeners() {
    // Type tabs (Piutang vs Hutang)
    document.querySelectorAll('.debt-type-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.debt-type-tab').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeType = e.currentTarget.dataset.type;
        this.renderDebts();
      });
    });

    const btnAdd = document.getElementById('btn-add-debt');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        this.openDebtFormModal();
      });
    }
  }

  async renderDebts() {
    const container = document.getElementById('debts-list-container');
    const totalReceivableDisplay = document.getElementById('total-receivables-stat');
    const totalPayableDisplay = document.getElementById('total-payables-stat');
    if (!container) return;

    const allDebts = await window.db.getAll('debts');

    // Calculate global stats
    const totalReceivables = allDebts
      .filter(d => d.type === 'receivable' && d.status !== 'paid')
      .reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
    
    const totalPayables = allDebts
      .filter(d => d.type === 'payable' && d.status !== 'paid')
      .reduce((sum, d) => sum + (d.remainingAmount || 0), 0);

    if (totalReceivableDisplay) totalReceivableDisplay.textContent = this.formatRupiah(totalReceivables);
    if (totalPayableDisplay) totalPayableDisplay.textContent = this.formatRupiah(totalPayables);

    // Filter by Active Type
    let debts = allDebts.filter(d => d.type === this.activeType);

    // Filter by Status if not all
    if (this.statusFilter === 'unpaid') {
      debts = debts.filter(d => d.status !== 'paid');
    }

    // Sort newest first
    debts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (debts.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 40px 20px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🤝</div>
          <div style="font-weight: 600;">Tidak ada catatan ${this.activeType === 'receivable' ? 'piutang pelanggan' : 'hutang supplier'}</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Semua tagihan lunas atau belum ada catatan baru.</div>
        </div>
      `;
      return;
    }

    let html = '';
    debts.forEach(d => {
      const isPaid = d.status === 'paid';
      const isOverdue = d.dueDate && new Date(d.dueDate) < new Date() && !isPaid;

      html += `
        <div class="data-row" style="flex-direction: column; align-items: stretch; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="data-row-title">${d.personName}</span>
                ${isPaid ? '<span class="badge badge-success">Lunas</span>' : 
                  (isOverdue ? '<span class="badge badge-danger">Lewat Jatuh Tempo</span>' : '<span class="badge badge-warning">Belum Lunas</span>')}
              </div>
              <div class="data-row-sub">
                ${d.phone ? `📱 ${d.phone} • ` : ''}Dibuat: ${d.createdAt || '-'}
                ${d.dueDate ? ` • Jatuh Tempo: ${d.dueDate}` : ''}
              </div>
              ${d.notes ? `<div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">📝 ${d.notes}</div>` : ''}
            </div>

            <div style="text-align: right;">
              <div class="stat-label">Sisa Tagihan</div>
              <div class="font-mono font-bold ${isPaid ? 'text-primary' : 'text-danger'}" style="font-size: 1.1rem;">
                ${this.formatRupiah(d.remainingAmount)}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">
                Total: ${this.formatRupiah(d.totalAmount)}
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
            ${!isPaid ? `
              <button class="btn btn-primary btn-sm" onclick="window.debts.openPaymentModal(${d.id})">
                💳 Bayar Cicilan
              </button>
            ` : ''}
            
            ${d.type === 'receivable' && !isPaid ? `
              <button class="btn btn-secondary btn-sm" style="color: #22c55e;" onclick="window.debts.sendWhatsAppReminder(${d.id})">
                💬 Tagih via WA
              </button>
            ` : ''}

            <button class="btn btn-outline btn-sm" onclick="window.debts.deleteDebt(${d.id})">
              Hapus
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // Open Form Modal
  openDebtFormModal() {
    const form = document.getElementById('debt-form');
    form.reset();
    document.getElementById('debt-form-type').value = this.activeType;
    document.getElementById('debt-form-due-date').value = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const title = document.getElementById('debt-form-modal-title');
    title.textContent = this.activeType === 'receivable' ? 'Tambah Catatan Piutang Pelanggan' : 'Tambah Catatan Hutang Supplier';
    
    window.app.openModal('debt-form-modal');
  }

  async saveDebt() {
    const type = document.getElementById('debt-form-type').value;
    const personName = document.getElementById('debt-form-name').value.trim();
    const phone = document.getElementById('debt-form-phone').value.trim();
    const totalAmount = parseFloat(document.getElementById('debt-form-amount').value) || 0;
    const dueDate = document.getElementById('debt-form-due-date').value;
    const notes = document.getElementById('debt-form-notes').value.trim();

    if (!personName) {
      window.app.showToast('Nama wajib diisi', 'error');
      return;
    }
    if (totalAmount <= 0) {
      window.app.showToast('Nominal hutang/piutang harus lebih dari 0', 'error');
      return;
    }

    await window.db.add('debts', {
      type,
      personName,
      phone,
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      dueDate,
      notes,
      status: 'unpaid',
      createdAt: new Date().toISOString().split('T')[0],
      payments: []
    });

    window.app.showToast('Catatan berhasil ditambahkan!', 'success');
    window.app.closeModal('debt-form-modal');
    this.renderDebts();
  }

  // --- RECORD PAYMENT / INSTALLMENT ---
  async openPaymentModal(debtId) {
    const debt = await window.db.getById('debts', debtId);
    if (!debt) return;

    document.getElementById('pay-debt-id').value = debt.id;
    document.getElementById('pay-debt-person').textContent = debt.personName;
    document.getElementById('pay-debt-remaining').textContent = this.formatRupiah(debt.remainingAmount);
    document.getElementById('pay-debt-amount').value = debt.remainingAmount;
    document.getElementById('pay-debt-notes').value = '';

    window.app.openModal('debt-payment-modal');
  }

  async saveDebtPayment() {
    const id = parseInt(document.getElementById('pay-debt-id').value);
    const amount = parseFloat(document.getElementById('pay-debt-amount').value) || 0;
    const notes = document.getElementById('pay-debt-notes').value.trim();

    if (amount <= 0) {
      window.app.showToast('Nominal pembayaran tidak valid', 'error');
      return;
    }

    const debt = await window.db.getById('debts', id);
    if (!debt) return;

    debt.paidAmount = (debt.paidAmount || 0) + amount;
    debt.remainingAmount = Math.max(0, debt.totalAmount - debt.paidAmount);
    debt.status = debt.remainingAmount === 0 ? 'paid' : 'partial';

    if (!debt.payments) debt.payments = [];
    debt.payments.push({
      date: new Date().toISOString(),
      amount,
      notes: notes || 'Pembayaran cicilan'
    });

    await window.db.update('debts', debt);

    window.app.showToast(debt.status === 'paid' ? 'Tagihan berhasil LUNAS! 🎉' : 'Pembayaran cicilan berhasil dicatat', 'success');
    window.app.closeModal('debt-payment-modal');
    this.renderDebts();
  }

  // Send WhatsApp Reminder
  async sendWhatsAppReminder(debtId) {
    const debt = await window.db.getById('debts', debtId);
    if (!debt) return;

    const url = await window.notifications.createDebtReminderWhatsAppURL(debt);
    window.open(url, '_blank');
  }

  async deleteDebt(id) {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      await window.db.delete('debts', id);
      window.app.showToast('Catatan berhasil dihapus', 'info');
      this.renderDebts();
    }
  }
}

window.debts = new DebtManager();
