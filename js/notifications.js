// ==========================================================================
// TokoKu POS - Notifications & Messaging Integration
// Telegram Bot API Integration & WhatsApp Formatter Engine
// ==========================================================================

class NotificationManager {
  // Format Number to Indonesian Rupiah
  formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  }

  // --- TELEGRAM BOT NOTIFICATIONS ---
  async sendTelegramMessage(text) {
    const token = await window.db.getSetting('telegramBotToken', '');
    const chatId = await window.db.getSetting('telegramChatId', '');

    if (!token || !chatId) {
      console.log('Telegram Bot Token atau Chat ID belum disetel.');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });

      const data = await response.json();
      if (data.ok) {
        console.log('Notifikasi Telegram berhasil terkirim!');
        return true;
      } else {
        console.warn('Telegram API Error:', data.description);
        return false;
      }
    } catch (err) {
      console.error('Gagal mengirim Telegram notification:', err);
      return false;
    }
  }

  // Notifikasi Transaksi Baru
  async notifyNewTransaction(trx) {
    const storeName = await window.db.getSetting('storeName', 'TokoKu POS');
    
    let itemsText = '';
    trx.items.forEach(item => {
      itemsText += `• ${item.name} (${item.qty}x) = ${this.formatRupiah(item.subtotal)}\n`;
    });

    const msg = 
`🔔 *PENJUALAN BARU - ${storeName}*
----------------------------------------
🆔 *No. Transaksi:* \`${trx.id}\`
🕒 *Waktu:* ${new Date(trx.date).toLocaleString('id-ID')}
👤 *Kasir:* ${trx.cashierName || 'Kasir'}
💳 *Pembayaran:* ${trx.paymentMethod.toUpperCase()}

📦 *Daftar Barang:*
${itemsText}
💰 *Total Belanja:* *${this.formatRupiah(trx.totalAmount)}*
${trx.discount > 0 ? `🎟 *Diskon:* ${this.formatRupiah(trx.discount)}\n` : ''}
${trx.paymentMethod === 'debt' ? `⚠️ *Status:* Kasbon/Hutang (${trx.customerName || 'Pelanggan'})\n` : ''}
----------------------------------------
_Tercatat otomatis oleh TokoKu POS_`;

    this.sendTelegramMessage(msg);
  }

  // Notifikasi Rekap Tutup Toko Harian
  async notifyDailySummary(reportData) {
    const storeName = await window.db.getSetting('storeName', 'TokoKu POS');
    const today = new Date().toLocaleDateString('id-ID', { dateStyle: 'full' });

    const msg = 
`📊 *REKAP LAPORAN HARIAN - ${storeName}*
📅 ${today}
----------------------------------------
💵 *Total Omset Penjualan:* ${this.formatRupiah(reportData.totalRevenue)}
🛒 *Total Transaksi:* ${reportData.totalTransactions} Transaksi
📉 *Harga Pokok Penjualan (Modal):* ${this.formatRupiah(reportData.totalCost)}
💸 *Pengeluaran Operasional:* ${this.formatRupiah(reportData.totalExpenses)}
----------------------------------------
📈 *ESTIMASI LABA BERSIH:* *${this.formatRupiah(reportData.netProfit)}*
${reportData.unpaidDebts > 0 ? `⚠️ *Piutang Baru Belum Lunas:* ${this.formatRupiah(reportData.unpaidDebts)}\n` : ''}
----------------------------------------
_Laporan otomatis sistem TokoKu POS_`;

    const success = await this.sendTelegramMessage(msg);
    if (success) {
      window.app.showToast('Laporan harian berhasil dikirim ke Telegram!', 'success');
    } else {
      window.app.showToast('Periksa pengaturan Token & Chat ID Telegram di menu Pengaturan.', 'error');
    }
  }

  // Notifikasi Stok Kritis
  async notifyLowStock(product) {
    const storeName = await window.db.getSetting('storeName', 'TokoKu POS');
    const msg = 
`⚠️ *PERINGATAN STOK MENIPIS - ${storeName}*
----------------------------------------
📦 *Nama Produk:* ${product.name}
🔢 *Sisa Stok:* *${product.stock} ${product.unit || 'pcs'}*
🚨 *Batas Minimum:* ${product.minStock} ${product.unit || 'pcs'}
🏷 *Barcode:* \`${product.barcode || '-'}\`

_Harap segera melakukan kulakan / restock produk ini._`;

    this.sendTelegramMessage(msg);
  }

  // --- WHATSAPP GENERATORS ---
  // Generate WhatsApp Receipt URL
  async createReceiptWhatsAppURL(trx, targetPhone = '') {
    const storeName = await window.db.getSetting('storeName', 'TokoKu POS');
    const storeAddress = await window.db.getSetting('storeAddress', '');
    const storePhone = await window.db.getSetting('storePhone', '');
    const receiptFooter = await window.db.getSetting('receiptFooter', 'Terima kasih telah berbelanja!');

    let itemsText = '';
    trx.items.forEach(item => {
      itemsText += `• ${item.name} (${item.qty}x) : ${this.formatRupiah(item.subtotal)}\n`;
    });

    const receiptText = 
`🧾 *STRUK PEMBELIAN - ${storeName.toUpperCase()}*
${storeAddress ? `📍 ${storeAddress}\n` : ''}${storePhone ? `📞 ${storePhone}\n` : ''}
----------------------------------------
No. Nota : ${trx.id}
Tanggal  : ${new Date(trx.date).toLocaleString('id-ID')}
Kasir    : ${trx.cashierName || 'Kasir'}
${trx.customerName ? `Pelanggan: ${trx.customerName}\n` : ''}----------------------------------------
*RINCIAN BELANJA:*
${itemsText}----------------------------------------
Subtotal : ${this.formatRupiah(trx.totalAmount + (trx.discount || 0))}
${trx.discount > 0 ? `Diskon   : -${this.formatRupiah(trx.discount)}\n` : ''}*TOTAL    : ${this.formatRupiah(trx.totalAmount)}*
Metode   : ${trx.paymentMethod.toUpperCase()}
${trx.paymentMethod === 'cash' ? `Bayar    : ${this.formatRupiah(trx.cashReceived)}\nKembali  : ${this.formatRupiah(trx.change)}\n` : ''}----------------------------------------
_${receiptFooter}_`;

    const cleanPhone = (targetPhone || trx.customerPhone || '').replace(/\D/g, '');
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }

    const encodedText = encodeURIComponent(receiptText);
    if (formattedPhone) {
      return `https://wa.me/${formattedPhone}?text=${encodedText}`;
    } else {
      return `https://wa.me/?text=${encodedText}`;
    }
  }

  // Generate WhatsApp Debt Reminder URL
  async createDebtReminderWhatsAppURL(debt) {
    const storeName = await window.db.getSetting('storeName', 'TokoKu POS');
    const storePhone = await window.db.getSetting('storePhone', '');

    const message = 
`Halo Kak *${debt.personName}* 👋

Kami dari *${storeName}* menginformasikan rincian catatan bon/tagihan belanja:

📌 *Total Tagihan:* ${this.formatRupiah(debt.totalAmount)}
💵 *Sudah Dibayar:* ${this.formatRupiah(debt.paidAmount || 0)}
⏳ *SISA TAGIHAN:* *${this.formatRupiah(debt.remainingAmount)}*
${debt.dueDate ? `🗓 *Jatuh Tempo:* ${new Date(debt.dueDate).toLocaleDateString('id-ID')}\n` : ''}${debt.notes ? `📝 *Keterangan:* ${debt.notes}\n` : ''}
Pembayaran dapat dilakukan langsung di toko kami${storePhone ? ` atau hubungi ${storePhone}` : ''}.

Terima kasih banyak atas perhatian dan kerjasamanya! Semoga usahanya semakin berkah & lancar. 🙏✨`;

    const cleanPhone = (debt.phone || '').replace(/\D/g, '');
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1);
    }

    const encodedText = encodeURIComponent(message);
    if (formattedPhone) {
      return `https://wa.me/${formattedPhone}?text=${encodedText}`;
    } else {
      return `https://wa.me/?text=${encodedText}`;
    }
  }
}

window.notifications = new NotificationManager();
