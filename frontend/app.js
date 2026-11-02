// ShopStore Frontend Application
const API_BASE = '/api';
let cart = [];
let products = [];
let categories = [];

// Utility functions
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const countElements = document.querySelectorAll('#cart-count');
    countElements.forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    });
}

function getCartFromStorage() {
    try {
        const stored = localStorage.getItem('shopstore_cart');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveCartToStorage() {
    localStorage.setItem('shopstore_cart', JSON.stringify(cart));
}

// API functions
async function fetchProducts(category = '', search = '') {
    try {
        let url = `${API_BASE}/products`;
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch products');
        return await response.json();
    } catch (error) {
        console.error('Error fetching products:', error);
        showToast('Failed to load products', 'error');
        return [];
    }
}

async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        return await response.json();
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

async function fetchProduct(id) {
    try {
        const response = await fetch(`${API_BASE}/products/${id}`);
        if (!response.ok) throw new Error('Product not found');
        return await response.json();
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
}

async function validateCart(items) {
    try {
        const response = await fetch(`${API_BASE}/cart/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        return await response.json();
    } catch (error) {
        console.error('Error validating cart:', error);
        return { valid: false, errors: ['Validation failed'] };
    }
}

async function createOrder(orderData) {
    try {
        const response = await fetch(`${API_BASE}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating order:', error);
        return { success: false, error: 'Failed to create order' };
    }
}

async function fetchOrder(id) {
    try {
        const response = await fetch(`${API_BASE}/orders/${id}`);
        if (!response.ok) throw new Error('Order not found');
        return await response.json();
    } catch (error) {
        console.error('Error fetching order:', error);
        return null;
    }
}

// Product page functions
async function loadProducts(category = '', search = '') {
    const grid = document.getElementById('products-grid');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    
    if (grid) grid.style.display = 'none';
    if (loading) loading.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    products = await fetchProducts(category, search);
    
    if (loading) loading.style.display = 'none';
    
    if (products.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = products.map(product => createProductCard(product)).join('');
        
        // Add event listeners to add to cart buttons
        grid.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = parseInt(e.currentTarget.dataset.productId);
                addToCart(productId);
            });
        });
    }
}

function createProductCard(product) {
    return `
        <article class="product-card">
            <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
            <div class="product-info">
                <span class="product-category">${product.category}</span>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-footer">
                    <span class="product-price">${formatPrice(product.price)}</span>
                    <button class="btn btn-primary add-to-cart-btn" data-product-id="${product.id}">
                        Add to Cart
                    </button>
                </div>
            </div>
        </article>
    `;
}

async function loadCategories() {
    categories = await fetchCategories();
    const select = document.getElementById('category-filter');
    if (select) {
        select.innerHTML = '<option value="">All Categories</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        
        select.addEventListener('change', (e) => {
            const search = document.getElementById('search-input')?.value || '';
            loadProducts(e.target.value, search);
        });
    }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const category = document.getElementById('category-filter')?.value || '';
                loadProducts(category, e.target.value);
            }, 300);
        });
    }
}

// Cart functions
function initCart() {
    cart = getCartFromStorage();
    updateCartCount();
}

function addToCart(productId, quantity = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: quantity
        });
    }
    
    saveCartToStorage();
    updateCartCount();
    showToast(`${product.name} added to cart`, 'success');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    saveCartToStorage();
    updateCartCount();
    renderCart();
    renderCheckoutItems();
}

function updateCartQuantity(productId, quantity) {
    const item = cart.find(item => item.productId === productId);
    if (item) {
        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = quantity;
            saveCartToStorage();
            updateCartCount();
            renderCart();
            renderCheckoutItems();
        }
    }
}

function calculateCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = subtotal > 0 ? 9.99 : 0;
    const total = subtotal + shipping;
    return { subtotal, shipping, total };
}

