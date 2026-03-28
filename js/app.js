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
  WHATSAPP_NUMBER: '233240064472 ',
};

// ── Supabase Client ────────────────────────────────────────
// Initialised lazily so pages without Supabase can still load
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (typeof supabase === 'undefined') {
      console.warn('Supabase SDK not loaded.');
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
  if (!db) throw new Error('Supabase not initialised');
  const { data: result, error } = await db
    .from('students')
    .insert([data])
    .select('id')
    .single();
  if (error) throw error;
  return result.id;
}

async function insertOrder(data) {
  const db = getSupabase();
  if (!db) throw new Error('Supabase not initialised');
  const { data: result, error } = await db
    .from('orders')
    .insert([data])
    .select('order_id')
    .single();
  if (error) throw error;
  return result.order_id;
}

async function updatePaymentStatus(transaction_id, status) {
  const db = getSupabase();
  if (!db) throw new Error('Supabase not initialised');
  const { error } = await db
    .from('orders')
    .update({ payment_status: status })
    .eq('transaction_id', transaction_id);
  if (error) throw error;
}

async function deleteOrder(transaction_id, admin_username) {
  const db = getSupabase();
  if (!db) throw new Error('Supabase not initialised');

  // 1. Fetch all order records for this transaction
  const { data: orders, error: fetchError } = await db
    .from('orders')
    .select('*')
    .eq('transaction_id', transaction_id);

  if (fetchError) throw fetchError;
  if (!orders || orders.length === 0) return;

  // 2. Insert into deleted_orders table
  const archiveData = orders.map(order => ({
    ...order,
    deleted_by: admin_username || 'Unknown Admin'
  }));

  const { error: archiveError } = await db
    .from('deleted_orders')
    .insert(archiveData);

  if (archiveError) throw archiveError;

  // 3. Delete from original orders table
  const { error: deleteError } = await db
    .from('orders')
    .delete()
    .eq('transaction_id', transaction_id);

  if (deleteError) throw deleteError;
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
      console.error("Auth Exception:", err);
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
        console.warn("Admin session expired.");
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

// ── Shared Navbar Behaviour ────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector('.navbar-main');
  const toggle = document.querySelector('.nav-mobile-toggle');
  const navLinks = document.querySelector('.nav-links');

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
  }

  // Mobile toggle
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const icon = toggle.querySelector('i');
      if (icon) {
        icon.setAttribute('name', navLinks.classList.contains('open') ? 'x' : 'list');
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
  // Prevent showing on admin pages
  if (window.location.pathname.includes('admin')) return;
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
      updateCartUI();
    } else {
      overlay.classList.remove('active');
      drawer.classList.remove('active');
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

  // Listen for state changes
  window.addEventListener('cartUpdated', () => {
    updateCartUI();
  });

  // Initial update
  updateCartUI();
}

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
      body.innerHTML = itemsHtml;
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

// Auto-init shared components
onReady(() => {
  initNavbar();
  initSideCart();
});
