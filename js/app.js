// ==========================================================================
// Toko Berkah Sekar - Application Controller & Orchestrator
// Navigation Router, Theme Manager, Modal Manager, Settings, Backup/Restore
// ==========================================================================

class AppController {
  constructor() {
    this.activeTab = 'pos';
    this.theme = 'dark';
  }

  async init() {
    console.log('Initializing Toko Berkah Sekar...');

    try {
      // 1. Initialize Auth and DB
      await window.db.isReady;
      if (window.auth) await window.auth.init();

      // 2. Load Theme
      const savedTheme = await window.db.getSetting('theme', 'dark');
      this.setTheme(savedTheme);

      // Check Login State
      if (!window.auth.isLoggedIn) {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        await this.populateUserDropdown();
      } else {
        await this.onLoginSuccess();
      }
    } catch (err) {
      console.error('Fatal initialization error:', err);
      this.showToast('Gagal memuat sistem: ' + err.message, 'error');
    }
  }

  async populateUserDropdown() {
    const users = await window.auth.getUsers();
    const select = document.getElementById('login-username');
    if (select) {
      select.innerHTML = '<option value="" disabled selected>Pilih Pengguna</option>';
      users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.username;
        opt.textContent = `${u.name} (${u.role === 'owner' ? 'Pemilik' : 'Kasir'})`;
        select.appendChild(opt);
      });
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const pin = document.getElementById('login-pin').value;
    
    if (!username || !pin) {
      this.showToast('Pilih pengguna dan masukkan PIN', 'error');
      return;
    }

