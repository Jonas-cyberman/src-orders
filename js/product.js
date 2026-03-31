/**
 * js/product.js
 * Handles product selection logic for the Luxury Redesign
 */

const PRICES = {
  shirt: 45,
  cap: 25,
  nickname: 5
};

const COLORS = [
  { id: 'navy', name: 'Navy Tradition', hex: '#1C2E4A', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.37 (1).jpeg' },
  { id: 'burgundy', name: 'Royal Burgundy', hex: '#C21E2D', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.36.jpeg' },
  { id: 'green', name: 'Emerald Green', hex: '#1E8449', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.37 (2).jpeg' },
  { id: 'black', name: 'Midnight Black', hex: '#111111', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.37.jpeg' },
  { id: 'royal_blue', name: 'Deep Royal', hex: '#2E5090', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.38 (1).jpeg' },
  { id: 'yellow', name: 'Heritage Gold', hex: '#F1C40F', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.38.jpeg' },
  { id: 'white', name: 'Classic White', hex: '#F8F9FA', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.39 (1).jpeg' },
  { id: 'pink', name: 'Dusty Pink', hex: '#F5B7B1', img: 'img/SRC SHIRTS/WhatsApp Image 2026-03-13 at 19.03.39.jpeg' }
];

const classMapping = {
  'RGN': ['RGN13 A', 'RGN13 B', 'RGN14 A', 'RGN14 B', 'RGN15'],
  'RM': ['RM10A', 'RM10B', 'RM11', 'RM12'],
  'NAC': ['NAC17', 'NAC18']
};

// State
let state = {
  color: COLORS[0],
  size: null,
  texture: null,
  package: null,
  hasNickname: false,
  nickname: '',
  isGift: false,
  friend: { name: '', phone: '', hostel: '', programme: '', class: '' }
};

// DOM Elements (Luxury Selectors)
const DOM = {
  previewImg: document.getElementById('shirt-preview'),
  colorName: document.getElementById('color-name-display'),
  swatchContainer: document.getElementById('color-swatches'),
  sizeBtns: document.querySelectorAll('.size-btn-lux'),
  textureCards: document.querySelectorAll('[data-texture]'),
  pkgCards: document.querySelectorAll('.package-card-lux[data-pkg]'),
  nickToggle: document.getElementById('addNickname'),
  nickGroup: document.getElementById('nicknameInputGroup'),
  nickField: document.getElementById('nicknameText'),
  priceTags: document.querySelectorAll('.price-tag-lux'),
  addToCartBtn: document.getElementById('addToCartBtn'),
  checkoutBtn: document.getElementById('checkoutBtn'),
  cartCount: document.getElementById('cartCounter'),
  giftToggle: document.getElementById('giftToggle'),
  giftForm: document.getElementById('giftForm'),
  friendFields: {
    name: document.getElementById('friendName'),
    phone: document.getElementById('friendPhone'),
    hostel: document.getElementById('friendHostel'),
    programme: document.getElementById('friendProgramme'),
    class: document.getElementById('friendClass')
  }
};

function init() {
  renderSwatches();
  attachEvents();
  updateUI();

  // Handle color query parameter
  const params = new URLSearchParams(window.location.search);
  const colorId = params.get('color');
  if (colorId && COLORS.some(c => c.id === colorId)) {
    selectColor(colorId);
  }
}

function renderSwatches() {
  DOM.swatchContainer.innerHTML = COLORS.map(c => `
    <div 
      class="lux-swatch ${c.id === state.color.id ? 'active' : ''}" 
      data-lux-color="${c.id}"
      style="background-color: ${c.hex};"
      title="${c.name}"
    ></div>
  `).join('');
}

function attachEvents() {
  // Swatches
  DOM.swatchContainer.addEventListener('click', e => {
    const swatch = e.target.closest('.lux-swatch');
    if (swatch) {
      const id = swatch.getAttribute('data-lux-color');
      selectColor(id);
    }
  });

  // Sizes
  DOM.sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.size = btn.getAttribute('data-size');
      DOM.sizeBtns.forEach(b => b.classList.toggle('active', b === btn));
      updateUI();
    });
  });

  // Texture
  DOM.textureCards.forEach(card => {
    card.addEventListener('click', () => {
      state.texture = card.getAttribute('data-texture');
      DOM.textureCards.forEach(c => c.classList.toggle('active', c === card));
      updateUI();
    });
  });

  // Package
  DOM.pkgCards.forEach(card => {
    card.addEventListener('click', () => {
      state.package = card.getAttribute('data-pkg');
      DOM.pkgCards.forEach(c => c.classList.toggle('active', c === card));
      updateUI();
      selectColor(state.color.id); // Refresh preview for new package
    });
  });

  // Nickname
  DOM.nickToggle.addEventListener('change', e => {
    state.hasNickname = e.target.checked;
    DOM.nickGroup.style.display = state.hasNickname ? 'block' : 'none';
    if (state.hasNickname) DOM.nickField.focus();
    updateUI();
  });

  DOM.nickField.addEventListener('input', e => {
    state.nickname = e.target.value.toUpperCase();
  });

  // Gift Toggle
  if (DOM.giftToggle) {
    DOM.giftToggle.addEventListener('change', (e) => {
      state.isGift = e.target.checked;
      DOM.giftForm.style.display = state.isGift ? 'block' : 'none';
      if (state.isGift) DOM.friendFields.name.focus();
    });

    // Friend Fields
    Object.keys(DOM.friendFields).forEach(key => {
      DOM.friendFields[key].addEventListener('input', (e) => {
        state.friend[key] = e.target.value;
        
        // Handle dynamic class update
        if (key === 'programme') {
          const p = e.target.value;
          const classSelect = DOM.friendFields.class;
          classSelect.innerHTML = '<option value="" disabled selected>Select Class</option>';
          if (classMapping[p]) {
            classMapping[p].forEach(c => {
              const opt = document.createElement('option');
              opt.value = c; opt.textContent = c;
              classSelect.appendChild(opt);
            });
            classSelect.disabled = false;
          } else {
            classSelect.disabled = true;
          }
        }
      });
    });
  }

  // Helper to build item
  const buildItemData = () => {
    const finalPrice = calculateTotal();
    return {
      id: 'ITEM-' + Date.now(),
      color: state.color.name,
      colorHex: state.color.hex,
      size: state.size,
      texture: state.texture,
      package: state.package,
      hasNickname: state.hasNickname,
      nickname: state.nickname,
      unitPrice: finalPrice,
      isGift: state.isGift,
      recipient: state.isGift ? { ...state.friend } : null,
      qty: 1
    };
  };

  // Add to Basket
  if (DOM.addToCartBtn) {
    DOM.addToCartBtn.addEventListener('click', () => {
      if (!state.size || !state.texture || !state.package) {
        showLuxAlert("Please select a size, fabric texture, and product tier before adding to your basket.", "Incomplete Selection", "ph ph-warning");
        return;
      }
      if (state.isGift && !state.friend.name) {
        showLuxAlert("Please enter your friend's name to complete the gift details.", "Missing Detail", "ph ph-warning");
        return;
      }
      AppState.addOrUpdateItem(buildItemData());
      showLuxAlert(`${state.color.name} shirt has been added to your basket.`, "Added to Basket", "ph ph-shopping-basket-horizontal", "success");
      resetStoreForm();
    });
  }

  // WhatsApp Order
  const waOrderBtn = document.getElementById('waOrderBtn');
  if (waOrderBtn) {
    waOrderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!state.size || !state.texture || !state.package) {
        showLuxAlert("Please complete your shirt selection before proceeding to WhatsApp.", "Incomplete Selection", "ph ph-warning");
        return;
      }
      const item = buildItemData();
      let msg = `✅ *SRC PULSE ORDER*\n\n`;
      msg += `*Item:* ${item.color} Shirt (${item.size})\n`;
      msg += `*Style:* ${item.texture}\n`;
      msg += `*Package:* ${item.package === 'bundle' ? 'Shirt + Cap' : 'Shirt Only'}\n`;
      if (item.hasNickname) msg += `*Nickname:* ${item.nickname}\n`;
      if (item.isGift) {
        msg += `\n*Gift for:* ${item.recipient.name}\n`;
        msg += `*Recipient Phone:* ${item.recipient.phone}\n`;
        msg += `*Recipient Hostel:* ${item.recipient.hostel}\n`;
      }
      msg += `\n*Total:* GHS ${item.unitPrice.toFixed(2)}`;
      msg += `\n\nPlease help me process this.`;
      
      const phone = (typeof CONFIG !== 'undefined' && CONFIG.WHATSAPP_NUMBER) ? CONFIG.WHATSAPP_NUMBER : '233240064472';
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
    });
  }

  // Checkout (Immediate)
  DOM.checkoutBtn.addEventListener('click', () => {
    if (AppState.getItemCount() === 0) {
      if (!state.size || !state.texture || !state.package) {
        showLuxAlert("Please select your shirt details before proceeding to checkout.", "Incomplete Selection", "ph ph-warning");
        return;
      }
      if (state.isGift && !state.friend.name) {
        showLuxAlert("Please enter your friend's name to complete the gift details.", "Missing Detail", "ph ph-warning");
        return;
      }
      AppState.addOrUpdateItem(buildItemData());
    }
    window.location.href = 'checkout.html';
  });

  // Listen for cart updates
  window.addEventListener('cartUpdated', () => {
    if (DOM.cartCount) DOM.cartCount.textContent = AppState.getItemCount();
  });
}

