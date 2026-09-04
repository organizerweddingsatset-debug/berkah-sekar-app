// ==========================================================================
// TokoKu POS - IndexedDB Storage Engine (Rock-Solid & Auto-Seeding)
// Offline-first local database with complete CRUD helpers & auto-seeding
// ==========================================================================

const DB_NAME = 'TokoKuPOS_DB';
const DB_VERSION = 1;

class StoreDB {
  constructor() {
    this.db = null;
    this.isReady = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Products Store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          productStore.createIndex('barcode', 'barcode', { unique: false });
          productStore.createIndex('category', 'category', { unique: false });
          productStore.createIndex('name', 'name', { unique: false });
        }

        // 2. Categories Store
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        }

        // 3. Transactions Store
        if (!db.objectStoreNames.contains('transactions')) {
          const trxStore = db.createObjectStore('transactions', { keyPath: 'id' });
          trxStore.createIndex('date', 'date', { unique: false });
          trxStore.createIndex('paymentMethod', 'paymentMethod', { unique: false });
        }

        // 4. Expenses Store
        if (!db.objectStoreNames.contains('expenses')) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
          expStore.createIndex('date', 'date', { unique: false });
          expStore.createIndex('category', 'category', { unique: false });
        }

        // 5. Debts & Receivables Store (Buku Kasbon / Hutang Piutang)
        if (!db.objectStoreNames.contains('debts')) {
          const debtStore = db.createObjectStore('debts', { keyPath: 'id', autoIncrement: true });
          debtStore.createIndex('type', 'type', { unique: false });
          debtStore.createIndex('status', 'status', { unique: false });
        }

        // 6. Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        resolve(this.db);
        setTimeout(() => this.ensureSeeded(), 50);
      };

      request.onerror = (event) => {
        console.error('IndexedDB Error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Helper generic transaction
  async getStore(storeName, mode = 'readonly') {
    if (!this.db) {
      await this.isReady;
    }
    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  // --- CRUD METHODS ---
  async getAll(storeName) {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getById(storeName, id) {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async add(storeName, item) {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async update(storeName, item) {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, id) {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(storeName) {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- SETTINGS HELPERS ---
  async getSetting(key, defaultValue = null) {
    const item = await this.getById('settings', key);
    return item ? item.value : defaultValue;
  }

  async setSetting(key, value) {
    await this.update('settings', { key, value });
  }

  // --- INITIAL SAMPLE DATA SEEDING ---
  async ensureSeeded() {
    try {
      const prods = await this.getAll('products');
      if (!prods || prods.length === 0) {
        await this.seedInitialData();
      }
    } catch (e) {
      console.warn('ensureSeeded:', e);
    }
  }

  async seedInitialData() {
    console.log('Seeding initial TokoKu POS sample data...');

    // Categories
    const categories = await this.getAll('categories');
    if (categories.length === 0) {
      const sampleCategories = [
        { id: 1, name: 'Sembako & Makanan', icon: '🍚' },
        { id: 2, name: 'Minuman', icon: '🥤' },
        { id: 3, name: 'Snack & Biskuit', icon: '🍪' },
        { id: 4, name: 'Kebutuhan Mandi & Cuci', icon: '🧼' },
        { id: 5, name: 'Rokok & Lainnya', icon: '📦' }
      ];
      for (const cat of sampleCategories) {
        await this.add('categories', cat);
      }
    }

    // Products
    const products = await this.getAll('products');
    if (products.length === 0) {
      const sampleProducts = [
        { name: 'Beras Premium 5kg', barcode: '8991001', category: 'Sembako & Makanan', costPrice: 65000, sellPrice: 75000, stock: 24, minStock: 5, unit: 'sak' },
        { name: 'Minyak Goreng 2L', barcode: '8991002', category: 'Sembako & Makanan', costPrice: 31000, sellPrice: 36000, stock: 18, minStock: 5, unit: 'pouch' },
        { name: 'Gula Pasir 1kg', barcode: '8991003', category: 'Sembako & Makanan', costPrice: 15000, sellPrice: 17500, stock: 30, minStock: 6, unit: 'kg' },
        { name: 'Telur Ayam 1kg', barcode: '8991004', category: 'Sembako & Makanan', costPrice: 26000, sellPrice: 29000, stock: 15, minStock: 5, unit: 'kg' },
        { name: 'Indomie Goreng Spesial', barcode: '8991005', category: 'Sembako & Makanan', costPrice: 2800, sellPrice: 3500, stock: 85, minStock: 20, unit: 'bks' },
        { name: 'Aqua Botol 600ml', barcode: '8992001', category: 'Minuman', costPrice: 2800, sellPrice: 4000, stock: 48, minStock: 12, unit: 'btl' },
        { name: 'Teh Pucuk Harum 350ml', barcode: '8992002', category: 'Minuman', costPrice: 3000, sellPrice: 4000, stock: 36, minStock: 10, unit: 'btl' },
        { name: 'Kopi Kapal Api Spesial 65g', barcode: '8992003', category: 'Minuman', costPrice: 5500, sellPrice: 7000, stock: 25, minStock: 5, unit: 'bks' },
        { name: 'Chitato Sapi Panggang 68g', barcode: '8993001', category: 'Snack & Biskuit', costPrice: 9500, sellPrice: 12000, stock: 20, minStock: 5, unit: 'bks' },
        { name: 'Oreo Vanilla 133g', barcode: '8993002', category: 'Snack & Biskuit', costPrice: 8500, sellPrice: 11000, stock: 16, minStock: 4, unit: 'bks' },
        { name: 'Sabun Lifebuoy Total 10', barcode: '8994001', category: 'Kebutuhan Mandi & Cuci', costPrice: 3800, sellPrice: 5000, stock: 30, minStock: 8, unit: 'pcs' },
        { name: 'Deterjen Rinso Molto 770g', barcode: '8994002', category: 'Kebutuhan Mandi & Cuci', costPrice: 19000, sellPrice: 23500, stock: 12, minStock: 3, unit: 'bks' }
      ];
      for (const p of sampleProducts) {
        await this.add('products', p);
      }
    }

    // Default Settings
    const storeName = await this.getSetting('storeName');
    if (!storeName) {
      await this.setSetting('storeName', 'Toko Berkah Sejahtera');
      await this.setSetting('storeAddress', 'Jl. Merdeka No. 45, Jakarta');
      await this.setSetting('storePhone', '081234567890');
      await this.setSetting('receiptFooter', 'Terima kasih telah berbelanja! Barang yang sudah dibeli tidak dapat ditukar.');
      await this.setSetting('printerWidth', '58mm');
      await this.setSetting('telegramBotToken', '');
      await this.setSetting('telegramChatId', '');
      await this.setSetting('ownerPin', '1234');
      await this.setSetting('cashierPin', '0000');
      await this.setSetting('activeRole', 'owner');
      await this.setSetting('theme', 'dark');
    }

    // Refresh UI
    if (window.pos && window.pos.renderProducts) {
      window.pos.renderCategories();
      window.pos.renderProducts();
    }
    if (window.products && window.products.renderProductsList) {
      window.products.renderCategoryFilter();
      window.products.renderProductsList();
    }
  }

  // Backup & Restore Database
  async exportFullDatabase() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      products: await this.getAll('products'),
      categories: await this.getAll('categories'),
      transactions: await this.getAll('transactions'),
      expenses: await this.getAll('expenses'),
      debts: await this.getAll('debts'),
      settings: await this.getAll('settings')
    };
    return JSON.stringify(data, null, 2);
  }

  async importFullDatabase(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.products || !data.settings) {
        throw new Error('Format file backup tidak valid');
      }

      await this.clearStore('products');
      await this.clearStore('categories');
      await this.clearStore('transactions');
      await this.clearStore('expenses');
      await this.clearStore('debts');
      await this.clearStore('settings');

      for (const p of data.products) await this.add('products', p);
      for (const c of (data.categories || [])) await this.add('categories', c);
      for (const t of (data.transactions || [])) await this.add('transactions', t);
      for (const e of (data.expenses || [])) await this.add('expenses', e);
      for (const d of (data.debts || [])) await this.add('debts', d);
      for (const s of data.settings) await this.update('settings', s);

      return true;
    } catch (err) {
      console.error('Import backup failed:', err);
      throw err;
    }
  }
}

// Global Instance
window.db = new StoreDB();