    const result = await window.auth.login(username, pin);
    if (result.success) {
      document.getElementById('login-pin').value = '';
      await this.onLoginSuccess();
      this.showToast(`Selamat datang, ${result.user.name}!`, 'success');
    } else {
      this.showToast(result.message, 'error');
      document.getElementById('login-pin').value = '';
    }
  }

  async onLoginSuccess() {
    const overlay = document.getElementById('login-overlay');
    if (!overlay.classList.contains('hidden')) {
      overlay.classList.add('animate-fade-out');
      setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('animate-fade-out');
      }, 300); // Wait for animation to finish
    }
    
    document.getElementById('app-container').classList.remove('hidden');
    window.auth.updateUI();

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
    console.log('Toko Berkah Sekar initialized successfully!');
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
    
    // Also refresh users list when settings are loaded
    this.renderUsersList();
  }

  async saveSettings() {
    const storeName = document.getElementById('settings-store-name').value.trim() || 'Toko Berkah Sekar';
    const storeAddress = document.getElementById('settings-store-address').value.trim();
    const storePhone = document.getElementById('settings-store-phone').value.trim();
    const receiptFooter = document.getElementById('settings-receipt-footer').value.trim();
    const printerWidth = document.getElementById('settings-printer-width').value;
    const tgToken = document.getElementById('settings-tg-token').value.trim();
    const tgChatId = document.getElementById('settings-tg-chat-id').value.trim();

    await window.db.setSetting('storeName', storeName);
    await window.db.setSetting('storeAddress', storeAddress);
    await window.db.setSetting('storePhone', storePhone);
    await window.db.setSetting('receiptFooter', receiptFooter);
    await window.db.setSetting('printerWidth', printerWidth);
    await window.db.setSetting('telegramBotToken', tgToken);
    await window.db.setSetting('telegramChatId', tgChatId);

    // Update Header Brand
    const headerTitle = document.getElementById('header-store-name');
    if (headerTitle) headerTitle.textContent = storeName;

    this.showToast('Pengaturan toko berhasil disimpan!', 'success');
  }

  async testTelegram() {
    const tgToken = document.getElementById('settings-tg-token').value.trim();
    const tgChatId = document.getElementById('settings-tg-chat-id').value.trim();
    
    if (!tgToken || !tgChatId) {
      this.showToast('Harap isi Telegram Bot Token dan Chat ID terlebih dahulu.', 'error');
      return;
    }
    
    this.showToast('Mengirim tes pesan ke Telegram...', 'info');
    try {
      const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: '🔔 Tes Notifikasi Berhasil dari Toko Berkah Sekar!',
          parse_mode: 'Markdown'
        })
      });

      const data = await response.json();
      if (data.ok) {
        this.showToast('Pesan Telegram berhasil terkirim!', 'success');
      } else {
        console.warn('Telegram API Error:', data.description);
        this.showToast('Gagal: ' + data.description, 'error');
      }
    } catch (err) {
      console.error('Gagal mengirim Telegram notification:', err);
      this.showToast('Koneksi gagal atau token tidak valid.', 'error');
    }
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
      this.showToast('Gagal ekspor database: ' + e.message, 'error');
    }
  }

  async importBackupFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await window.db.importFullDatabase(e.target.result);
        this.showToast('Data berhasil dipulihkan! Memuat ulang sistem...', 'success');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        this.showToast('Gagal impor! File tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
  }

  // --- USER MANAGEMENT ---
  async renderUsersList() {
    const container = document.getElementById('users-list-container');
    if (!container) return;

    if (!window.auth.isOwner()) {
      container.innerHTML = '<div class="empty-state">Akses ditolak.</div>';
      return;
    }

    try {
      const users = await window.auth.getUsers();
      if (!users || users.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada pengguna.</div>';
        return;
      }

      container.innerHTML = users.map(u => `
        <div class="data-item">
          <div>
            <div style="font-weight: 600;">${u.name}</div>
            <div class="text-xs text-muted">@${u.username} • Role: ${u.role === 'owner' ? 'Pemilik' : 'Kasir'}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.app.openUserModal(${u.id})">Edit</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger-500); border-color:var(--danger-500);" onclick="window.app.deleteUser(${u.id})">Hapus</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Gagal memuat: ${e.message}</div>`;
    }
  }

  async openUserModal(userId = null) {
    document.getElementById('user-form-id').value = userId || '';
    if (userId) {
      document.getElementById('user-modal-title').textContent = 'Edit Pengguna';
      const users = await window.auth.getUsers();
      const user = users.find(u => u.id === userId);
      if (user) {
        document.getElementById('user-form-name').value = user.name;
        document.getElementById('user-form-username').value = user.username;
        document.getElementById('user-form-pin').value = user.pin;
        document.getElementById('user-form-role').value = user.role;
      }
    } else {
      document.getElementById('user-modal-title').textContent = 'Tambah Pengguna';
      document.getElementById('user-form').reset();
    }
    this.openModal('user-form-modal');
  }

  async saveUser(e) {
    e.preventDefault();
    const id = document.getElementById('user-form-id').value;
    const name = document.getElementById('user-form-name').value.trim();
    const username = document.getElementById('user-form-username').value.trim();
    const pin = document.getElementById('user-form-pin').value.trim();
    const role = document.getElementById('user-form-role').value;

    const userObj = { name, username, pin, role };
    if (id) userObj.id = Number(id);

    try {
      if (id) {
        await window.auth.updateUser(userObj);
        this.showToast('Pengguna berhasil diperbarui', 'success');
      } else {
        await window.auth.addUser(userObj);
        this.showToast('Pengguna berhasil ditambahkan', 'success');
      }
      this.closeModal('user-form-modal');
      this.renderUsersList();
      this.populateUserDropdown(); // refresh dropdown in case we go to login screen later
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  async deleteUser(userId) {
    if (confirm('Yakin ingin menghapus pengguna ini?')) {
      try {
        await window.auth.deleteUser(userId);
        this.showToast('Pengguna berhasil dihapus', 'success');
        this.renderUsersList();
        this.populateUserDropdown();
      } catch (error) {
        this.showToast(error.message, 'error');
      }
    }
  }

  setupGlobalEvents() {
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