function resetStoreForm() {
    state.size = null;
    state.texture = null;
    state.package = null;
    state.hasNickname = false;
    state.nickname = '';
    state.isGift = false;
    state.friend = { name: '', phone: '', hostel: '', programme: '', class: '' };

    // Reset UI
    DOM.sizeBtns.forEach(b => b.classList.remove('active'));
    DOM.textureCards.forEach(b => b.classList.remove('active'));
    DOM.pkgCards.forEach(b => b.classList.remove('active'));
    
    if (DOM.nickToggle) {
        DOM.nickToggle.checked = false;
        DOM.nickGroup.style.display = 'none';
        DOM.nickField.value = '';
    }
    
    if (DOM.giftToggle) {
        DOM.giftToggle.checked = false;
        DOM.giftForm.style.display = 'none';
        Object.keys(DOM.friendFields).forEach(k => DOM.friendFields[k].value = '');
    }

    updateUI();
    selectColor(state.color.id); // Reset preview image to "No cap" version
}

function selectColor(id) {
  state.color = COLORS.find(c => c.id === id);
  DOM.previewImg.style.opacity = '0';

  setTimeout(() => {
    let imgSrc = state.color.img;
    // Map to "WITH CAP" images if bundle is selected
    if (state.package === 'bundle') {
      const idx = COLORS.findIndex(c => c.id === id);
      let num = idx + 1;
      
      // Fix for interchanged images in the WITH CAP folder (1 and 2)
      if (num === 1) num = 2;
      else if (num === 2) num = 1;

      imgSrc = `img/WITH CAP/${num}.jpeg`;
    }
    
    DOM.previewImg.src = imgSrc;
    DOM.previewImg.style.opacity = '1';
    DOM.colorName.textContent = state.color.name;
    document.querySelectorAll('.lux-swatch').forEach(s => {
      s.classList.toggle('active', s.getAttribute('data-lux-color') === id);
    });
  }, 300);
}

function calculateTotal() {
  let total = PRICES.shirt;
  if (state.package === 'bundle') total += PRICES.cap;
  if (state.hasNickname) total += PRICES.nickname;
  return total;
}

function updateUI() {
  const total = calculateTotal();
  DOM.priceTags.forEach(tag => {
    tag.textContent = `GHS ${total.toFixed(2)}`;
  });
}

document.addEventListener('DOMContentLoaded', init);
