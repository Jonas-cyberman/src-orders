/* ========================================================
   SRC Week Orders — app.js
   Shared logic, Supabase client, state management
   ======================================================== */

// ── Configuration ─────────────────────────────────────────
const CONFIG = {
  SUPABASE_URL: 'https://uzlcleseoxfifrdehdvs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_gCwbopHregwqci0_l8TXZQ_TzcM7fcR',
  PAYSTACK_KEY: 'pk_live_d6206c1e1d4b8e20bf0d0a9e81b87ff2b9ffe697',
  PRICES: {
    shirt: 45,   // GHS
    cap: 25,   // GHS
  },
  DEADLINE: new Date('2026-04-18T23:59:59'),
  SCHOOL: 'Dunkwa-On-Offin Nursing & Midwifery Training College',
  WHATSAPP_NUMBER: '233240064472',
  SYSTEM_EMAIL: 'dnmtcsrc25@gmail.com', // Admin receives receipts
};

// ── Supabase Client ────────────────────────────────────────
// Initialised lazily so pages without Supabase can still load
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (typeof supabase === 'undefined') {
      return null;
    }
    _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ── Currency ───────────────────────────────────────────────
function formatCurrency(amount) {
  return 'GHS ' + Number(amount).toFixed(2);
}

// ── Session State (Cart) ───────────────────────────────────
const STATE_KEY = 'srcOrderState';

const AppState = {
  get() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY)) || { cart: [], student: {} }; }
    catch { return { cart: [], student: {} }; }
  },
  save(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    // Dispatch event for UI updates (like cart count)
    window.dispatchEvent(new Event('cartUpdated'));
  },
  getCart() { return this.get().cart; },
  getStudent() { return this.get().student; },
  setCart(cart) {
    const s = this.get(); s.cart = cart; this.save(s);
  },
  setStudent(student) {
    const s = this.get(); s.student = student; this.save(s);
  },
  clearCart() {
    const s = this.get();
    s.cart = [];
    this.save(s);
  },
  clearAll() { localStorage.removeItem(STATE_KEY); },

  // Cart helpers
  addOrUpdateItem(item) {
    // item: { id, type, color, size, qty, unitPrice, label }
    const cart = this.getCart();
    const idx = cart.findIndex(c => c.id === item.id);
    if (idx >= 0) { cart[idx] = item; } else { cart.push(item); }
    this.setCart(cart);
  },
  removeItem(id) {
    this.setCart(this.getCart().filter(c => c.id !== id));
  },
  getTotal() {
    return this.getCart().reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  },
  getItemCount() {
    return this.getCart().reduce((sum, item) => sum + item.qty, 0);
  },
};

