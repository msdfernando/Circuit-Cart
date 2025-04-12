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

// Adafruit IO credentials
const ADAFRUIT_AIO_USERNAME = "Dilshan98";
const ADAFRUIT_AIO_KEY = "aio_PPJw298yJot4MbBwIhNKb2cQlSFU";

// Feed keys
const FEEDS = {
  CAMERA: "camera",
  LABEL: "label"
};

// Twilio credentials
const TWILIO_ACCOUNT_SID = 'AC9802b8b790a4dae149be9a52a2c67620';
const TWILIO_AUTH_TOKEN = '6aa01d546c7800614c6e791e298b8fbd';
const TWILIO_PHONE_NUMBER = '+18312783055';

// Cart and product variables
let cart = [];
let PRICES = {};

// Load products from Firestore
async function loadProducts() {
  try {
    const snapshot = await db.collection('products').get();
    PRICES = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      PRICES[data.name.toUpperCase()] = {
        price: data.price,
        description: data.description
      };
    });
    console.log("Products loaded successfully");
  } catch (error) {
    console.error("Error loading products:", error);
    // Fallback to default prices
    PRICES = {
      SOORYA: { price: 20.00, description: "SOORYA Matches Box, Avg. Sticks 45" },
      ZESTA: { price: 100.00, description: "ZESTA Green Tea, 2g" },
      "T-SIPS": { price: 50.00, description: "T-SIPS Green Tea With Jasmine, 2g" },
      IODEX: { price: 200.00, description: "IODEX Bam, 9g" }
    };
  }
}

// Fetch data from Adafruit IO
async function fetchData(feedKey, elementId) {
  const url = `https://io.adafruit.com/api/v2/${ADAFRUIT_AIO_USERNAME}/feeds/${feedKey}/data/last`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-AIO-Key": ADAFRUIT_AIO_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data for feed: ${feedKey}`);
    }

    const data = await response.json();
    console.log(`Feed ${feedKey} data:`, data);
    
    if (feedKey === FEEDS.CAMERA) {
      if (!data.value) {
        throw new Error("No image data received");
      }
      displayImage(data.value, elementId);
    } else {
      if (!data.value) {
        throw new Error("No label data received");
      }
      console.log("Detected Label:", data.value);
      updateCart(data.value);
      displayData(data.value, elementId);
    }
  } catch (error) {
    console.error(`Error fetching data for feed ${feedKey}:`, error);
    displayData(`Error: ${error.message}`, elementId);
    
    // For camera, show placeholder
    if (feedKey === FEEDS.CAMERA) {
      document.getElementById(elementId).src = 'assets/camera-placeholder.png';
    }
  }
}

// Display functions
function displayData(value, elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = `Detected: <strong>${value}</strong>`;
  }
}

function displayImage(base64Data, elementId) {
  const imageElement = document.getElementById(elementId);
  if (imageElement) {
    if (!base64Data.startsWith('data:image')) {
      base64Data = `data:image/jpeg;base64,${base64Data}`;
    }
    imageElement.onerror = () => {
      console.error("Failed to load image");
      imageElement.src = 'assets/camera-placeholder.png';
    };
    imageElement.src = base64Data;
  }
}

// Cart management
function updateCart(label) {
  const normalizedLabel = label.trim().toUpperCase();
  
  if (PRICES[normalizedLabel]) {
    const existingItem = cart.find(item => item.label.toUpperCase() === normalizedLabel);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        label: normalizedLabel,
        price: PRICES[normalizedLabel].price,
        quantity: 1,
      });
    }
    updateCartList();
    updateTotalAmount();
  }
}

