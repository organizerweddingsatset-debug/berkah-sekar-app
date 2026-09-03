// ==========================================================================
// Toko Berkah Sekar - Point of Sale (Kasir Engine)
// Cart Management, Barcode Scanner, Cash/QRIS/Debt Checkout & Audio Feedback
// ==========================================================================

class POSManager {
  constructor() {
    this.cart = [];
    this.discount = 0;
    this.paymentMethod = 'cash';
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.scannerInstance = null;
    this.audioCtx = null;
  }

  // Synthesized Audio Effects using Web Audio API
  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  playBeep() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  playSuccess() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + i * 0.07);
        gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + i * 0.07 + 0.15);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(this.audioCtx.currentTime + i * 0.07);
        osc.stop(this.audioCtx.currentTime + i * 0.07 + 0.15);
      });
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  // Format Rupiah
  formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  }

  onSearch(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.renderProducts();
  }

  async init() {
    await this.renderCategories();
    await this.renderProducts();
    this.setupListeners();
    this.updateCartUI();
  }

  setupListeners() {
    // Search input listener
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
      searchInput.oninput = (e) => this.onSearch(e.target.value);
    }

    // Floating cart bar click
    const floatingCart = document.getElementById('floating-cart-bar');
    if (floatingCart) {
      floatingCart.addEventListener('click', () => {
        if (this.cart.length > 0) {
          this.openCheckoutModal();
        }
      });
    }

    // Barcode camera button
    const btnScan = document.getElementById('btn-scan-barcode');
    if (btnScan) {
      btnScan.addEventListener('click', () => {
        this.openBarcodeScannerModal();
      });
    }

    // Payment method selector buttons
    document.querySelectorAll('.payment-method-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('active'));
        const targetBtn = e.currentTarget;
        targetBtn.classList.add('active');
        this.paymentMethod = targetBtn.dataset.method;
        this.updatePaymentDetailsView();
      });
    });

    // Cash received input
    const cashInput = document.getElementById('checkout-cash-received');
    if (cashInput) {
      cashInput.addEventListener('input', () => {
        this.calculateChange();
      });
    }

    // Discount input
    const discountInput = document.getElementById('checkout-discount-input');
    if (discountInput) {
      discountInput.addEventListener('input', (e) => {
        this.discount = parseFloat(e.target.value) || 0;
        this.updateCheckoutTotals();
      });
    }
  }

  async renderCategories() {
    const container = document.getElementById('pos-category-filters');
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
      <button class="filter-pill ${this.selectedCategory === 'all' ? 'active' : ''}" onclick="window.pos.filterCategory('all')">
        Semua Produk
      </button>
    `;

    categories.forEach(cat => {
      html += `
        <button class="filter-pill ${this.selectedCategory === cat.name ? 'active' : ''}" onclick="window.pos.filterCategory('${cat.name}')">
          ${cat.icon || '📦'} ${cat.name}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  filterCategory(catName) {
    this.selectedCategory = catName;
    this.renderCategories();
    this.renderProducts();
  }

  async renderProducts() {
    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    let products = await window.db.getAll('products');

    // Filter by Category
    if (this.selectedCategory !== 'all') {
      products = products.filter(p => p.category === this.selectedCategory);
    }

    // Filter by Search Query (Name or Barcode)
    if (this.searchQuery) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(this.searchQuery) || 
        (p.barcode && p.barcode.toLowerCase().includes(this.searchQuery))
      );
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 600;">Produk tidak ditemukan</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Coba gunakan kata kunci pencarian lain atau tambahkan produk baru.</div>
        </div>
      `;
      return;
    }

    let html = '';
    products.forEach(p => {
      const cartItem = this.cart.find(item => item.productId === p.id);
      const inCartQty = cartItem ? cartItem.qty : 0;
      const isOutOfStock = p.stock <= 0;

      html += `
        <div class="pos-card ${isOutOfStock ? 'out-of-stock' : ''}" onclick="window.pos.addToCart(${p.id})">
          ${inCartQty > 0 ? `<div class="pos-card-badge-cart">${inCartQty}</div>` : ''}
          <div>
            <div class="pos-card-icon">
              ${this.getCategoryIcon(p.category)}
            </div>
            <div class="pos-card-name">${p.name}</div>
          </div>
          <div>
            <div class="pos-card-price">${this.formatRupiah(p.sellPrice)}</div>
            <div class="pos-card-stock">
              ${isOutOfStock ? '<span style="color:var(--danger-500);font-weight:700;">Habis</span>' : `Stok: ${p.stock} ${p.unit || 'pcs'}`}
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  getCategoryIcon(catName) {
    if (!catName) return '📦';
    const lower = catName.toLowerCase();
    if (lower.includes('sembako') || lower.includes('makanan')) return '🍚';
    if (lower.includes('minuman')) return '🥤';
    if (lower.includes('snack') || lower.includes('biskuit')) return '🍪';
    if (lower.includes('mandi') || lower.includes('cuci') || lower.includes('sabun')) return '🧼';
    if (lower.includes('rokok')) return '🚬';
    return '📦';
  }

  // Add Product to Cart
  async addToCart(productId) {
    const product = await window.db.getById('products', productId);
    if (!product) return;

    if (product.stock <= 0) {
      window.app.showToast(`Stok ${product.name} sedang habis!`, 'error');
      return;
    }

    const existingIndex = this.cart.findIndex(item => item.productId === productId);
    if (existingIndex > -1) {
      if (this.cart[existingIndex].qty + 1 > product.stock) {
        window.app.showToast(`Stok ${product.name} tersisa ${product.stock}`, 'warning');
        return;
      }
      this.cart[existingIndex].qty += 1;
      this.cart[existingIndex].subtotal = this.cart[existingIndex].qty * this.cart[existingIndex].sellPrice;
      this.cart[existingIndex].totalCost = this.cart[existingIndex].qty * this.cart[existingIndex].costPrice;
    } else {
      this.cart.push({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        costPrice: product.costPrice || 0,
        sellPrice: product.sellPrice,
        qty: 1,
        unit: product.unit || 'pcs',
        subtotal: product.sellPrice,
        totalCost: product.costPrice || 0,
        maxStock: product.stock
      });
    }

    this.playBeep();
    this.updateCartUI();
    this.renderProducts();
  }

  changeItemQty(productId, delta) {
    const index = this.cart.findIndex(item => item.productId === productId);
    if (index === -1) return;

    const item = this.cart[index];
    const newQty = item.qty + delta;

    if (newQty <= 0) {
      this.cart.splice(index, 1);
    } else if (newQty > item.maxStock) {
      window.app.showToast(`Maksimal stok tersedia: ${item.maxStock}`, 'warning');
      return;
    } else {
      item.qty = newQty;
      item.subtotal = item.qty * item.sellPrice;
      item.totalCost = item.qty * item.costPrice;
    }

    this.updateCartUI();
    this.renderProducts();
    this.renderCartItemsList();
    this.updateCheckoutTotals();
  }

  clearCart() {
    this.cart = [];
    this.discount = 0;
    this.updateCartUI();
    this.renderProducts();
    window.app.closeModal('checkout-modal');
  }

  getCartTotals() {
    const rawTotal = this.cart.reduce((sum, item) => sum + item.subtotal, 0);
    const totalCost = this.cart.reduce((sum, item) => sum + item.totalCost, 0);
    const totalItems = this.cart.reduce((sum, item) => sum + item.qty, 0);
    const finalTotal = Math.max(0, rawTotal - this.discount);
    const profit = Math.max(0, finalTotal - totalCost);

    return {
      rawTotal,
      totalCost,
      totalItems,
      discount: this.discount,
      finalTotal,
      profit
    };
  }

  updateCartUI() {
    const { totalItems, finalTotal } = this.getCartTotals();
    const floatingCart = document.getElementById('floating-cart-bar');
    const cartCountBadge = document.getElementById('cart-bar-count');
    const cartTotalText = document.getElementById('cart-bar-total');
    const navCartBadge = document.getElementById('nav-cart-badge');

    if (totalItems > 0) {
      floatingCart.classList.remove('hidden');
      cartCountBadge.textContent = `${totalItems} Item`;
      cartTotalText.textContent = this.formatRupiah(finalTotal);
      if (navCartBadge) {
        navCartBadge.textContent = totalItems;
        navCartBadge.classList.remove('hidden');
      }
    } else {
      floatingCart.classList.add('hidden');
      if (navCartBadge) navCartBadge.classList.add('hidden');
    }
  }

  // --- CHECKOUT & PAYMENT ---
  openCheckoutModal() {
    this.renderCartItemsList();
    this.updateCheckoutTotals();
    this.paymentMethod = 'cash';
    document.querySelectorAll('.payment-method-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.method === 'cash');
    });
    this.updatePaymentDetailsView();
    window.app.openModal('checkout-modal');
  }

  renderCartItemsList() {
    const container = document.getElementById('checkout-cart-items');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="padding: 20px;">Keranjang belanja kosong</div>`;
      return;
    }

    let html = '';
    this.cart.forEach(item => {
      html += `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-sub">${this.formatRupiah(item.sellPrice)} / ${item.unit}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="cart-qty-control">
              <button class="qty-btn" onclick="window.pos.changeItemQty(${item.productId}, -1)">-</button>
              <div class="qty-display">${item.qty}</div>
              <button class="qty-btn" onclick="window.pos.changeItemQty(${item.productId}, 1)">+</button>
            </div>
            <div class="font-mono font-bold" style="min-width: 75px; text-align: right;">
              ${this.formatRupiah(item.subtotal)}
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  updateCheckoutTotals() {
    const { rawTotal, finalTotal, discount } = this.getCartTotals();
    document.getElementById('checkout-subtotal').textContent = this.formatRupiah(rawTotal);
    document.getElementById('checkout-grand-total').textContent = this.formatRupiah(finalTotal);

    // Setup Quick Nominal Buttons
    this.renderQuickCashButtons(finalTotal);
    this.calculateChange();
  }

  renderQuickCashButtons(total) {
    const container = document.getElementById('quick-cash-container');
    if (!container) return;

    const roundUpTo = (num, step) => Math.ceil(num / step) * step;
    const presets = [
      { label: 'Uang Pas', value: total },
      { label: '10.000', value: 10000 },
      { label: '20.000', value: 20000 },
      { label: '50.000', value: 50000 },
      { label: '100.000', value: 100000 }
    ];

    // Add smart rounded option if total > 50.000
    if (total > 50000 && total % 50000 !== 0) {
      presets.push({ label: this.formatRupiah(roundUpTo(total, 50000)), value: roundUpTo(total, 50000) });
    }

    let html = '';
    presets.forEach(p => {
      html += `
        <button type="button" class="quick-cash-btn" onclick="window.pos.selectQuickCash(${p.value})">
          ${p.label}
        </button>
      `;
    });
    container.innerHTML = html;
  }

  selectQuickCash(amount) {
    const cashInput = document.getElementById('checkout-cash-received');
    if (cashInput) {
      cashInput.value = amount;
      this.calculateChange();
    }
  }

  calculateChange() {
    const { finalTotal } = this.getCartTotals();
    const cashInput = document.getElementById('checkout-cash-received');
    const cashReceived = parseFloat(cashInput ? cashInput.value : 0) || 0;
    const changeDisplay = document.getElementById('checkout-change-display');

    const change = cashReceived - finalTotal;
    if (changeDisplay) {
      if (change >= 0) {
        changeDisplay.textContent = this.formatRupiah(change);
        changeDisplay.style.color = 'var(--primary-400)';
      } else {
        changeDisplay.textContent = `Kurang ${this.formatRupiah(Math.abs(change))}`;
        changeDisplay.style.color = 'var(--danger-500)';
      }
    }
  }

  updatePaymentDetailsView() {
    const cashSection = document.getElementById('payment-cash-section');
    const qrisSection = document.getElementById('payment-qris-section');
    const debtSection = document.getElementById('payment-debt-section');

    cashSection.classList.add('hidden');
    qrisSection.classList.add('hidden');
    debtSection.classList.add('hidden');

    if (this.paymentMethod === 'cash') {
      cashSection.classList.remove('hidden');
    } else if (this.paymentMethod === 'qris') {
      qrisSection.classList.remove('hidden');
    } else if (this.paymentMethod === 'debt') {
      debtSection.classList.remove('hidden');
    }
  }

  // --- COMPLETE TRANSACTION ---
  async processPayment() {
    if (this.cart.length === 0) {
      window.app.showToast('Keranjang masih kosong', 'error');
      return;
    }

    const { rawTotal, totalCost, finalTotal, discount, profit } = this.getCartTotals();
    const cashierName = window.auth.currentUser || 'Kasir';
    let cashReceived = finalTotal;
    let change = 0;
    let customerName = '';
    let customerPhone = '';
    let dueDate = null;

    if (this.paymentMethod === 'cash') {
      const cashInput = document.getElementById('checkout-cash-received');
      cashReceived = parseFloat(cashInput ? cashInput.value : 0) || 0;
      if (cashReceived < finalTotal) {
        window.app.showToast('Nominal uang tunai kurang dari total belanja!', 'error');
        return;
      }
      change = cashReceived - finalTotal;
    } else if (this.paymentMethod === 'debt') {
      customerName = document.getElementById('debt-customer-name')?.value.trim();
      customerPhone = document.getElementById('debt-customer-phone')?.value.trim();
      dueDate = document.getElementById('debt-due-date')?.value;

      if (!customerName) {
        window.app.showToast('Nama pelanggan wajib diisi untuk catatan hutang/kasbon!', 'error');
        return;
      }
    }

    // Generate Transaction ID
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const trxId = `TRX-${todayStr}-${randomHex}`;

    const transactionData = {
      id: trxId,
      date: new Date().toISOString(),
      items: [...this.cart],
      rawTotal,
      discount,
      totalAmount: finalTotal,
      totalCost,
      totalProfit: profit,
      paymentMethod: this.paymentMethod,
      cashReceived,
      change,
      customerName,
      customerPhone,
      cashierName,
      status: 'completed'
    };

    // 1. Save Transaction to DB
    await window.db.add('transactions', transactionData);

    // 2. Reduce Product Stock & Check Low Stock Alert
    for (const item of this.cart) {
      const prod = await window.db.getById('products', item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.qty);
        await window.db.update('products', prod);

        // Telegram alert if stock below min
        if (prod.stock <= prod.minStock) {
          window.notifications.notifyLowStock(prod);
        }
      }
    }

    // 3. If Debt, save to debts store
    if (this.paymentMethod === 'debt') {
      await window.db.add('debts', {
        type: 'receivable',
        personName: customerName,
        phone: customerPhone,
        totalAmount: finalTotal,
        paidAmount: 0,
        remainingAmount: finalTotal,
        dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'unpaid',
        createdAt: new Date().toISOString().split('T')[0],
        transactionId: trxId,
        notes: `Belanja kasir nota ${trxId}`,
        payments: []
      });
    }

    // 4. Send Telegram Notification
    window.notifications.notifyNewTransaction(transactionData);

    // 5. Audio and UI feedback
    this.playSuccess();
    window.app.closeModal('checkout-modal');
    this.cart = [];
    this.discount = 0;
    this.updateCartUI();
    this.renderProducts();

    // 6. Open Success Struk Modal
    this.openSuccessModal(transactionData);
  }

  async openSuccessModal(trx) {
    const modal = document.getElementById('success-trx-modal');
    document.getElementById('success-trx-id').textContent = trx.id;
    document.getElementById('success-trx-total').textContent = this.formatRupiah(trx.totalAmount);
    
    // Setup Print Button
    const btnPrint = document.getElementById('btn-print-receipt');
    btnPrint.onclick = () => window.thermalPrinter.printReceipt(trx);

    // Setup WhatsApp Share Button
    const btnWA = document.getElementById('btn-share-receipt-wa');
    btnWA.onclick = async () => {
      const url = await window.notifications.createReceiptWhatsAppURL(trx, trx.customerPhone);
      window.open(url, '_blank');
    };

    // Render Preview
    const previewContainer = document.getElementById('success-receipt-preview');
    previewContainer.innerHTML = await window.thermalPrinter.generateReceiptHTML(trx);

    window.app.openModal('success-trx-modal');
  }

  // --- BARCODE SCANNER (CAMERA) ---
  openBarcodeScannerModal() {
    window.app.openModal('scanner-modal');
    
    if (typeof Html5Qrcode !== 'undefined') {
      const html5QrCode = new Html5Qrcode("reader");
      this.scannerInstance = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          console.log('Barcode scanned:', decodedText);
          this.playBeep();
          this.closeBarcodeScannerModal();

          // Find product by barcode
          const products = await window.db.getAll('products');
          const matched = products.find(p => p.barcode === decodedText);
          if (matched) {
            this.addToCart(matched.id);
            window.app.showToast(`Berhasil scan: ${matched.name}`, 'success');
          } else {
            window.app.showToast(`Barcode ${decodedText} tidak terdaftar`, 'warning');
          }
        },
        (errorMessage) => {
          // ignore scan frame errors
        }
      ).catch(err => {
        console.error('Camera scan error:', err);
        window.app.showToast('Gagal membuka kamera pemindai. Pastikan izin kamera aktif.', 'error');
      });
    } else {
      window.app.showToast('Library pemindai kamera sedang dimuat...', 'info');
    }
  }

  closeBarcodeScannerModal() {
    if (this.scannerInstance) {
      this.scannerInstance.stop().then(() => {
        this.scannerInstance.clear();
        this.scannerInstance = null;
      }).catch(e => console.warn(e));
    }
    window.app.closeModal('scanner-modal');
  }
}

window.pos = new POSManager();
