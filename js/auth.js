// ==========================================================================
// Toko Berkah Sekar - Authentication & Role-Based Access Control (RBAC)
// Offline-First Login System (IndexedDB)
// ==========================================================================

class AuthManager {
  constructor() {
    this.currentUserObj = null;
    this.isLoggedIn = false;
  }

  async init() {
    // Check if a session exists in sessionStorage
    const savedUser = sessionStorage.getItem('tokoku_user');
    if (savedUser) {
      try {
        this.currentUserObj = JSON.parse(savedUser);
        this.isLoggedIn = true;
      } catch (e) {
        this.isLoggedIn = false;
        this.currentUserObj = null;
      }
    }
  }

  getRole() {
    return this.currentUserObj ? this.currentUserObj.role : null;
  }

  isOwner() {
    return this.getRole() === 'owner';
  }

  // --- LOGIN & LOGOUT ---
  
  async login(username, pin) {
    const users = await window.db.getAll('users');
    const user = users.find(u => u.username === username && u.pin === pin);
    
    if (user) {
      this.currentUserObj = user;
      this.isLoggedIn = true;
      sessionStorage.setItem('tokoku_user', JSON.stringify(user));
      this.updateUI();
      return { success: true, user };
    }
    return { success: false, message: 'Username atau PIN salah!' };
  }

  logout() {
    this.currentUserObj = null;
    this.isLoggedIn = false;
    sessionStorage.removeItem('tokoku_user');
    
    // Reload the page to reset all states and show login screen
    window.location.reload();
  }

  async requireOwner(actionCallback) {
    if (this.isOwner()) {
      actionCallback();
    } else {
      window.app.showToast('Akses ditolak. Fitur ini hanya untuk Pemilik Toko.', 'error');
    }
  }

  updateUI() {
    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge && this.currentUserObj) {
      roleBadge.className = `badge-role ${this.isOwner() ? 'badge-owner' : 'badge-cashier'}`;
      roleBadge.textContent = this.currentUserObj.name;
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

  // --- USER MANAGEMENT CRUD ---

  async getUsers() {
    try {
      return await window.db.getAll('users');
    } catch (e) {
      console.warn('Gagal memuat users. Database mungkin belum diupgrade.', e);
      return [];
    }
  }

  async addUser(userObj) {
    if (!this.isOwner()) throw new Error('Hanya Pemilik Toko yang dapat menambah pengguna.');
    
    const users = await this.getUsers();
    if (users.some(u => u.username === userObj.username)) {
      throw new Error('Username sudah digunakan.');
    }
    
    return await window.db.add('users', userObj);
  }

  async updateUser(userObj) {
    if (!this.isOwner()) throw new Error('Hanya Pemilik Toko yang dapat mengubah pengguna.');
    return await window.db.update('users', userObj);
  }

  async deleteUser(userId) {
    if (!this.isOwner()) throw new Error('Hanya Pemilik Toko yang dapat menghapus pengguna.');
    
    // Prevent deleting the last owner or yourself if you're the only owner
    const users = await this.getUsers();
    const ownersCount = users.filter(u => u.role === 'owner').length;
    const userToDelete = users.find(u => u.id === userId);
    
    if (userToDelete && userToDelete.role === 'owner' && ownersCount <= 1) {
      throw new Error('Tidak dapat menghapus Pemilik Toko terakhir.');
    }
    
    if (this.currentUserObj.id === userId) {
      throw new Error('Tidak dapat menghapus akun Anda sendiri saat sedang login.');
    }

    return await window.db.delete('users', userId);
  }
}

window.auth = new AuthManager();
