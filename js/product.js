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

// State
let state = {
  color: COLORS[0],
  size: 'S',
  texture: 'Cotton',
  package: 'shirt',
  hasNickname: false,
  nickname: ''
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
  checkoutBtn: document.getElementById('checkoutBtn')
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

  // Checkout
  DOM.checkoutBtn.addEventListener('click', () => {
    const finalPrice = calculateTotal();
    const orderData = {
      colorName: state.color.name,
      colorHex: state.color.hex,
      size: state.size,
      texture: state.texture,
      package: state.package,
      nickname: state.hasNickname,
      nickText: state.nickname,
      totalPrice: finalPrice
    };
    localStorage.setItem('srcWeekOrder', JSON.stringify(orderData));
    window.location.href = 'checkout.html';
  });
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