// ── Utilities ─────────────────────────────────────────────
function generateTransactionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SRC-${dateStr}-${rand}`;
}

// ── Supabase Operations ────────────────────────────────────
async function insertStudent(data) {
  const db = getSupabase();
  if (!db) {
    showLuxAlert('Database configuration missing. Please refresh.', 'System Error', 'ph ph-warning-circle', 'error');
    throw new Error('Supabase not initialised');
  }
  
  try {
    // 1. Check if student already exists by phone (use limit(1) to avoid multi-row errors)
    const { data: rows, error: findError } = await db
      .from('students')
      .select('id')
      .eq('phone', data.phone)
      .limit(1);
      
    if (findError) {
      console.error('[Supabase Error] Failed to verify existing student:', findError);
      showLuxAlert('Network issue. Could not verify student record.', 'Connection Error', 'ph ph-wifi-slash', 'error');
      throw findError;
    }

    const existing = rows && rows.length > 0 ? rows[0] : null;
      
    if (existing) {
      // 2a. Update their details gracefully if they already exist
      const { error: updateError } = await db
        .from('students')
        .update(data)
        .eq('id', existing.id);
        
      if (updateError) {
        console.error('[Supabase Error] Failed to update existing student:', updateError);
        showLuxAlert('Failed to update existing student profile.', 'Update Error', 'ph ph-warning', 'error');
        throw updateError;
      }
      return existing.id;
    }

    // 2b. Insert if new
    const { data: result, error: insertError } = await db
      .from('students')
      .insert([data])
      .select('id');
      
    if (insertError) {
      console.error('[Supabase Error] Failed to insert new student:', insertError);
      
      // Fallback: If there was a race condition making the phone number duplicate right after our check
      if (insertError.code === '23505' || (insertError.message && insertError.message.includes('duplicate'))) {
        console.warn('[Supabase Warning] Duplicate constraint triggered. Recovering gracefully...');
        // Re-fetch the existing student that was inserted by the concurrent call
        const { data: retry } = await db.from('students').select('id').eq('phone', data.phone).limit(1);
        if (retry && retry.length > 0) return retry[0].id;
      }
      showLuxAlert('Network error while saving student profile.', 'Save Failed', 'ph ph-warning', 'error');
      throw insertError;
    }
    
    if (!result || result.length === 0) {
      throw new Error('Student insert returned no results');
    }
    return result[0].id;
  } catch (err) {
    console.error('[Unexpected Error] insertStudent encountered an issue:', err);
    throw err;
  }
}

async function insertOrder(data) {
  const db = getSupabase();
  if (!db) {
    showLuxAlert('Database configuration missing. Please refresh.', 'System Error', 'ph ph-warning-circle', 'error');
    throw new Error('Supabase not initialised');
  }
  
  try {
    const { data: result, error } = await db
      .from('orders')
      .insert([data])
      .select('order_id');
      
    if (error) {
      console.error('[Supabase Error] Failed to insert order:', error);
      showLuxAlert('Network error while finalizing order details.', 'Checkout Issue', 'ph ph-warning', 'error');
      throw error;
    }
    
    if (!result || result.length === 0) {
      const emptyErr = new Error('Insert query returned empty results successfully.');
      console.error('[Supabase Error]', emptyErr);
      throw emptyErr;
    }
    
    return result[0].order_id;
  } catch (err) {
    console.error('[Unexpected Error] insertOrder encountered an issue:', err);
    throw err;
  }
}

async function updatePaymentStatus(transaction_id, status) {
  const db = getSupabase();
  if (!db) {
    showLuxAlert('Database configuration missing. Please refresh.', 'System Error', 'ph ph-warning-circle', 'error');
    throw new Error('Supabase not initialised');
  }

  try {
    const { error } = await db
      .from('orders')
      .update({ payment_status: status })
      .eq('transaction_id', transaction_id);
      
    if (error) {
      console.error(`[Supabase Error] Failed to update payment status for TX ${transaction_id}:`, error);
      showLuxAlert('Network error while syncing your payment.', 'Sync Failed', 'ph ph-warning', 'error');
      throw error;
    }
  } catch (err) {
    console.error('[Unexpected Error] updatePaymentStatus encountered an issue:', err);
    throw err;
  }
}

async function deleteOrder(transaction_id, admin_username) {
  const db = getSupabase();
  if (!db) {
    showLuxAlert('Database configuration missing. Please refresh.', 'System Error', 'ph ph-warning-circle', 'error');
    throw new Error('Supabase not initialised');
  }

  try {
    // 1. Fetch all order records for this transaction
    const { data: orders, error: fetchError } = await db
      .from('orders')
      .select('*')
      .eq('transaction_id', transaction_id);

    if (fetchError) {
      console.error(`[Supabase Error] Could not pre-fetch TX ${transaction_id} for deletion:`, fetchError);
      showLuxAlert('Could not reach the server to fetch records.', 'Delete Failed', 'ph ph-wifi-slash', 'error');
      throw fetchError;
    }
    
    if (!orders || orders.length === 0) return;

    // 2. Insert into deleted_orders table
    const archiveData = orders.map(order => ({
      ...order,
      deleted_by: admin_username || 'Unknown Admin'
    }));

    const { error: archiveError } = await db
      .from('deleted_orders')
      .insert(archiveData);

    if (archiveError) {
      console.error('[Supabase Error] Failed to safely archive deleted order:', archiveError);
      showLuxAlert('Could not safely archive records prior to deletion.', 'Safety Lock', 'ph ph-shield-warning', 'error');
      throw archiveError;
    }

    // 3. Delete from original orders table
    const { error: deleteError } = await db
      .from('orders')
      .delete()
      .eq('transaction_id', transaction_id);

    if (deleteError) {
      console.error(`[Supabase Error] Failed to cleanly erase TX ${transaction_id} from primary records:`, deleteError);
      showLuxAlert('Failed to permanently erase the order.', 'Deletion Error', 'ph ph-warning', 'error');
      throw deleteError;
    }
  } catch (err) {
    console.error('[Unexpected Error] deleteOrder encountered an issue:', err);
    throw err;
  }
}

async function getAllOrders() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase not initialised');

  // Fetch orders and join twice with students: once for recipient, once for buyer
  // We use the foreign key column names as aliases/identifiers
  const { data, error } = await db
    .from('orders')
    .select(`
      *,
      student:students!student_id(name, phone, hostel, programme, class),
      buyer:students!buyer_id(name, phone)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// ── Admin Auth ─────────────────────────────────────────────