function renderCart() {
    const cartItems = document.getElementById('cart-items');
    const cartEmpty = document.getElementById('cart-empty');
    const cartContent = document.getElementById('cart-content');
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const totalEl = document.getElementById('total');
    
    if (!cartItems) return;
    
    if (cart.length === 0) {
        if (cartEmpty) cartEmpty.style.display = 'block';
        if (cartContent) cartContent.style.display = 'none';
        return;
    }
    
    if (cartEmpty) cartEmpty.style.display = 'none';
    if (cartContent) cartContent.style.display = 'grid';
    
    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item" data-product-id="${item.productId}">
            <img src="${item.image}" alt="${item.name}" class="cart-item-image">
            <div class="cart-item-details">
                <span class="cart-item-title">${item.name}</span>
                <span class="cart-item-price">${formatPrice(item.price)} each</span>
            </div>
            <div class="item-quantity">
                <button class="quantity-btn" onclick="updateCartQuantity(${item.productId}, ${item.quantity - 1})">-</button>
                <span class="quantity-value">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateCartQuantity(${item.productId}, ${item.quantity + 1})">+</button>
            </div>
            <span class="item-price item-total">${formatPrice(item.price * item.quantity)}</span>
            <button class="remove-btn" onclick="removeFromCart(${item.productId})">Remove</button>
        </div>
    `).join('');
    
    const { subtotal, shipping, total } = calculateCartTotals();
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (shippingEl) shippingEl.textContent = formatPrice(shipping);
    if (totalEl) totalEl.textContent = formatPrice(total);
}

// Checkout functions
function renderCheckoutItems() {
    const checkoutItems = document.getElementById('checkout-items');
    const checkoutSubtotal = document.getElementById('checkout-subtotal');
    const checkoutShipping = document.getElementById('checkout-shipping');
    const checkoutTotal = document.getElementById('checkout-total');
    
    if (!checkoutItems) return;
    
    if (cart.length === 0) {
        checkoutItems.innerHTML = '<p>No items in cart</p>';
        return;
    }
    
    checkoutItems.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <img src="${item.image}" alt="${item.name}" class="checkout-item-image">
            <div class="checkout-item-details">
                <span class="checkout-item-title">${item.name}</span>
                <span class="checkout-item-quantity">Qty: ${item.quantity}</span>
            </div>
            <span class="checkout-item-price">${formatPrice(item.price * item.quantity)}</span>
        </div>
    `).join('');
    
    const { subtotal, shipping, total } = calculateCartTotals();
    if (checkoutSubtotal) checkoutSubtotal.textContent = formatPrice(subtotal);
    if (checkoutShipping) checkoutShipping.textContent = formatPrice(shipping);
    if (checkoutTotal) checkoutTotal.textContent = formatPrice(total);
}

async function handleCheckout(event) {
    event.preventDefault();
    
    if (cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }
    
    // Validate cart first
    const validation = await validateCart(cart.map(item => ({
        product_id: item.productId,
        quantity: item.quantity
    })));
    
    if (!validation.valid) {
        showToast(validation.errors.join(', '), 'error');
        return;
    }
    
    // Get form data
    const form = document.getElementById('checkout-form');
    const formData = new FormData(form);
    const shippingInfo = {
        email: formData.get('email'),
        first_name: formData.get('firstName'),
        last_name: formData.get('lastName'),
        address: formData.get('address'),
        city: formData.get('city'),
        state: formData.get('state'),
        zip_code: formData.get('zipCode'),
        country: formData.get('country'),
        phone: formData.get('phone')
    };
    
    // Validate required fields
    const requiredFields = ['email', 'first_name', 'last_name', 'address', 'city', 'state', 'zip_code', 'country', 'phone'];
    for (const field of requiredFields) {
        if (!shippingInfo[field]) {
            showToast(`Please fill in all required fields`, 'error');
            return;
        }
    }
    
    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingInfo.email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Show loading
    const checkoutContent = document.getElementById('checkout-content');
    const checkoutLoading = document.getElementById('checkout-loading');
    const placeOrderBtn = document.getElementById('place-order-btn');
    
    if (checkoutContent) checkoutContent.style.display = 'none';
    if (checkoutLoading) checkoutLoading.style.display = 'block';
    if (placeOrderBtn) placeOrderBtn.disabled = true;
    
    const { subtotal, shipping, total } = calculateCartTotals();
    
    const orderData = {
        items: cart.map(item => ({
            product_id: item.productId,
            quantity: item.quantity
        })),
        shipping_info: shippingInfo,
        total_amount: total
    };
    
    const result = await createOrder(orderData);
    
    if (checkoutLoading) checkoutLoading.style.display = 'none';
    if (placeOrderBtn) placeOrderBtn.disabled = false;
    
    if (result.success && result.order_id) {
        // Clear cart
        cart = [];
        saveCartToStorage();
        updateCartCount();
        
        // Redirect to order confirmation
        window.location.href = `/order/${result.order_id}`;
    } else {
        if (checkoutContent) checkoutContent.style.display = 'grid';
        showToast(result.error || 'Failed to place order. Please try again.', 'error');
    }
}

