// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDoWvDT63Kd8xZUr1Lq0NNMiLjfQMOD0X0",
  authDomain: "circuit-cart.firebaseapp.com",
  projectId: "circuit-cart",
  storageBucket: "circuit-cart.appspot.com",
  messagingSenderId: "38943769135",
  appId: "1:38943769135:web:f49f0977c4ab2c81667cda",
  measurementId: "G-LHSSSKKYMC"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);

// Product data
const PRODUCTS = {
  "SOORYA": { price: 20.00, description: "SOORYA Matches Box" },
  "IODEX": { price: 200.00, description: "IODEX Bam, 9g" }
};

let cart = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Set up button events
  document.getElementById("pay-button").addEventListener("click", () => {
    if (cart.length > 0) {
      showPage("payment-page");
    } else {
      alert("Cart is empty!");
    }
  });

  document.getElementById("cancel-button").addEventListener("click", () => {
    cart = [];
    updateCartDisplay();
  });

  // For demo - add sample products manually
  addProductManually("IODEX");
  addProductManually("SOORYA");
});

// Manual product management
function addProductManually(productId) {
  if (PRODUCTS[productId]) {
    const existing = cart.find(item => item.id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: productId,
        ...PRODUCTS[productId],
        quantity: 1
      });
    }
    updateCartDisplay();
  }
}

// Update cart UI
function updateCartDisplay() {
  const cartList = document.getElementById("cart-list");
  const totalElement = document.getElementById("total-value");
  
  cartList.innerHTML = "";
  let total = 0;
  
  cart.forEach(item => {
    const itemElement = document.createElement("div");
    itemElement.className = "cart-item";
    itemElement.innerHTML = `
      <span>${item.description} - $${item.price.toFixed(2)}</span>
      <div class="quantity-controls">
        <button onclick="changeQuantity('${item.id}', -1)">-</button>
        <span>${item.quantity}</span>
        <button onclick="changeQuantity('${item.id}', 1)">+</button>
      </div>
    `;
    cartList.appendChild(itemElement);
    total += item.price * item.quantity;
  });
  
  totalElement.textContent = total.toFixed(2);
}

// Change quantity
window.changeQuantity = function(productId, change) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      cart = cart.filter(item => item.id !== productId);
    }
    updateCartDisplay();
  }
};

// Page navigation
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
  
  if (pageId === 'bill-page') {
    displayBill();
  }
}

// Payment processing
window.selectPayment = function(method) {
  completePayment(method);
};

async function completePayment(method) {
  try {
    // Save to Firestore
    await db.collection('transactions').add({
      items: cart,
      total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      paymentMethod: method,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showPage("bill-page");
  } catch (error) {
    console.error("Payment failed:", error);
    alert("Payment processing failed");
  }
}

// Display bill
function displayBill() {
  const billItems = document.getElementById("bill-items");
  const billTotal = document.getElementById("bill-total-value");
  
  billItems.innerHTML = "";
  let total = 0;
  
  cart.forEach(item => {
    const itemElement = document.createElement("div");
    itemElement.className = "bill-item";
    itemElement.innerHTML = `
      <span>${item.description} x ${item.quantity}</span>
      <span>$${(item.price * item.quantity).toFixed(2)}</span>
    `;
    billItems.appendChild(itemElement);
    total += item.price * item.quantity;
  });
  
  billTotal.textContent = total.toFixed(2);
}

// SMS functions
window.appendNumber = function(num) {
  const input = document.getElementById("phone-number");
  if (input.value.length < 10) {
    input.value += num;
  }
};

window.sendBillViaSMS = function() {
  const phone = document.getElementById("phone-number").value;
  if (phone.length === 10) {
    alert(`Bill sent to ${phone}`);
    goBackToDashboard();
  } else {
    alert("Invalid phone number");
  }
};

window.goBackToDashboard = function() {
  cart = [];
  updateCartDisplay();
  showPage("dashboard");
};