const AdminAuth = {
  KEY: 'srcAdminAuth',
  DURATION: 2 * 60 * 60 * 1000, // 2 Hours in ms
  isAuthenticated() {
    return this.getUser() !== null;
  },
  async login(username, password) {
    const db = getSupabase();
    if (!db) return false;

    try {
      const { data, error } = await db
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        return false;
      }

      const sessionData = {
        username: data.username,
        full_name: data.full_name,
        role: data.role,
        token: btoa(data.username + '_' + Date.now()),
        login_at: Date.now() // NEW: Track login time
      };

      sessionStorage.setItem(this.KEY, JSON.stringify(sessionData));
      return true;
    } catch (err) {
      return false;
    }
  },
  getUser() {
    const data = sessionStorage.getItem(this.KEY);
    if (!data) return null;

    try {
      const session = JSON.parse(data);
      const now = Date.now();

      // Check for expiration
      if (session.login_at && (now - session.login_at > this.DURATION)) {
        this.logout();
        return null;
      }

      return session;
    } catch (e) {
      this.logout();
      return null;
    }
  },
  logout() {
    sessionStorage.removeItem(this.KEY);
  },
};

// ── Global Initialisation ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const countEl = document.getElementById('cartCounter');
  if (countEl) countEl.textContent = AppState.getItemCount();
});

function initNavbar() {
  const navbar = document.querySelector('.lux-navbar') || document.querySelector('.navbar-main');
  const toggle = document.querySelector('.nav-mobile-toggle');
  const navLinks = document.querySelector('.nav-links-lux') || document.querySelector('.nav-links');

  // Scroll shadow
  if (navbar) {
    const onScroll = () => {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial check
  }

  // Mobile toggle
  if (toggle && navLinks) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navLinks.classList.toggle('open');
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('ph-list');
        icon.classList.toggle('ph-x');
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !toggle.contains(e.target)) {
        navLinks.classList.remove('open');
        const icon = toggle.querySelector('i');
        if (icon) {
          icon.classList.add('ph-list');
          icon.classList.remove('ph-x');
        }
      }
    });

    // Close nav when a link is clicked
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }
}

