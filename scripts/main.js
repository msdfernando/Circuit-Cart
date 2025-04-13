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

// Product prices
const PRICES = {
  "SOORYA": { price: 20.00, description: "SOORYA Matches Box, Avg. Sticks 45" },
  "IODEX": { price: 200.00, description: "IODEX Bam, 9g" },
  "ZESTA": { price: 100.00, description: "ZESTA Green Tea, 2g" },
  "T-SIPS": { price: 50.00, description: "T-SIPS Green Tea With Jasmine, 2g" }
};

let cart = [];
let lastDetectedItem = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  document.getElementById("pay-button").addEventListener("click", () => {
    if (cart.length > 0) {
      showPage("payment-page");
    } else {
      alert("Your cart is empty!");
    }
  });

  document.getElementById("cancel-button").addEventListener("click", () => {
    cart = [];
    lastDetectedItem = null;
    updateCartList();
    updateTotalAmount();
  });

  // Simulate label detection (replace with your actual detection)
  setInterval(() => {
    const demoLabels = ["SOORYA", "IODEX", "ZESTA", "T-SIPS"];
    const randomLabel = demoLabels[Math.floor(Math.random() * demoLabels.length)];
    updateLabelFeed(randomLabel);
  }, 3000);
});

// Update label feed display
function updateLabelFeed(label) {
  const labelElement = document.getElementById("label-data");
  if (labelElement) {
    labelElement.innerHTML = `Detected Object: <strong>${label}</strong>`;
  }
  // Only add to cart if it's a new detection
  if (label !== lastDetectedItem) {
    addToCart(label);
    lastDetectedItem = label;
  }
}

// Add item to cart (only once per detection)
function addToCart(label) {
  const normalizedLabel = label.trim().toUpperCase();
  
  if (PRICES[normalizedLabel]) {
    const existingItem = cart.find(item => item.label === normalizedLabel);
    
    if (existingItem) {
      // Don't auto-increment, let user control with +/-
    } else {
      cart.push({
        label: normalizedLabel,
        price: PRICES[normalizedLabel].price,
        quantity: 1,
        description: PRICES[normalizedLabel].description
      });
    }
    updateCartList();
    updateTotalAmount();
  }
}

// Page navigation
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
}

// Update cart display
function updateCartList() {
  const cartElement = document.getElementById("cart-list");
  if (cartElement) {
    cartElement.innerHTML = "";
    cart.forEach(item => {
      const itemElement = document.createElement("div");
      itemElement.className = "cart-item";
      itemElement.innerHTML = `
        <span>${item.description} - $${item.price.toFixed(2)}</span>
        <div class="quantity-controls">
          <button onclick="decreaseQuantity('${item.label}')">-</button>
          <span>${item.quantity}</span>
          <button onclick="increaseQuantity('${item.label}')">+</button>
        </div>
      `;
      cartElement.appendChild(itemElement);
    });
  }
}

// Update total amount
function updateTotalAmount() {
  const totalElement = document.getElementById("total-value");
  const billTotalElement = document.getElementById("bill-total-value");
  
  if (totalElement || billTotalElement) {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (totalElement) totalElement.textContent = total.toFixed(2);
    if (billTotalElement) billTotalElement.textContent = total.toFixed(2);
  }
}

// Quantity controls
window.increaseQuantity = function(label) {
  const item = cart.find(item => item.label === label);
  if (item) {
    item.quantity += 1;
    updateCartList();
    updateTotalAmount();
  }
};

window.decreaseQuantity = function(label) {
  const itemIndex = cart.findIndex(item => item.label === label);
  if (itemIndex !== -1) {
    cart[itemIndex].quantity -= 1;
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
      lastDetectedItem = null; // Allow re-adding if scanned again
    }
    updateCartList();
    updateTotalAmount();
  }
};

// Payment processing
window.selectPayment = function(method) {
  if (method === "CREDIT" || method === "DEBIT") {
    // Simulate barcode scanning
    setTimeout(() => {
      completePayment(method);
    }, 1500);
  } else {
    completePayment(method);
  }
};

async function completePayment(method) {
  try {
    // Save bill to Firestore
    const billData = {
      items: cart.map(item => ({
        name: item.label,
        price: item.price,
        quantity: item.quantity,
        description: item.description
      })),
      total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      paymentMethod: method,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('bills').add(billData);
    
    // Display bill
    displayBill();
    showPage("bill-page");
  } catch (error) {
    console.error("Error saving bill:", error);
    alert("Payment processing failed. Please try again.");
  }
}

// Display bill
function displayBill() {
  const billItemsElement = document.getElementById("bill-items");
  if (billItemsElement) {
    billItemsElement.innerHTML = "";
    cart.forEach(item => {
      const itemElement = document.createElement("div");
      itemElement.className = "bill-item";
      itemElement.innerHTML = `
        <span>${item.description} = $${item.price.toFixed(2)} x ${item.quantity}</span>
        <span>$${(item.price * item.quantity).toFixed(2)}</span>
      `;
      billItemsElement.appendChild(itemElement);
    });
    updateTotalAmount();
  }
}

// Number pad functions
window.appendNumber = function(number) {
  const input = document.getElementById('phone-number');
  if (input && input.value.length < 10) {
    input.value += number;
  }
};

window.clearNumber = function() {
  const input = document.getElementById('phone-number');
  if (input) input.value = '';
};

window.sendBillViaSMS = function() {
  const phoneNumber = document.getElementById('phone-number').value;
  if (phoneNumber.length === 10) {
    alert(`Bill sent to ${phoneNumber}`);
    goBackToDashboard();
  } else {
    alert('Please enter a valid 10-digit phone number');
  }
};

window.goBackToDashboard = function() {
  cart = [];
  lastDetectedItem = null;
  updateCartList();
  updateTotalAmount();
  showPage("dashboard");
};