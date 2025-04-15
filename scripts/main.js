// Import Firebase (must be at top)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Initialize Firebase (add after your Twilio constants)
const firebaseConfig = {
  apiKey: "AIzaSyDoWvDT63Kd8xZUr1Lq0NNMiLjfQMOD0X0",
  authDomain: "circuit-cart.firebaseapp.com",
  projectId: "circuit-cart",
  storageBucket: "circuit-cart.appspot.com",
  messagingSenderId: "38943769135",
  appId: "1:38943769135:web:f49f0977c4ab2c81667cda",
  measurementId: "G-LHSSSKKYMC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Adafruit IO credentials
const ADAFRUIT_AIO_USERNAME = "Dilshan98";
const ADAFRUIT_AIO_KEY = "aio_PPJw298yJot4MbBwIhNKb2cQlSFU";

// Feed keys
const FEEDS = {
  CAMERA: "camera",
  LABEL: "label",
};

// Price mapping
const PRICES = {
  SOORYA: { price: 20.00, description: "SOORYA Matches Box, Avg. Sticks 45" },
  ZESTA: { price: 100.00, description: "ZESTA Green Tea, 2g" },
  "T-SIPS": { price: 50.00, description: "T-SIPS Green Tea With Jasmine, 2g" },
  IODEX: { price: 200.00, description: "IODEX Bam, 9g" },
};

// Twilio 
const TWILIO_ACCOUNT_SID = 'AC9802b8b790a4dae149be9a52a2c67620';
const TWILIO_AUTH_TOKEN = '6aa01d546c7800614c6e791e298b8fbd';
const TWILIO_PHONE_NUMBER = '+18312783055';

let cart = [];

// ========== NEW FIREBASE FUNCTION ========== //
async function saveBillToFirestore() {
  try {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const billData = {
      items: cart.map(item => ({
        label: item.label,
        description: PRICES[item.label].description,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      })),
      totalAmount: total,
      timestamp: serverTimestamp(),
      phoneNumber: document.getElementById('phone-number')?.value.trim() || null
    };
    await addDoc(collection(db, "bills"), billData);
    return true;
  } catch (error) {
    console.error("Error saving bill:", error);
    return false;
  }
}

// ========== MODIFIED FUNCTIONS (Firestore added) ========== //
async function selectPayment(method) {
  alert(`Payment method selected: ${method}`);
  if (method === "CREDIT" || method === "DEBIT") {
    document.getElementById("payment-page").style.display = "none";
    document.getElementById("barcode-scan-page").style.display = "block";
  } else {
    setTimeout(async () => {
      if (await saveBillToFirestore()) {
        document.getElementById("payment-page").style.display = "none";
        document.getElementById("bill-page").style.display = "block";
        displayBill();
      }
    }, 2000);
  }
}

async function handleBarcodeScan(event) {
  const scannedData = event.target.value.trim();
  const paymentMethods = { "D11558691": "DEBIT", "4792099010898": "CREDIT" };
  
  if (paymentMethods[scannedData]) {
    setTimeout(async () => {
      if (await saveBillToFirestore()) {
        document.getElementById("barcode-scan-page").style.display = "none";
        document.getElementById("bill-page").style.display = "block";
        displayBill();
      }
    }, 2000);
  } else {
    alert("Invalid card type. Please scan a valid card (Debit or Credit).");
  }
  event.target.value = "";
}

async function sendBillViaSMS() {
  const phoneNumber = document.getElementById('phone-number').value.trim();
  if (!isValidSriLankanPhoneNumber(phoneNumber)) {
    alert('Please enter a valid 10-digit Sri Lankan phone number.');
    return;
  }

  if (!await saveBillToFirestore()) {
    alert('Failed to save bill. SMS not sent.');
    return;
  }

  const billMessage = `Your Bill:\n${
    cart.map(item => 
      `${PRICES[item.label].description} - $${item.price.toFixed(2)} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}`
    ).join('\n')
  }\nTotal: $${cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}`;

  try {
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
    if (!response.ok) throw new Error('Failed to send SMS.');
    alert('Bill sent successfully via SMS!');
  } catch (error) {
    console.error('Error sending SMS:', error);
    alert('Failed to send SMS. Please try again.');
  }
}