// ── Side Cart Drawer ───────────────────────────────────────
function initSideCart() {
  // Prevent showing on admin, checkout, or confirmation pages
  const path = window.location.pathname;
  if (path.includes('admin') || path.includes('checkout') || path.includes('confirmation')) return;
  if (document.getElementById('sideCartDrawer')) return;

  const drawerHtml = `
    <div id="sideCartOverlay" class="lux-drawer-overlay"></div>
    <div id="sideCartDrawer" class="lux-drawer">
      <div class="lux-drawer-header">
        <h2 class="lux-drawer-title">Your Order</h2>
        <button class="lux-drawer-close" id="closeSideCart"><i class="ph ph-x"></i></button>
      </div>
      <div id="sideCartBody" class="lux-drawer-body">
        <!-- Items will be injected here -->
      </div>
      <div class="lux-drawer-footer">
        <div class="drawer-total-row">
          <span class="drawer-total-label">Subtotal</span>
          <span id="drawerTotalValue" class="drawer-total-value">GHS 0.00</span>
        </div>
        <button id="goToCheckoutBtn" class="btn-lux w-100">
          Proceed to Checkout <i class="ph ph-arrow-right"></i>
        </button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', drawerHtml);

  // Event Listeners
  const overlay = document.getElementById('sideCartOverlay');
  const drawer = document.getElementById('sideCartDrawer');
  const closeBtn = document.getElementById('closeSideCart');
  const checkoutBtn = document.getElementById('goToCheckoutBtn');

  const toggle = (open) => {
    if (open) {
      overlay.classList.add('active');
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
      updateCartUI();
    } else {
      overlay.classList.remove('active');
      drawer.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  overlay.addEventListener('click', () => toggle(false));
  closeBtn.addEventListener('click', () => toggle(false));
  checkoutBtn.addEventListener('click', () => {
    if (AppState.getCart().length > 0) {
      window.location.href = 'checkout.html';
    } else {
      alert('Your cart is empty.');
    }
  });

  // Global trigger for any .cart-trigger
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.cart-trigger');
    if (trigger) {
      e.preventDefault();
      toggle(true);
    }
  });

  // Initial update
  updateCartUI();
}

// Global Clear Cart Confirmation
window.confirmClearCart = function() {
  if (AppState.getCart().length === 0) return;
  
  if (confirm("Are you sure you want to clear your entire basket? This cannot be undone.")) {
    AppState.clearCart();
    showLuxAlert("Your basket has been cleared successfully.", "Basket Cleared", "ph ph-check-circle", "success");
    const overlay = document.getElementById('sideCartOverlay');
    if (overlay) overlay.click(); // Close drawer
    
    // If on checkout page, redirect
    if (window.location.pathname.includes('checkout')) {
      window.location.href = 'product.html';
    }
  }
};

function updateCartUI() {
  const cart = AppState.getCart();
  const count = AppState.getItemCount();
  const counter = document.getElementById('cartCounter');
  const body = document.getElementById('sideCartBody');
  const totalDisplay = document.getElementById('drawerTotalValue');

  // Update Badge
  if (counter) {
    counter.textContent = count;
    counter.classList.remove('pop');
    void counter.offsetWidth; // Trigger reflow
    counter.classList.add('pop');
  }

  // Update Drawer Body
  if (body) {
    if (cart.length === 0) {
      body.innerHTML = `
        <div class="drawer-empty-state">
          <i class="ph ph-shopping-bag-open" style="font-size: 64px; opacity: 0.2; margin-bottom: 24px; display: block;"></i>
          <p class="serif" style="font-size: 20px; opacity: 0.5;">Your cart is empty</p>
          <button class="btn-lux btn-lux-outline mt-3" onclick="document.getElementById('sideCartOverlay').click()">Continue Shopping</button>
        </div>
      `;
    } else {
      let itemsHtml = '';
      let total = 0;
      cart.forEach(item => {
        total += item.unitPrice * (item.qty || 1);
        itemsHtml += `
          <div class="drawer-item">
            <div class="drawer-item-img" style="background: ${item.colorHex || '#eee'};"></div>
            <div class="drawer-item-info">
              <div class="drawer-item-title">${item.color} Shirt · ${item.size}</div>
              <div class="drawer-item-meta">${item.texture} · ${item.package === 'bundle' ? 'Bundle' : 'Shirt'}</div>
              ${item.hasNickname ? `<div class="drawer-item-meta" style="color: var(--lux-gold);">"${item.nickname}"</div>` : ''}
              ${item.isGift ? `<div class="drawer-item-meta" style="color: var(--lux-gold); font-weight: 600;">Gift: ${item.recipient.name}</div>` : ''}
              <div class="fw-bold mt-1" style="font-size: 14px;">GHS ${(item.unitPrice * (item.qty || 1)).toFixed(2)}</div>
            </div>
            <button class="drawer-item-remove" onclick="AppState.removeItem('${item.id}')">
              <i class="ph ph-trash"></i>
            </button>
          </div>
        `;
      });
      body.innerHTML = itemsHtml + `
        <div class="d-flex justify-content-end px-3 mt-3">
          <button class="btn-clear-cart-lux" onclick="confirmClearCart()">Clear All</button>
        </div>
      `;
      if (totalDisplay) totalDisplay.textContent = `GHS ${total.toFixed(2)}`;
    }
  }
}

// ── Countdown Timer ────────────────────────────────────────
function initCountdown(targetDate, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  function update() {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      container.innerHTML = '<p class="countdown-closed">Orders Closed</p>';
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const fmt = n => String(n).padStart(2, '0');
    const units = [
      { label: 'DAYS', value: days },
      { label: 'HOURS', value: hours },
      { label: 'MINUTES', value: minutes },
      { label: 'SECONDS', value: seconds },
    ];

    container.innerHTML = units.map(u => `
      <div class="countdown-box">
        <span class="countdown-num">${fmt(u.value)}</span>
        <span class="countdown-label">${u.label}</span>
      </div>
    `).join('<span class="countdown-sep">:</span>');
  }

  update();
  setInterval(update, 1000);
}

// ── CSV Export ─────────────────────────────────────────────
function exportOrdersCSV(orders) {
  const headers = ['Date', 'Name', 'Student ID', 'Program', 'Year', 'Phone', 'Items', 'Subtotal', 'Total', 'Status', 'Payment Ref'];
  const rows = orders.map(o => [
    new Date(o.created_at).toLocaleDateString(),
    o.student_name,
    o.student_id,
    o.program,
    o.year,
    o.phone,
    JSON.stringify(o.items),
    o.subtotal,
    o.total,
    o.status,
    o.payment_ref || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `src-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── DOM Ready helper ───────────────────────────────────────
function onReady(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}


// ── Luxury Alert System ──────────────────────────
function showLuxAlert(message, title = 'Notification', icon = 'ph ph-info', variant = 'default') {
  let overlay = document.getElementById('luxModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'luxModalOverlay';
    overlay.className = 'lux-modal-overlay';
    overlay.innerHTML = `
      <div class="lux-modal">
        <div class="lux-modal-icon"><i id="luxModalIcon"></i></div>
        <h3 id="luxModalTitle" class="lux-modal-title"></h3>
        <p id="luxModalBody" class="lux-modal-body"></p>
        <button id="luxModalClose" class="btn-lux lux-modal-btn">OK</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#luxModalClose').addEventListener('click', () => {
      overlay.classList.remove('active');
    });
  }
  
  const modal = overlay.querySelector('.lux-modal');
  modal.className = `lux-modal variant-${variant}`;
  overlay.className = `lux-modal-overlay variant-${variant}`;
  
  const iconWrap = overlay.querySelector('.lux-modal-icon');
  iconWrap.classList.toggle('pulse', variant === 'success');
  
  const iconEl = overlay.querySelector('#luxModalIcon');
  iconEl.className = icon;
  overlay.querySelector('#luxModalTitle').textContent = title;
  overlay.querySelector('#luxModalBody').textContent = message;
  
  if (variant === 'success' && typeof confetti === 'function') {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#b8933f', '#0f1923', '#ffffff'],
      zIndex: 12000 // Higher than 11000 (overlay)
    });
  }

  setTimeout(() => {
    overlay.classList.add('active');
  }, 10);
}

// Auto-init shared components
onReady(() => {
  initNavbar();
  initSideCart();
  
  // Initialize Global Countdown
  if (document.getElementById('preorder-countdown')) {
    initCountdown(new Date('2026-06-12T00:00:00'), 'preorder-countdown');
  }
});

// ── WhatsApp Order Formatter ──────────────────────────────
window.generateWhatsAppSummary = function(orderData, cart) {
  const { transactionId, fullName, phone, hostel, className, programme, grandTotal, processingFee } = orderData;
  
  let msg = `🛍️ *SRC PULSE LUXURY ORDER* 🛍️\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `👤 *CUSTOMER DETAILS*\n`;
  msg += `*Name:* ${fullName}\n`;
  msg += `*Phone:* ${phone}\n`;
  if (programme) msg += `*Programme:* ${programme}\n`;
  if (className) msg += `*Class:* ${className}\n`;
  if (hostel) msg += `*Hostel:* ${hostel}\n\n`;

  msg += `📦 *CART ITEMS*\n`;
  
  cart.forEach((item, index) => {
    msg += `*${index + 1}. ${item.color} Shirt*\n`;
    msg += `   • Size: ${item.size}\n`;
    msg += `   • Fabric: ${item.texture}\n`;
    msg += `   • Qty: ${item.qty || 1}\n`;
    msg += `   • Package: ${item.package === 'bundle' ? 'Bundle (Shirt + Cap)' : 'Shirt Only'}\n`;
    
    if (item.hasNickname) {
      msg += `   • Nickname: "${item.nickname}"\n`;
    }
    
    if (item.isGift && item.recipient) {
      msg += `   🎁 *Gift For:* ${item.recipient.name}\n`;
      if (item.recipient.phone && item.recipient.phone !== 'N/A') msg += `      Phone: ${item.recipient.phone}\n`;
      if (item.recipient.hostel && item.recipient.hostel !== 'N/A') msg += `      Hostel: ${item.recipient.hostel}\n`;
    }
    
    const itemTotal = item.unitPrice * (item.qty || 1);
    msg += `   💵 *Item Subtotal:* GHS ${itemTotal.toFixed(2)}\n\n`;
  });

  const rawSubTotal = cart.reduce((sum, item) => sum + (item.unitPrice * (item.qty || 1)), 0);

  msg += `🧾 *FINANCIAL SUMMARY*\n`;
  msg += `*Cart Subtotal:* GHS ${rawSubTotal.toFixed(2)}\n`;
  if (processingFee) msg += `*Service & Processing Fee:* GHS ${processingFee.toFixed(2)}\n`;
  msg += `*TOTAL DUE:* GHS ${grandTotal.toFixed(2)}\n\n`;

  if (transactionId) msg += `🔑 *Transaction ID:* ${transactionId}\n`;
  msg += `📅 *Date:* ${new Date().toLocaleString()}\n\n`;
  msg += `_Automated checkout request via SRC Pulse._`;

  return msg;
};
