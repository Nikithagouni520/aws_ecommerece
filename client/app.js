const productGrid = document.querySelector("#productGrid");
const categoryFilters = document.querySelector("#categoryFilters");
const searchInput = document.querySelector("#searchInput");
const cartDrawer = document.querySelector("#cartDrawer");
const cartItems = document.querySelector("#cartItems");
const cartCount = document.querySelector("#cartCount");
const cartSubtotal = document.querySelector("#cartSubtotal");
const checkoutModal = document.querySelector("#checkoutModal");
const checkoutForm = document.querySelector("#checkoutForm");
const orderMessage = document.querySelector("#orderMessage");
const newsletterForm = document.querySelector("#newsletterForm");
const newsletterMessage = document.querySelector("#newsletterMessage");

let products = [];
let activeCategory = "All";
let cart = JSON.parse(localStorage.getItem("northstar-cart") || "[]");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    products = await response.json();
  } catch (error) {
    products = [
      {
        id: 1,
        name: "AeroFlex Running Shoes",
        category: "Footwear",
        price: 129,
        rating: 4.8,
        tag: "Best seller",
        image:
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
      },
    ];
  }

  renderFilters();
  renderProducts();
  renderCart();
}

function renderFilters() {
  const categories = ["All", ...new Set(products.map((product) => product.category))];
  categoryFilters.innerHTML = categories
    .map(
      (category) => `
        <button class="filter-button ${category === activeCategory ? "active" : ""}" type="button" data-category="${category}">
          ${category}
        </button>
      `
    )
    .join("");
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const matchesQuery = [product.name, product.category, product.tag]
      .join(" ")
      .toLowerCase()
      .includes(query);

    return matchesCategory && matchesQuery;
  });

  productGrid.innerHTML = filtered.length
    ? filtered.map(productTemplate).join("")
    : '<p class="empty-cart">No products match your search.</p>';
}

function productTemplate(product) {
  return `
    <article class="product-card">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <span class="product-badge">${product.tag}</span>
      </div>
      <div class="product-body">
        <div class="product-title-row">
          <h3>${product.name}</h3>
          <span class="price">${money.format(product.price)}</span>
        </div>
        <div class="product-meta">
          <span>${product.category}</span>
          <span>${product.rating} stars</span>
        </div>
        <button type="button" data-add="${product.id}">Add to cart</button>
      </div>
    </article>
  `;
}

function addToCart(productId) {
  const product = products.find((item) => item.id === productId);
  const existingItem = cart.find((item) => item.id === productId);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  saveCart();
  openCart();
}

function updateQuantity(productId, change) {
  cart = cart
    .map((item) =>
      item.id === productId ? { ...item, quantity: item.quantity + change } : item
    )
    .filter((item) => item.quantity > 0);

  saveCart();
}

function saveCart() {
  localStorage.setItem("northstar-cart", JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  cartCount.textContent = totalQuantity;
  cartSubtotal.textContent = money.format(subtotal);
  cartItems.innerHTML = cart.length
    ? cart.map(cartItemTemplate).join("")
    : '<p class="empty-cart">Your cart is empty. Add a product to get started.</p>';
}

function cartItemTemplate(item) {
  return `
    <article class="cart-item">
      <img src="${item.image}" alt="${item.name}" />
      <div>
        <h3>${item.name}</h3>
        <div class="quantity-row">
          <span>${money.format(item.price)}</span>
          <div class="quantity-controls" aria-label="Quantity controls">
            <button class="quantity-button" type="button" data-decrease="${item.id}" aria-label="Decrease ${item.name} quantity">-</button>
            <strong>${item.quantity}</strong>
            <button class="quantity-button" type="button" data-increase="${item.id}" aria-label="Increase ${item.name} quantity">+</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function openCart() {
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
}

function openCheckout() {
  if (!cart.length) {
    openCart();
    return;
  }

  checkoutModal.classList.add("open");
  checkoutModal.setAttribute("aria-hidden", "false");
}

function closeCheckout() {
  checkoutModal.classList.remove("open");
  checkoutModal.setAttribute("aria-hidden", "true");
}

document.querySelector("#openCart").addEventListener("click", openCart);
document.querySelector("#closeCart").addEventListener("click", closeCart);
document.querySelector("#checkoutButton").addEventListener("click", openCheckout);
document.querySelector("#closeCheckout").addEventListener("click", closeCheckout);

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  orderMessage.textContent = "Placing order...";

  const formData = new FormData(checkoutForm);
  const payload = {
    customerName: formData.get("customerName"),
    email: formData.get("email"),
    address: formData.get("address"),
    items: cart.map(({ id, quantity }) => ({ id, quantity })),
  };

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to place order.");
    }

    cart = [];
    saveCart();
    checkoutForm.reset();
    orderMessage.textContent = `Order #${result.id} placed. Total ${money.format(result.total)}.`;
    setTimeout(() => {
      closeCheckout();
      closeCart();
      orderMessage.textContent = "";
    }, 1600);
  } catch (error) {
    orderMessage.textContent = error.message;
  }
});

categoryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  activeCategory = button.dataset.category;
  renderFilters();
  renderProducts();
});

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;

  addToCart(Number(button.dataset.add));
});

cartItems.addEventListener("click", (event) => {
  const decreaseButton = event.target.closest("[data-decrease]");
  const increaseButton = event.target.closest("[data-increase]");

  if (decreaseButton) updateQuantity(Number(decreaseButton.dataset.decrease), -1);
  if (increaseButton) updateQuantity(Number(increaseButton.dataset.increase), 1);
});

searchInput.addEventListener("input", renderProducts);

cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) closeCart();
});

checkoutModal.addEventListener("click", (event) => {
  if (event.target === checkoutModal) closeCheckout();
});

newsletterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = new FormData(newsletterForm).get("email");
  newsletterMessage.textContent = "Joining...";

  try {
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to join right now.");
    }

    newsletterForm.reset();
    newsletterMessage.textContent = result.message;
  } catch (error) {
    newsletterMessage.textContent = error.message;
  }
});

loadProducts();
