// Import Firebase modules
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  getDocs
} from "firebase/firestore";

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Adafruit IO credentials
const ADAFRUIT_AIO_USERNAME = "Dilshan98";
const ADAFRUIT_AIO_KEY = "aio_PPJw298yJot4MbBwIhNKb2cQlSFU";

// Feed keys
const FEEDS = {
  CAMERA: "camera",
  LABEL: "label"
};

// Cart and product variables
let cart = [];
let PRICES = {};

// Twilio credentials
const TWILIO_ACCOUNT_SID = 'AC9802b8b790a4dae149be9a52a2c67620';
const TWILIO_AUTH_TOKEN = '6aa01d546c7800614c6e791e298b8fbd';
const TWILIO_PHONE_NUMBER = '+18312783055';

// Load products from Firestore
async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
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

// Initialize products
loadProducts();

// Fetch data from Adafruit IO
async function fetchData(feedKey, elementId) {
  const url = `https://io.adafruit.com/api/v2/${ADAFRUIT_AIO_USERNAME}/feeds/${feedKey}/data/last`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-AIO-Key": ADAFRUIT_AIO_KEY,
      },
    });

    if (!response.ok) throw new Error(`Failed to fetch data for feed: ${feedKey}`);

    const data = await response.json();
    if (feedKey === FEEDS.CAMERA) {
      displayImage(data.value, elementId);
    } else {
      console.log("Detected Label:", data.value);
      updateCart(data.value);
      displayData(data.value, elementId);
    }
  } catch (error) {
    console.error(`Error fetching data for feed ${feedKey}:`, error);
    displayData("Error loading data", elementId);
  }
}

// Display functions
function displayData(value, elementId) {
  const element = document.getElementById(elementId);
  if (element) element.innerHTML = `Detected Object: <strong>${value}</strong>`;
}

function displayImage(base64Data, elementId) {
  const image = document.getElementById(elementId);
  if (image) image.src = `data:image/jpeg;base64,${base64Data}`;
}

// Cart management functions
function updateCart(label) {
  const normalizedLabel = label.trim().toUpperCase();
  
  if (PRICES[normalizedLabel]) {
    const existingItem = cart.find(item => item.label.toUpperCase() === normalizedLabel);
    
    if (!existingItem) {
      cart.push({
        label: normalizedLabel,
        price: PRICES[normalizedLabel].price,
        quantity: 1,
      });
      updateCartList();
      updateTotalAmount();
    }
  }
}

function updateCartList() {
  const cartElement = document.getElementById("cart-list");
  if (cartElement) {
    cartElement.innerHTML = "";
    cart.forEach(item => {
      const itemElement = document.createElement("div");
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description} - $${item.price.toFixed(2)}</p>
        <div class="quantity-controls">
          <span>${item.quantity}</span>
          <button onclick="increaseQuantity('${item.label}')">+</button>
          <button onclick="decreaseQuantity('${item.label}')">-</button>
        </div>
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
document.getElementById("pay-button").addEventListener("click", () => {
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("payment-page").style.display = "block";
});

document.getElementById("cancel-button").addEventListener("click", () => {
  cart = [];
  updateCartList();
  updateTotalAmount();
});

async function selectPayment(method) {
  if (method === "CREDIT" || method === "DEBIT") {
    document.getElementById("payment-page").style.display = "none";
    document.getElementById("barcode-scan-page").style.display = "block";
  } else {
    const success = await completePayment(method);
    if (success) {
      document.getElementById("payment-page").style.display = "none";
      document.getElementById("bill-page").style.display = "block";
      displayBill();
    }
  }
}

async function completePayment(paymentMethod) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  try {
    await addDoc(collection(db, 'bills'), {
      items: cart.map(item => ({
        name: item.label,
        price: item.price,
        quantity: item.quantity,
        description: PRICES[item.label].description
      })),
      total: total,
      paymentMethod: paymentMethod,
      timestamp: serverTimestamp(),
      status: 'completed'
    });
    return true;
  } catch (error) {
    console.error("Payment processing error:", error);
    alert("Payment failed. Please try again.");
    return false;
  }
}

// Bill display and SMS
function displayBill() {
  const billItemsElement = document.getElementById("bill-items");
  const billTotalElement = document.getElementById("bill-total-value");

  if (billItemsElement && billTotalElement) {
    billItemsElement.innerHTML = "";
    cart.forEach(item => {
      const itemElement = document.createElement("div");
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

// Initialize the app
fetchData(FEEDS.CAMERA, "camera-image");
fetchData(FEEDS.LABEL, "label-data");
setInterval(() => {
  fetchData(FEEDS.CAMERA, "camera-image");
  fetchData(FEEDS.LABEL, "label-data");
}, 5000);

// Make functions available globally
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

window.selectPayment = selectPayment;
window.appendNumber = function(number) {
  const input = document.getElementById('phone-number');
  if (input.value.length < 10) input.value += number;
};
window.clearNumber = function() {
  document.getElementById('phone-number').value = '';
};
window.sendBillViaSMS = sendBillViaSMS;
window.goBackToDashboard = function() {
  cart = [];
  updateCartList();
  updateTotalAmount();
  document.getElementById("bill-page").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
};