function updateCartList() {
  const cartElement = document.getElementById("cart-list");
  if (cartElement) {
    cartElement.innerHTML = "";
    cart.forEach(item => {
      const itemElement = document.createElement("div");
      itemElement.className = "cart-item";
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description}</p>
        <div class="quantity-controls">
          <button onclick="decreaseQuantity('${item.label}')">-</button>
          <span>${item.quantity}</span>
          <button onclick="increaseQuantity('${item.label}')">+</button>
        </div>
        <p>$${(item.price * item.quantity).toFixed(2)}</p>
      `;
      cartElement.appendChild(itemElement);
    });
  }
}

function updateTotalAmount() {
  const totalElement = document.getElementById("total-value");
  if (totalElement) {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    totalElement.textContent = total.toFixed(2);
  }
}

// Payment processing
async function completePayment(paymentMethod) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  try {
    await db.collection('bills').add({
      items: cart.map(item => ({
        name: item.label,
        price: item.price,
        quantity: item.quantity,
        description: PRICES[item.label].description
      })),
      total: total,
      paymentMethod: paymentMethod,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'completed'
    });
    return true;
  } catch (error) {
    console.error("Payment processing error:", error);
    alert("Payment failed. Please try again.");
    return false;
  }
}

// Bill display
function displayBill() {
  const billItemsElement = document.getElementById("bill-items");
  const billTotalElement = document.getElementById("bill-total-value");

  if (billItemsElement && billTotalElement) {
    billItemsElement.innerHTML = "";
    cart.forEach(item => {
      const itemElement = document.createElement("div");
      itemElement.className = "bill-item";
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description} = $${item.price.toFixed(2)} x ${item.quantity}</p>
        <p>$${(item.price * item.quantity).toFixed(2)}</p>
      `;
      billItemsElement.appendChild(itemElement);
    });
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    billTotalElement.textContent = total.toFixed(2);
  }
}

// SMS functionality
async function sendBillViaSMS() {
  const phoneNumber = document.getElementById('phone-number').value.trim();
  
  if (!/^\d{10}$/.test(phoneNumber)) {
    alert('Please enter a valid 10-digit phone number.');
    return;
  }

  try {
    const billMessage = `Your Bill:\n${cart.map(item => 
      `${PRICES[item.label].description} - $${item.price.toFixed(2)} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}`
    ).join('\n')}\nTotal: $${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}`;

    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + TWILIO_ACCOUNT_SID + '/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'From': TWILIO_PHONE_NUMBER,
        'To': `+94${phoneNumber}`,
        'Body': billMessage,
      }),
    });

    if (!response.ok) throw new Error('SMS failed');
    alert('Bill sent via SMS!');
  } catch (error) {
    console.error('SMS error:', error);
    alert('Failed to send SMS. Please try again.');
  }
}

// Page Navigation
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    
    if (pageId === 'barcode-scan-page') {
      const input = document.getElementById('barcode-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }
}

// Global functions
window.increaseQuantity = function(label) {
  const item = cart.find(item => item.label === label);
  if (item) {
    item.quantity += 1;
    updateCartList();
    updateTotalAmount();
  }
};

window.decreaseQuantity = function(label) {
  const item = cart.find(item => item.label === label);
  if (item) {
    item.quantity -= 1;
    if (item.quantity === 0) {
      cart = cart.filter(item => item.label !== label);
    }
    updateCartList();
    updateTotalAmount();
  }
};

window.selectPayment = function(method) {
  if (method === "CREDIT" || method === "DEBIT") {
    showPage("barcode-scan-page");
  } else {
    completePayment(method).then(success => {
      if (success) {
        showPage("bill-page");
        displayBill();
      }
    });
  }
};

window.appendNumber = function(number) {
  const input = document.getElementById('phone-number');
  if (input && input.value.length < 10) input.value += number;
};

window.clearNumber = function() {
  const input = document.getElementById('phone-number');
  if (input) input.value = '';
};

window.sendBillViaSMS = sendBillViaSMS;

window.goBackToDashboard = function() {
  cart = [];
  updateCartList();
  updateTotalAmount();
  showPage("dashboard");
};

// Barcode scanner simulation
document.addEventListener('DOMContentLoaded', function() {
  const barcodeInput = document.getElementById('barcode-input');
  if (barcodeInput) {
    barcodeInput.addEventListener('input', function() {
      if (this.value.length >= 12) { // Simulate successful scan
        setTimeout(() => {
          completePayment("CREDIT").then(success => {
            if (success) {
              showPage("bill-page");
              displayBill();
            }
          });
        }, 500);
      }
    });
  }

  // Initialize app
  loadProducts();
  showPage("dashboard");
  
  // Start data fetching
  fetchData(FEEDS.CAMERA, "camera-image");
  fetchData(FEEDS.LABEL, "label-data");
  
  // Set up periodic refresh
  setInterval(() => {
    fetchData(FEEDS.CAMERA, "camera-image");
    fetchData(FEEDS.LABEL, "label-data");
  }, 5000);
});