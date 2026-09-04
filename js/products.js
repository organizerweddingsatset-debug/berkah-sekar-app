// ==========================================================================
// TokoKu POS - Products & Inventory Management
// CRUD Products, Stock Adjustment, Category Management, Low Stock Alerts
// ==========================================================================

class ProductManager {
  constructor() {
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.stockFilter = 'all'; // 'all' | 'low'
  }

  formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num || 0);
  }

  onSearch(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.renderProductsList();
  }

  async init() {
    await this.renderCategoryFilter();
    await this.renderProductsList();
    this.setupListeners();
  }

  setupListeners() {
    const searchInput = document.getElementById('inventory-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => this.onSearch(e.target.value);
    }

    const btnAddProduct = document.getElementById('btn-add-product');
    if (btnAddProduct) {
      btnAddProduct.addEventListener('click', () => {
        window.auth.requireOwner(() => {
          this.openProductFormModal();
        });
      });
    }

    const btnManageCategories = document.getElementById('btn-manage-categories');
    if (btnManageCategories) {
      btnManageCategories.addEventListener('click', () => {
        window.auth.requireOwner(() => {
          this.openCategoryManagerModal();
        });
      });
    }
  }

  async renderCategoryFilter() {
    const container = document.getElementById('inventory-category-filters');
    if (!container) return;

    let categories = await window.db.getAll('categories');
    if (!categories || categories.length === 0) {
      categories = [
        { name: 'Sembako & Makanan', icon: '🍚' },
        { name: 'Minuman', icon: '🥤' },
        { name: 'Snack & Biskuit', icon: '🍪' },
        { name: 'Kebutuhan Mandi & Cuci', icon: '🧼' },
        { name: 'Rokok & Lainnya', icon: '📦' }
      ];
    }
    let html = `
      <button class="filter-pill ${this.selectedCategory === 'all' && this.stockFilter === 'all' ? 'active' : ''}" onclick="window.products.filter('all', 'all')">
        Semua
      </button>
      <button class="filter-pill ${this.stockFilter === 'low' ? 'active' : ''}" style="border-color: rgba(239, 68, 68, 0.4);" onclick="window.products.filter('${this.selectedCategory}', 'low')">
        ⚠️ Stok Menipis
      </button>
    `;

    categories.forEach(cat => {
      html += `
        <button class="filter-pill ${this.selectedCategory === cat.name && this.stockFilter === 'all' ? 'active' : ''}" onclick="window.products.filter('${cat.name}', 'all')">
          ${cat.icon || '📦'} ${cat.name}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  filter(cat, stockMode) {
    this.selectedCategory = cat;
    this.stockFilter = stockMode;
    this.renderCategoryFilter();
    this.renderProductsList();
  }

  async renderProductsList() {
    const container = document.getElementById('inventory-products-list');
    if (!container) return;

    let products = await window.db.getAll('products');
    const isOwner = window.auth.isOwner();

    // Filter Stock Menipis
    if (this.stockFilter === 'low') {
      products = products.filter(p => p.stock <= (p.minStock || 5));
    }

    // Filter Category
    if (this.selectedCategory !== 'all') {
      products = products.filter(p => p.category === this.selectedCategory);
    }

    // Filter Search
    if (this.searchQuery) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(this.searchQuery) ||
        (p.barcode && p.barcode.toLowerCase().includes(this.searchQuery))
      );
    }

    if (products.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 40px 20px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">📦</div>
          <div style="font-weight: 600;">Tidak ada produk yang cocok</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Tambahkan produk baru atau ubah filter pencarian.</div>
        </div>
      `;
      return;
    }

    let html = '';
    products.forEach(p => {
      const isLow = p.stock <= (p.minStock || 5);
      const isOut = p.stock <= 0;
      const profitPerUnit = (p.sellPrice || 0) - (p.costPrice || 0);

      html += `
        <div class="data-row">
          <div class="data-row-main" style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="data-row-title">${p.name}</span>
              ${isOut ? '<span class="badge badge-danger">Habis</span>' : (isLow ? '<span class="badge badge-warning">Menipis</span>' : '')}
            </div>
            <div class="data-row-sub">
              ${p.category || 'Umum'} ${p.barcode ? `• Barcode: ${p.barcode}` : ''}
            </div>
            <div style="display: flex; gap: 12px; margin-top: 4px; font-size: 0.8rem;">
              <span style="color: var(--primary-400); font-weight: 700; font-family: var(--font-mono);">
                Jual: ${this.formatRupiah(p.sellPrice)}
              </span>
              ${isOwner ? `
                <span class="text-muted" style="font-family: var(--font-mono);">
                  Modal: ${this.formatRupiah(p.costPrice || 0)} (Laba: +${this.formatRupiah(profitPerUnit)})
                </span>
              ` : ''}
            </div>
          </div>

          <div class="data-row-end">
            <div style="font-size: 1.1rem; font-weight: 800; font-family: var(--font-mono); color: ${isLow ? 'var(--danger-500)' : 'var(--text-primary)'}">
              ${p.stock} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${p.unit || 'pcs'}</span>
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.products.openStockAdjustModal(${p.id})">
                Stok
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.products.openProductFormModal(${p.id})">
                Edit
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // --- PRODUCT FORM MODAL ---
  async openProductFormModal(productId = null) {
    const modalTitle = document.getElementById('product-form-title');
    let categories = await window.db.getAll('categories');
    if (!categories || categories.length === 0) {
      categories = [
        { name: 'Sembako & Makanan' },
        { name: 'Minuman' },
        { name: 'Snack & Biskuit' },
        { name: 'Kebutuhan Mandi & Cuci' },
        { name: 'Umum' }
      ];
    }
    const categorySelect = document.getElementById('prod-form-category');
    
    // Populate categories
    if (categorySelect) {
      categorySelect.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }

    const form = document.getElementById('product-form');
    if (form) form.reset();
    const idInput = document.getElementById('prod-form-id');
    if (idInput) idInput.value = '';

    if (productId) {
      const p = await window.db.getById('products', productId);
      if (p) {
        modalTitle.textContent = 'Edit Produk';
        document.getElementById('prod-form-id').value = p.id;
        document.getElementById('prod-form-name').value = p.name;
        document.getElementById('prod-form-barcode').value = p.barcode || '';
        document.getElementById('prod-form-category').value = p.category;
        document.getElementById('prod-form-cost').value = p.costPrice || 0;
        document.getElementById('prod-form-sell').value = p.sellPrice;
        document.getElementById('prod-form-stock').value = p.stock;
        document.getElementById('prod-form-min-stock').value = p.minStock || 5;
        document.getElementById('prod-form-unit').value = p.unit || 'pcs';
        document.getElementById('btn-delete-product').classList.remove('hidden');
      }
    } else {
      modalTitle.textContent = 'Tambah Produk Baru';
      document.getElementById('btn-delete-product').classList.add('hidden');
    }

    window.app.openModal('product-form-modal');
  }

  async saveProduct() {
    const id = document.getElementById('prod-form-id').value;
    const name = document.getElementById('prod-form-name').value.trim();
    const barcode = document.getElementById('prod-form-barcode').value.trim();
    const category = document.getElementById('prod-form-category').value;
    const costPrice = parseFloat(document.getElementById('prod-form-cost').value) || 0;
    const sellPrice = parseFloat(document.getElementById('prod-form-sell').value) || 0;
    const stock = parseInt(document.getElementById('prod-form-stock').value) || 0;
    const minStock = parseInt(document.getElementById('prod-form-min-stock').value) || 5;
    const unit = document.getElementById('prod-form-unit').value.trim() || 'pcs';

    if (!name) {
      window.app.showToast('Nama produk wajib diisi', 'error');
      return;
    }
    if (sellPrice <= 0) {
      window.app.showToast('Harga jual harus lebih dari 0', 'error');
      return;
    }

    const productData = {
      name,
      barcode,
      category,
      costPrice,
      sellPrice,
      stock,
      minStock,
      unit,
      updatedAt: new Date().toISOString()
    };

    if (id) {
      productData.id = parseInt(id);
      await window.db.update('products', productData);
      window.app.showToast('Produk berhasil diperbarui!', 'success');
    } else {
      await window.db.add('products', productData);
      window.app.showToast('Produk baru berhasil ditambahkan!', 'success');
    }

    window.app.closeModal('product-form-modal');
    this.renderProductsList();
    window.pos.renderProducts();
  }

  async deleteProduct() {
    const id = document.getElementById('prod-form-id').value;
    if (!id) return;

    if (confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
      await window.db.delete('products', parseInt(id));
      window.app.showToast('Produk berhasil dihapus', 'info');
      window.app.closeModal('product-form-modal');
      this.renderProductsList();
      window.pos.renderProducts();
    }
  }

  // --- STOCK ADJUSTMENT MODAL ---
  async openStockAdjustModal(productId) {
    const p = await window.db.getById('products', productId);
    if (!p) return;

    document.getElementById('adjust-prod-id').value = p.id;
    document.getElementById('adjust-prod-name').textContent = p.name;
    document.getElementById('adjust-current-stock').textContent = `${p.stock} ${p.unit || 'pcs'}`;
    document.getElementById('adjust-qty-input').value = '';
    document.getElementById('adjust-notes-input').value = '';

    window.app.openModal('stock-adjust-modal');
  }

  async saveStockAdjustment() {
    const id = parseInt(document.getElementById('adjust-prod-id').value);
    const type = document.getElementById('adjust-type-select').value; // 'in' | 'out' | 'set'
    const qty = parseInt(document.getElementById('adjust-qty-input').value);
    const notes = document.getElementById('adjust-notes-input').value.trim();

    if (isNaN(qty) || qty < 0) {
      window.app.showToast('Masukkan jumlah stok yang valid', 'error');
      return;
    }

    const prod = await window.db.getById('products', id);
    if (!prod) return;

    let newStock = prod.stock;
    if (type === 'in') {
      newStock += qty;
    } else if (type === 'out') {
      newStock = Math.max(0, newStock - qty);
    } else if (type === 'set') {
      newStock = qty;
    }

    prod.stock = newStock;
    prod.updatedAt = new Date().toISOString();
    await window.db.update('products', prod);

    window.app.showToast(`Stok ${prod.name} diperbarui menjadi ${newStock}`, 'success');
    window.app.closeModal('stock-adjust-modal');
    this.renderProductsList();
    window.pos.renderProducts();
  }

  // --- CATEGORIES MODAL ---
  async openCategoryManagerModal() {
    await this.renderCategoryManagerList();
    window.app.openModal('category-manager-modal');
  }

  async renderCategoryManagerList() {
    const container = document.getElementById('category-manager-list');
    if (!container) return;

    const categories = await window.db.getAll('categories');
    let html = '';
    categories.forEach(c => {
      html += `
        <div class="data-row" style="padding: 8px 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${c.icon || '📦'}</span>
            <span style="font-weight: 600;">${c.name}</span>
          </div>
          <button class="btn btn-outline btn-sm text-danger" onclick="window.products.deleteCategory(${c.id})">
            Hapus
          </button>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  async addCategory() {
    const nameInput = document.getElementById('new-category-name');
    const iconInput = document.getElementById('new-category-icon');
    const name = nameInput.value.trim();
    const icon = iconInput.value.trim() || '📦';

    if (!name) {
      window.app.showToast('Nama kategori tidak boleh kosong', 'error');
      return;
    }

    await window.db.add('categories', { name, icon });
    nameInput.value = '';
    window.app.showToast('Kategori baru berhasil ditambahkan', 'success');
    await this.renderCategoryManagerList();
    await this.renderCategoryFilter();
    await window.pos.renderCategories();
  }

  async deleteCategory(id) {
    if (confirm('Hapus kategori ini?')) {
      await window.db.delete('categories', id);
      window.app.showToast('Kategori dihapus', 'info');
      await this.renderCategoryManagerList();
      await this.renderCategoryFilter();
      await window.pos.renderCategories();
    }
  }
}

window.products = new ProductManager();