// ========== ALL YOUR ORIGINAL FUNCTIONS (unchanged) ========== //
async function fetchData(feedKey, elementId) {
  const url = `https://io.adafruit.com/api/v2/${ADAFRUIT_AIO_USERNAME}/feeds/${feedKey}/data/last`;
  try {
    const response = await fetch(url, { headers: { "X-AIO-Key": ADAFRUIT_AIO_KEY } });
    if (!response.ok) throw new Error(`Failed to fetch data for feed: ${feedKey}`);
    const data = await response.json();
    if (feedKey === FEEDS.CAMERA) {
      displayImage(data.value, elementId);
    } else {
      updateCart(data.value);
      displayData(data.value, elementId);
    }
  } catch (error) {
    console.error(`Error fetching data for feed ${feedKey}:`, error);
    displayData("Error loading data", elementId);
  }
}

function displayData(value, elementId) {
  const dataElement = document.getElementById(elementId);
  if (dataElement) dataElement.innerHTML = `Detected Object: <strong>${value}</strong>`;
}

function displayImage(base64Data, elementId) {
  const imageElement = document.getElementById(elementId);
  if (imageElement) imageElement.src = `data:image/jpeg;base64,${base64Data}`;
}

function updateCart(label) {
  const normalizedLabel = label.trim().toUpperCase();
  if (PRICES[normalizedLabel] && !cart.some(item => item.label.toUpperCase() === normalizedLabel)) {
    cart.push({ label: normalizedLabel, price: PRICES[normalizedLabel].price, quantity: 1 });
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
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description} - $${item.price.toFixed(2)}</p>
        <div class="quantity-controls">
          <span>${item.quantity}</span>
          <button onclick="increaseQuantity('${item.label}')">+</button>
          <button onclick="decreaseQuantity('${item.label}')">-</button>
        </div>`;
      cartElement.appendChild(itemElement);
    });
  }
}

function increaseQuantity(label) {
  const item = cart.find(item => item.label === label);
  if (item) {
    item.quantity += 1;
    updateCartList();
    updateTotalAmount();
  }
}

function decreaseQuantity(label) {
  const item = cart.find(item => item.label === label);
  if (item) {
    item.quantity -= 1;
    if (item.quantity === 0) cart = cart.filter(item => item.label !== label);
    updateCartList();
    updateTotalAmount();
  }
}

function updateTotalAmount() {
  const totalElement = document.getElementById("total-value");
  if (totalElement) {
    totalElement.textContent = cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
  }
}

function displayBill() {
  const billItemsElement = document.getElementById("bill-items");
  const billTotalElement = document.getElementById("bill-total-value");
  if (billItemsElement && billTotalElement) {
    billItemsElement.innerHTML = "";
    cart.forEach(item => {
      const itemElement = document.createElement("div");
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description} = $${item.price.toFixed(2)} x ${item.quantity}</p>
        <p>$${(item.price * item.quantity).toFixed(2)}</p>`;
      billItemsElement.appendChild(itemElement);
    });
    billTotalElement.textContent = cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
  }
}

function goBackToDashboard() {
  cart = [];
  updateCartList();
  updateTotalAmount();
  document.getElementById("bill-page").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
}

function isValidSriLankanPhoneNumber(phoneNumber) {
  return /^\d{10}$/.test(phoneNumber);
}

function appendNumber(number) {
  const phoneNumberInput = document.getElementById('phone-number');
  if (phoneNumberInput.value.length < 10) phoneNumberInput.value += number;
}

function clearNumber() {
  document.getElementById('phone-number').value = '';
}

// Event listeners
document.getElementById("pay-button").addEventListener("click", () => {
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("payment-page").style.display = "block";
});

document.getElementById("barcode-input").addEventListener("change", handleBarcodeScan);

// Initial fetch and polling
fetchData(FEEDS.CAMERA, "camera-image");
fetchData(FEEDS.LABEL, "label-data");
setInterval(() => {
  fetchData(FEEDS.CAMERA, "camera-image"); 
  fetchData(FEEDS.LABEL, "label-data");    
}, 5000);