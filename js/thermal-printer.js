// ==========================================================================
// TokoKu POS - Thermal Receipt Printer (58mm / 80mm) & Web Share
// ==========================================================================

class ThermalPrinterManager {
  formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num || 0);
  }

  async generateReceiptHTML(trx) {
    const storeName = await window.db.getSetting('storeName', 'Toko Berkah Sejahtera');
    const storeAddress = await window.db.getSetting('storeAddress', 'Jl. Merdeka No. 45');
    const storePhone = await window.db.getSetting('storePhone', '081234567890');
    const receiptFooter = await window.db.getSetting('receiptFooter', 'Terima kasih atas kunjungan Anda!');

    let itemsHtml = '';
    trx.items.forEach(item => {
      itemsHtml += `
        <div class="receipt-item-row">
          <div>
            <div class="receipt-item-name">${item.name}</div>
            <div class="receipt-item-sub">${item.qty} x ${this.formatRupiah(item.sellPrice)}</div>
          </div>
          <div style="font-weight:600;">${this.formatRupiah(item.subtotal)}</div>
        </div>
      `;
    });

    return `
      <div id="printable-receipt" class="receipt-preview-wrapper">
        <div class="receipt-header">
          <div class="receipt-shop-name">${storeName}</div>
          <div class="receipt-shop-address">${storeAddress}</div>
          <div class="receipt-shop-address">${storePhone ? 'Telp: ' + storePhone : ''}</div>
        </div>

        <div class="receipt-info">
          <div class="receipt-info-row">
            <span>No: ${trx.id}</span>
            <span>${new Date(trx.date).toLocaleDateString('id-ID')}</span>
          </div>
          <div class="receipt-info-row">
            <span>Kasir: ${trx.cashierName || 'Kasir'}</span>
            <span>${new Date(trx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          ${trx.customerName ? `<div class="receipt-info-row"><span>Pelanggan:</span><span>${trx.customerName}</span></div>` : ''}
        </div>

        <div class="receipt-items">
          ${itemsHtml}
        </div>

        <div class="receipt-totals">
          <div class="receipt-total-row">
            <span>Subtotal</span>
            <span>${this.formatRupiah(trx.totalAmount + (trx.discount || 0))}</span>
          </div>
          ${trx.discount > 0 ? `
          <div class="receipt-total-row" style="color:#ef4444;">
            <span>Diskon</span>
            <span>-${this.formatRupiah(trx.discount)}</span>
          </div>` : ''}
          <div class="receipt-total-row receipt-total-bold" style="border-top:1px dashed #cbd5e1; padding-top:4px; margin-top:4px;">
            <span>TOTAL</span>
            <span>${this.formatRupiah(trx.totalAmount)}</span>
          </div>
          <div class="receipt-total-row">
            <span>Metode Bayar</span>
            <span>${trx.paymentMethod.toUpperCase()}</span>
          </div>
          ${trx.paymentMethod === 'cash' ? `
          <div class="receipt-total-row">
            <span>Tunai</span>
            <span>${this.formatRupiah(trx.cashReceived)}</span>
          </div>
          <div class="receipt-total-row">
            <span>Kembali</span>
            <span>${this.formatRupiah(trx.change)}</span>
          </div>` : ''}
        </div>

        <div class="receipt-footer">
          <div>${receiptFooter}</div>
          <div style="margin-top:6px; font-size:9px; opacity:0.7;">Powered by TokoKu POS</div>
        </div>
      </div>
    `;
  }

  // Print using standard browser/Android printer dialog
  async printReceipt(trx) {
    const receiptContainer = document.getElementById('receipt-print-area');
    receiptContainer.innerHTML = await this.generateReceiptHTML(trx);
    window.print();
  }

  // Share Receipt using Web Share API
  async shareReceipt(trx) {
    if (navigator.share) {
      try {
        const waUrl = await window.notifications.createReceiptWhatsAppURL(trx);
        const storeName = await window.db.getSetting('storeName', 'TokoKu');
        await navigator.share({
          title: `Struk Belanja - ${storeName}`,
          text: `Struk transaksi No ${trx.id} total ${this.formatRupiah(trx.totalAmount)}`,
          url: waUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share error:', err);
        }
      }
    } else {
      // Fallback open WhatsApp
      const waUrl = await window.notifications.createReceiptWhatsAppURL(trx);
      window.open(waUrl, '_blank');
    }
  }
}

window.thermalPrinter = new ThermalPrinterManager();