// Order confirmation functions
async function loadOrder(orderId) {
    const orderLoading = document.getElementById('order-loading');
    const orderError = document.getElementById('order-error');
    const orderContent = document.getElementById('order-content');
    const errorMessage = document.getElementById('error-message');
    
    if (orderLoading) orderLoading.style.display = 'block';
    if (orderError) orderError.style.display = 'none';
    if (orderContent) orderContent.style.display = 'none';
    
    const order = await fetchOrder(orderId);
    
    if (orderLoading) orderLoading.style.display = 'none';
    
    if (!order) {
        if (orderError) orderError.style.display = 'block';
        if (errorMessage) errorMessage.textContent = 'We couldn\'t find an order with that ID.';
        return;
    }
    
    if (orderContent) orderContent.style.display = 'block';
    
    // Populate order details
    const orderIdEl = document.getElementById('order-id');
    const orderDateEl = document.getElementById('order-date');
    const orderEmailEl = document.getElementById('order-email');
    const shippingAddressEl = document.getElementById('shipping-address');
    const orderItemsEl = document.getElementById('order-items');
    const finalSubtotalEl = document.getElementById('final-subtotal');
    const finalShippingEl = document.getElementById('final-shipping');
    const finalTotalEl = document.getElementById('final-total');
    
    if (orderIdEl) orderIdEl.textContent = order.id;
    if (orderDateEl) orderDateEl.textContent = formatDate(order.created_at);
    if (orderEmailEl) orderEmailEl.textContent = order.shipping_info.email;
    
    if (shippingAddressEl) {
        const addr = order.shipping_info;
        shippingAddressEl.innerHTML = `
            ${addr.first_name} ${addr.last_name}<br>
            ${addr.address}<br>
            ${addr.city}, ${addr.state} ${addr.zip_code}<br>
            ${addr.country}<br>
            Phone: ${addr.phone}
        `;
    }
    
    if (orderItemsEl) {
        orderItemsEl.innerHTML = order.items.map(item => `
            <div class="order-item">
                <img src="${item.image}" alt="${item.name}" class="order-item-image">
                <div class="order-item-details">
                    <span class="order-item-title">${item.name}</span>
                    <span class="order-item-meta">Qty: ${item.quantity} × ${formatPrice(item.price)}</span>
                </div>
                <span class="order-item-total">${formatPrice(item.price * item.quantity)}</span>
            </div>
        `).join('');
    }
    
    if (finalSubtotalEl) finalSubtotalEl.textContent = formatPrice(order.subtotal);
    if (finalShippingEl) finalShippingEl.textContent = formatPrice(order.shipping);
    if (finalTotalEl) finalTotalEl.textContent = formatPrice(order.total);
}

// Page initialization
function initProductPage() {
    loadCategories();
    loadProducts();
}

function initCartPage() {
    initCart();
    renderCart();
}

function initCheckoutPage() {
    initCart();
    
    if (cart.length === 0) {
        const checkoutEmpty = document.getElementById('checkout-empty');
        const checkoutContent = document.getElementById('checkout-content');
        if (checkoutEmpty) checkoutEmpty.style.display = 'block';
        if (checkoutContent) checkoutContent.style.display = 'none';
        return;
    }
    
    const checkoutEmpty = document.getElementById('checkout-empty');
    const checkoutContent = document.getElementById('checkout-content');
    if (checkoutEmpty) checkoutEmpty.style.display = 'none';
    if (checkoutContent) checkoutContent.style.display = 'grid';
    
    renderCheckoutItems();
    
    const form = document.getElementById('checkout-form');
    if (form) {
        form.addEventListener('submit', handleCheckout);
    }
    
    const placeOrderBtn = document.getElementById('place-order-btn');
    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', handleCheckout);
    }
}

function initOrderPage() {
    // Extract order ID from URL
    const pathParts = window.location.pathname.split('/');
    const orderId = pathParts[pathParts.length - 1];
    
    if (orderId && orderId !== 'order') {
        loadOrder(orderId);
    } else {
        const orderLoading = document.getElementById('order-loading');
        const orderError = document.getElementById('order-error');
        if (orderLoading) orderLoading.style.display = 'none';
        if (orderError) orderError.style.display = 'block';
    }
}

// Global event handlers
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    if (path === '/' || path === '/index.html') {
        initProductPage();
    } else if (path === '/cart' || path === '/cart.html') {
        initCartPage();
    } else if (path === '/checkout' || path === '/checkout.html') {
        initCheckoutPage();
    } else if (path.startsWith('/order/')) {
        initOrderPage();
    }
    
    // Initialize cart count on all pages
    initCart();
});