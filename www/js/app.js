// ==========================================================================
// TokoKu POS - Application Controller & Orchestrator
// Navigation Router, Theme Manager, Modal Manager, Settings, Backup/Restore
// ==========================================================================

class AppController {
  constructor() {
    this.activeTab = 'pos';
    this.theme = 'dark';
  }

  async init() {
    console.log('Initializing TokoKu POS...');

    try {
      // 1. Initialize Auth and DB
      await window.db.isReady;
      if (window.auth) await window.auth.init();

      // 2. Load Theme
      const savedTheme = await window.db.getSetting('theme', 'dark');
      this.setTheme(savedTheme);

      // 3. Setup Tab Navigation
      this.setupNavigation();

      // 4. Initialize Sub-modules safely
      if (window.pos) await window.pos.init();
      if (window.products) await window.products.init();
      if (window.expenses) await window.expenses.init();
      if (window.debts) await window.debts.init();
      if (window.reports) await window.reports.init();
      await this.loadSettingsToForm();

      // 5. Register Service Worker for PWA Offline
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => {
          console.log('PWA Service Worker registered successfully.');
        }).catch(err => {
          console.warn('Service Worker registration failed:', err);
        });
      }

      this.setupGlobalEvents();
      console.log('TokoKu POS initialized successfully!');
    } catch (err) {
      console.error('Fatal initialization error:', err);
      this.showToast('Gagal memuat sistem: ' + err.message, 'error');
    }
  }

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabName) {
    // Role check: Kasir cannot access reports or settings without owner PIN
    if ((tabName === 'reports' || tabName === 'settings') && window.auth && !window.auth.isOwner()) {
      window.auth.requireOwner(() => {
        this.executeSwitchTab(tabName);
      });
      return;
    }

    this.executeSwitchTab(tabName);
  }

  executeSwitchTab(tabName) {
    this.activeTab = tabName;

    // Update Bottom Nav UI
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update Views
    document.querySelectorAll('.app-view').forEach(view => {
      view.classList.add('hidden');
    });

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) {
      activeView.classList.remove('hidden');
    }

    // Refresh view specific data
    if (tabName === 'pos' && window.pos) window.pos.renderProducts();
    if (tabName === 'inventory' && window.products) window.products.renderProductsList();
    if (tabName === 'expenses' && window.expenses) window.expenses.renderExpenses();
    if (tabName === 'debts' && window.debts) window.debts.renderDebts();
    if (tabName === 'reports' && window.reports) window.reports.renderAllReports();
    if (tabName === 'settings') this.loadSettingsToForm();
  }

  // --- THEME MANAGEMENT ---
  setTheme(themeName) {
    this.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (themeIcon) {
      themeIcon.textContent = themeName === 'dark' ? '☀️' : '🌙';
    }
  }

  async toggleTheme() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    await window.db.setSetting('theme', newTheme);
    this.showToast(`Mode ${newTheme === 'dark' ? 'Gelap' : 'Terang'} aktif`, 'info');
  }

  // --- MODAL HELPERS ---
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // --- TOAST NOTIFICATIONS ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --- SETTINGS FORM ---
  async loadSettingsToForm() {
    const storeName = await window.db.getSetting('storeName', 'Toko Berkah Sejahtera');
    const storeAddress = await window.db.getSetting('storeAddress', 'Jl. Merdeka No. 45');
    const storePhone = await window.db.getSetting('storePhone', '081234567890');
    const receiptFooter = await window.db.getSetting('receiptFooter', 'Terima kasih telah berbelanja!');
    const printerWidth = await window.db.getSetting('printerWidth', '58mm');
    const tgToken = await window.db.getSetting('telegramBotToken', '');
    const tgChatId = await window.db.getSetting('telegramChatId', '');
    const ownerPin = await window.db.getSetting('ownerPin', '1234');
    const cashierPin = await window.db.getSetting('cashierPin', '0000');

    // Update Header Brand
    const headerTitle = document.getElementById('header-store-name');
    if (headerTitle) headerTitle.textContent = storeName;

    if (document.getElementById('settings-store-name')) document.getElementById('settings-store-name').value = storeName;
    if (document.getElementById('settings-store-address')) document.getElementById('settings-store-address').value = storeAddress;
    if (document.getElementById('settings-store-phone')) document.getElementById('settings-store-phone').value = storePhone;
    if (document.getElementById('settings-receipt-footer')) document.getElementById('settings-receipt-footer').value = receiptFooter;
    if (document.getElementById('settings-printer-width')) document.getElementById('settings-printer-width').value = printerWidth;
    if (document.getElementById('settings-tg-token')) document.getElementById('settings-tg-token').value = tgToken;
    if (document.getElementById('settings-tg-chat-id')) document.getElementById('settings-tg-chat-id').value = tgChatId;
    if (document.getElementById('settings-owner-pin')) document.getElementById('settings-owner-pin').value = ownerPin;
    if (document.getElementById('settings-cashier-pin')) document.getElementById('settings-cashier-pin').value = cashierPin;
  }

  async saveSettings() {
    const storeName = document.getElementById('settings-store-name').value.trim() || 'TokoKu POS';
    const storeAddress = document.getElementById('settings-store-address').value.trim();
    const storePhone = document.getElementById('settings-store-phone').value.trim();
    const receiptFooter = document.getElementById('settings-receipt-footer').value.trim();
    const printerWidth = document.getElementById('settings-printer-width').value;
    const tgToken = document.getElementById('settings-tg-token').value.trim();
    const tgChatId = document.getElementById('settings-tg-chat-id').value.trim();
    const ownerPin = document.getElementById('settings-owner-pin').value.trim() || '1234';
    const cashierPin = document.getElementById('settings-cashier-pin').value.trim() || '0000';

    await window.db.setSetting('storeName', storeName);
    await window.db.setSetting('storeAddress', storeAddress);
    await window.db.setSetting('storePhone', storePhone);
    await window.db.setSetting('receiptFooter', receiptFooter);
    await window.db.setSetting('printerWidth', printerWidth);
    await window.db.setSetting('telegramBotToken', tgToken);
    await window.db.setSetting('telegramChatId', tgChatId);
    await window.db.setSetting('ownerPin', ownerPin);
    await window.db.setSetting('cashierPin', cashierPin);

    // Update Header Brand
    const headerTitle = document.getElementById('header-store-name');
    if (headerTitle) headerTitle.textContent = storeName;

    this.showToast('Pengaturan toko berhasil disimpan!', 'success');
  }

  // --- BACKUP & RESTORE ---
  async exportBackupFile() {
    try {
      const json = await window.db.exportFullDatabase();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Backup_TokoKu_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('Backup database berhasil didownload!', 'success');
    } catch (e) {
      console.error(e);
      this.showToast('Gagal membuat backup database', 'error');
    }
  }

  async importBackupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await window.db.importFullDatabase(e.target.result);
        this.showToast('Database berhasil dipulihkan dari file backup!', 'success');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        this.showToast('Gagal memulihkan database. File tidak sesuai format.', 'error');
      }
    };
    reader.readAsText(file);
  }

  setupGlobalEvents() {
    // Role switch click from header badge
    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
      roleBadge.onclick = () => {
        const nextRole = window.auth.isOwner() ? 'cashier' : 'owner';
        window.auth.switchRole(nextRole);
      };
    }

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.onclick = (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('active');
          if (backdrop.id === 'scanner-modal' && window.pos) {
            window.pos.closeBarcodeScannerModal();
          }
        }
      };
    });
  }
}

window.app = new AppController();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.app.init());
} else {
  window.app.init();
}
