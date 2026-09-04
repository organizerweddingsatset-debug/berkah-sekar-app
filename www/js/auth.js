// ==========================================================================
// TokoKu POS - Authentication & Role-Based Access Control (RBAC)
// Role Owner (full access) vs Kasir (restricted) with PIN Protection
// ==========================================================================

class AuthManager {
  constructor() {
    this.currentRole = 'owner'; // 'owner' | 'cashier'
    this.currentUser = 'Pemilik Toko';
    this.isLocked = false;
    this.pendingAction = null;
  }

  async init() {
    const savedRole = await window.db.getSetting('activeRole', 'owner');
    this.currentRole = savedRole;
    this.currentUser = savedRole === 'owner' ? 'Pemilik Toko' : 'Kasir Utama';
    this.updateUI();
  }

  getRole() {
    return this.currentRole;
  }

  isOwner() {
    return this.currentRole === 'owner';
  }

  async switchRole(targetRole) {
    if (targetRole === 'owner') {
      // Must enter Owner PIN
      this.promptPin('Masukkan PIN Pemilik Toko', async (enteredPin) => {
        const correctPin = await window.db.getSetting('ownerPin', '1234');
        if (enteredPin === correctPin) {
          this.currentRole = 'owner';
          this.currentUser = 'Pemilik Toko';
          await window.db.setSetting('activeRole', 'owner');
          this.updateUI();
          window.app.showToast('Berhasil login sebagai Pemilik Toko', 'success');
          return true;
        } else {
          window.app.showToast('PIN Pemilik salah!', 'error');
          return false;
        }
      });
    } else {
      this.currentRole = 'cashier';
      this.currentUser = 'Kasir Utama';
      await window.db.setSetting('activeRole', 'cashier');
      this.updateUI();
      window.app.showToast('Beralih ke mode Kasir (Akses Terbatas)', 'info');
      // If currently on a restricted tab (like reports or settings), switch to POS
      if (window.app.activeTab === 'reports' || window.app.activeTab === 'settings') {
        window.app.switchTab('pos');
      }
    }
  }

  async requireOwner(actionCallback) {
    if (this.isOwner()) {
      actionCallback();
      return;
    }

    // Kasir trying to access owner feature -> request Owner PIN
    this.promptPin('Akses Khusus Pemilik - Masukkan PIN', async (enteredPin) => {
      const correctPin = await window.db.getSetting('ownerPin', '1234');
      if (enteredPin === correctPin) {
        actionCallback();
        return true;
      } else {
        window.app.showToast('PIN Pemilik salah! Akses ditolak.', 'error');
        return false;
      }
    });
  }

  promptPin(title, callback) {
    const pinOverlay = document.getElementById('pin-overlay');
    const pinTitle = document.getElementById('pin-title');
    const pinDots = document.querySelectorAll('.pin-dot');
    
    let enteredDigits = '';
    pinTitle.textContent = title;
    pinOverlay.classList.remove('hidden');

    const updateDots = () => {
      pinDots.forEach((dot, index) => {
        if (index < enteredDigits.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      });
    };

    updateDots();

    // Clean previous handler
    window.onPinKeyPress = async (digit) => {
      if (digit === 'clear') {
        enteredDigits = '';
        updateDots();
        return;
      }
      if (digit === 'backspace') {
        enteredDigits = enteredDigits.slice(0, -1);
        updateDots();
        return;
      }
      if (digit === 'cancel') {
        pinOverlay.classList.add('hidden');
        return;
      }

      if (enteredDigits.length < 4) {
        enteredDigits += digit;
        updateDots();

        if (enteredDigits.length === 4) {
          // Check PIN
          setTimeout(async () => {
            const success = await callback(enteredDigits);
            if (success) {
              pinOverlay.classList.add('hidden');
            } else {
              enteredDigits = '';
              updateDots();
            }
          }, 150);
        }
      }
    };
  }

  updateUI() {
    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) {
      if (this.currentRole === 'owner') {
        roleBadge.className = 'badge-role badge-owner';
        roleBadge.textContent = 'Owner';
      } else {
        roleBadge.className = 'badge-role badge-cashier';
        roleBadge.textContent = 'Kasir';
      }
    }

    // Toggle visibility of restricted elements (like cost price in inventory)
    document.querySelectorAll('.owner-only').forEach(el => {
      if (this.isOwner()) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }
}

window.auth = new AuthManager();
