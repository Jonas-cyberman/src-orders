/* ========================================================
   SRC Week Orders — app.js
   Shared logic, Supabase client, state management
   ======================================================== */

// ── Configuration ─────────────────────────────────────────
const CONFIG = {
  SUPABASE_URL: 'https://uzlcleseoxfifrdehdvs.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_gCwbopHregwqci0_l8TXZQ_TzcM7fcR',
  PAYSTACK_KEY: 'pk_test_9fd8a8a914b6c89fb2849c5b4eaf39690600033b',
  ADMIN_PASSWORD: 'srcadmin2024',
  PRICES: {
    shirt: 45,   // GHS
    cap: 25,   // GHS
  },
  DEADLINE: new Date('2026-04-18T23:59:59'),
  SCHOOL: 'Dunkwa-On-Offin Nursing & Midwifery Training College',
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
    try { return JSON.parse(sessionStorage.getItem(STATE_KEY)) || { cart: [], student: {} }; }
    catch { return { cart: [], student: {} }; }
  },
  save(state) {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  },
  getCart() { return this.get().cart; },
  getStudent() { return this.get().student; },
  setCart(cart) {
    const s = this.get(); s.cart = cart; this.save(s);
  },
  setStudent(student) {
    const s = this.get(); s.student = student; this.save(s);
  },
  clearAll() { sessionStorage.removeItem(STATE_KEY); },

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

async function getAllOrders() {
  const db = getSupabase();
  if (!db) throw new Error('Supabase not initialised');
  // Fetch orders and join with students
  const { data, error } = await db
    .from('orders')
    .select(`*, students ( name, phone, hostel, programme, class )`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ── Admin Auth ─────────────────────────────────────────────
const AdminAuth = {
  KEY: 'srcAdminAuth',
  isAuthenticated() { 
    return sessionStorage.getItem(this.KEY) !== null; 
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
        // Fallback for initial setup/legacy
        if (username === 'admin' && password === 'admin123') {
          const fallbackUser = { username: 'admin', full_name: 'Administrator', role: 'Super Admin' };
          sessionStorage.setItem(this.KEY, JSON.stringify(fallbackUser));
          return true;
        }
        return false;
      }
      
      const sessionData = {
        username: data.username,
        full_name: data.full_name,
        role: data.role,
        token: btoa(data.username + '_' + Date.now())
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
    return data ? JSON.parse(data) : null;
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
});
