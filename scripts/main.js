// Import Firebase - Updated 2025-06-24
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, updateDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Initialize Firebase
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

// Make cart globally accessible to avoid module instance issues
window.circuitCart = window.circuitCart || [];
let cart = window.circuitCart;
let currentCustomer = null; // Will be set by navigation.js
let lastPaymentMethod = 'cash'; // Track the payment method used

// Get current customer from navigation module
async function getCurrentCustomer() {
  try {
    const navigationModule = await import('./navigation.js');
    return navigationModule.getCurrentCustomer();
  } catch (error) {
    console.error('Error getting current customer:', error);
    return null;
  }
}

async function saveBillToFirestore(paymentMethod = 'cash', pointsUsed = 0) {
  try {
    console.log('Attempting to save bill to Firestore...');
    console.log('Payment method being saved:', paymentMethod);
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const customer = await getCurrentCustomer();

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
      phoneNumber: document.getElementById('phone-number')?.value.trim() || null,
      // Customer information
      customerId: customer?.id || null,
      customerName: customer?.full_name || null,
      customerType: customer ? 'member' : 'guest',
      // Payment information
      paymentMethod: paymentMethod,
      pointsUsed: pointsUsed,
      cashAmount: paymentMethod === 'points' ? 0 : total
    };

    console.log('Bill data to save:', billData);

    try {
      // Try to save directly to Firebase first
      const docRef = await addDoc(collection(db, "bills"), billData);
      console.log('Bill saved successfully with ID:', docRef.id);
      return true;
    } catch (firebaseError) {
      console.warn('Direct Firebase save failed, trying via API...', firebaseError);
      console.log('Firebase error details:', firebaseError.code, firebaseError.message);

      // Fallback: Use Flask API to save bill
      const currentHost = window.location.hostname;
      const backendUrl = `http://${currentHost}:5003/api/scanner/save-bill`;
      console.log('Attempting API fallback to:', backendUrl);

      // Create a copy of billData with regular timestamp for API
      const apiBillData = {
        ...billData,
        timestamp: new Date().toISOString()  // Convert serverTimestamp to regular timestamp for API
      };

      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(apiBillData)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Bill saved via API:', result);
          return true;
        } else {
          const errorText = await response.text();
          console.error('API save failed with status:', response.status, 'Error:', errorText);
          throw new Error(`API save failed: ${response.status} - ${errorText}`);
        }
      } catch (apiError) {
        console.error('API request failed:', apiError);
        throw new Error(`API request failed: ${apiError.message}`);
      }
    }

  } catch (error) {
    console.error("Error saving bill - Full error details:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    return false;
  }
}

async function handlePayment() {
  console.log('handlePayment called, cart contents:', cart);
  console.log('Cart length:', cart.length);
  console.log('Global cart contents:', window.circuitCart);
  console.log('Global cart length:', window.circuitCart.length);

  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  const customer = await getCurrentCustomer();
  console.log('Current customer:', customer);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  console.log('Total amount:', total);

  if (customer) {
    console.log('Showing member payment options');
    // Member - show payment options
    showMemberPaymentOptions(customer, total);
  } else {
    console.log('Showing guest payment options');
    // Guest - show payment method selection
    showGuestPaymentOptions(total);
  }
}

// Show payment options for guests
function showGuestPaymentOptions(total) {
  console.log('showGuestPaymentOptions called with total:', total);
  let paymentOptionsHTML = `
    <div id="payment-options-modal" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 1000;
    ">
      <div style="
        background: white; padding: 30px; border-radius: 15px;
        max-width: 500px; width: 90%; text-align: center;
      ">
        <h2>Choose Payment Method</h2>
        <p><strong>Total: $${total.toFixed(2)}</strong></p>

        <div style="
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 15px; margin: 20px 0;
        ">
          <button id="pay-with-ezcash" class="payment-method-btn" style="
            background: white; border: 2px solid #ddd; border-radius: 12px;
            padding: 20px; cursor: pointer; transition: all 0.3s;
            display: flex; flex-direction: column; align-items: center;
          ">
            <img src="./assets/ez cash.png" alt="EZ Cash" style="width: 60px; height: 60px; margin-bottom: 10px;">
            <span style="font-weight: bold;">EZ Cash</span>
          </button>

          <button id="pay-with-ipay" class="payment-method-btn" style="
            background: white; border: 2px solid #ddd; border-radius: 12px;
            padding: 20px; cursor: pointer; transition: all 0.3s;
            display: flex; flex-direction: column; align-items: center;
          ">
            <img src="./assets/i pay.png" alt="iPay" style="width: 60px; height: 60px; margin-bottom: 10px;">
            <span style="font-weight: bold;">iPay</span>
          </button>

          <button id="pay-with-mcash" class="payment-method-btn" style="
            background: white; border: 2px solid #ddd; border-radius: 12px;
            padding: 20px; cursor: pointer; transition: all 0.3s;
            display: flex; flex-direction: column; align-items: center;
          ">
            <img src="./assets/m cash.png" alt="mCash" style="width: 60px; height: 60px; margin-bottom: 10px;">
            <span style="font-weight: bold;">mCash</span>
          </button>

          <button id="pay-with-cash" class="payment-method-btn" style="
            background: white; border: 2px solid #ddd; border-radius: 12px;
            padding: 20px; cursor: pointer; transition: all 0.3s;
            display: flex; flex-direction: column; align-items: center;
          ">
            <div style="
              width: 60px; height: 60px; margin-bottom: 10px;
              background: linear-gradient(135deg, #4CAF50, #45a049);
              border-radius: 50%; display: flex; align-items: center;
              justify-content: center; color: white; font-size: 24px; font-weight: bold;
            ">💵</div>
            <span style="font-weight: bold;">Cash</span>
          </button>
        </div>

        <button id="cancel-payment" style="
          background: #6c757d; color: white; border: none;
          padding: 10px 20px; margin: 10px; border-radius: 8px;
          cursor: pointer; width: 100%;
        ">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', paymentOptionsHTML);

  // Add hover effects
  const style = document.createElement('style');
  style.textContent = `
    .payment-method-btn:hover {
      border-color: #007bff !important;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,123,255,0.3);
    }
  `;
  document.head.appendChild(style);

  // Add event listeners
  document.getElementById('pay-with-ezcash').addEventListener('click', () => handleGuestPayment('EZ Cash', total));
  document.getElementById('pay-with-ipay').addEventListener('click', () => handleGuestPayment('iPay', total));
  document.getElementById('pay-with-mcash').addEventListener('click', () => handleGuestPayment('mCash', total));
  document.getElementById('pay-with-cash').addEventListener('click', () => handleGuestPayment('Cash', total));
  document.getElementById('cancel-payment').addEventListener('click', closePaymentModal);
}

// Show payment options for members
function showMemberPaymentOptions(customer, total) {
  const walletBalance = customer.wallet_balance || 0;

  let paymentOptionsHTML = `
    <div id="payment-options-modal" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 1000;
    ">
      <div style="
        background: white; padding: 30px; border-radius: 15px;
        max-width: 400px; width: 90%; text-align: center;
      ">
        <h2>Choose Payment Method</h2>
        <p><strong>Total: $${total.toFixed(2)}</strong></p>
        <p>Wallet Balance: $${walletBalance.toFixed(2)}</p>

        <div style="margin: 20px 0;">
  `;

  if (walletBalance >= total) {
    paymentOptionsHTML += `
      <button id="pay-with-points" style="
        background: #28a745; color: white; border: none;
        padding: 15px 20px; margin: 10px; border-radius: 8px;
        cursor: pointer; width: 100%; font-size: 1.1em;
      ">
        Pay with Wallet Points ($${total.toFixed(2)})
      </button>
    `;
  } else {
    paymentOptionsHTML += `
      <p style="color: #dc3545; margin: 10px 0;">
        Insufficient wallet balance for full payment
      </p>
    `;
  }

  paymentOptionsHTML += `
      <button id="pay-with-cash" style="
        background: #007bff; color: white; border: none;
        padding: 15px 20px; margin: 10px; border-radius: 8px;
        cursor: pointer; width: 100%; font-size: 1.1em;
      ">
        Pay with Cash
      </button>

      <button id="cancel-payment" style="
        background: #6c757d; color: white; border: none;
        padding: 10px 20px; margin: 10px; border-radius: 8px;
        cursor: pointer; width: 100%;
      ">
        Cancel
      </button>
    </div>
  </div>
</div>
  `;

  document.body.insertAdjacentHTML('beforeend', paymentOptionsHTML);

  // Add event listeners
  const payWithPointsBtn = document.getElementById('pay-with-points');
  const payWithCashBtn = document.getElementById('pay-with-cash');
  const cancelBtn = document.getElementById('cancel-payment');

  if (payWithPointsBtn) {
    payWithPointsBtn.addEventListener('click', () => handlePointsPayment(customer, total));
  }

  if (payWithCashBtn) {
    payWithCashBtn.addEventListener('click', () => handleCashPayment());
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closePaymentModal);
  }
}

// Handle points payment
async function handlePointsPayment(customer, total) {
  try {
    console.log('Starting points payment process...', { customer: customer.id, total });
    closePaymentModal();

    // Store the payment method for display
    lastPaymentMethod = 'Wallet Points';

    // Check if customer has sufficient balance (1$ = 1 Point)
    if (customer.wallet_balance < total) {
      throw new Error(`Insufficient balance. Available: $${customer.wallet_balance.toFixed(2)}, Required: $${total.toFixed(2)}`);
    }

    // Calculate new balance
    const newBalance = customer.wallet_balance - total;
    console.log('Processing payment via API...', { oldBalance: customer.wallet_balance, newBalance, amount: total });

    // Use the Flask API to process the payment (it has proper permissions)
    // Determine the correct backend URL based on current location
    const currentHost = window.location.hostname;
    const backendUrl = `http://${currentHost}:5003/api/scanner/payment`;
    console.log('Using backend URL:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customer.id,
        amount: total
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Payment processing failed');
    }

    const result = await response.json();
    console.log('Payment processed successfully via API:', result);

    // Save bill with points payment
    console.log('Saving bill to Firestore...');
    const billSaved = await saveBillToFirestore('points', total);
    console.log('Bill save result:', billSaved);

    if (billSaved) {
      // Update local customer data with new balance from API
      customer.wallet_balance = result.new_balance;
      console.log('Payment completed successfully. New balance:', result.new_balance);
      showBillPage();
    } else {
      throw new Error("Failed to save bill to database");
    }
  } catch (error) {
    console.error('Error processing points payment:', error);
    alert(`Failed to process points payment: ${error.message}`);
  }
}

// Handle guest payment with selected method
async function handleGuestPayment(paymentMethod, total) {
  try {
    console.log(`Processing ${paymentMethod} payment for $${total.toFixed(2)}`);
    closePaymentModal();

    // Store the payment method for display
    lastPaymentMethod = paymentMethod;

    // Format payment method for database (keep original format for better readability)
    const dbPaymentMethod = paymentMethod.toLowerCase().replace(' ', '_');
    console.log(`Saving to database with payment method: ${dbPaymentMethod}`);

    // Save bill with the selected payment method
    if (await saveBillToFirestore(dbPaymentMethod, 0)) {
      showBillPage();
    } else {
      alert("Failed to process payment. Please try again.");
    }
  } catch (error) {
    console.error(`Error processing ${paymentMethod} payment:`, error);
    alert(`Failed to process ${paymentMethod} payment: ${error.message}`);
  }
}

// Handle cash payment (for member cash option)
async function handleCashPayment() {
  closePaymentModal();

  // Store the payment method for display
  lastPaymentMethod = 'Cash';

  if (await saveBillToFirestore('cash', 0)) {
    showBillPage();
  } else {
    alert("Failed to process payment. Please try again.");
  }
}

// Close payment modal
function closePaymentModal() {
  const modal = document.getElementById('payment-options-modal');
  if (modal) {
    modal.remove();
  }
}

// Show bill page
function showBillPage() {
  const navigationModule = import('./navigation.js');
  navigationModule.then(module => {
    module.showPage('bill-page');
    displayBill();
  });
}

// Print bill function
async function printBill() {
  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=600,height=800');

  // Get current bill data
  const customer = await getCurrentCustomer();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currentDate = new Date().toLocaleString();

  // Generate print content
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Circuit Cart - Bill</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .bill-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #ddd;
        }
        .total {
          font-weight: bold;
          font-size: 1.2em;
          text-align: right;
          margin-top: 20px;
          border-top: 2px solid #000;
          padding-top: 10px;
        }
        .customer-info {
          margin-bottom: 20px;
          padding: 10px;
          background-color: #f5f5f5;
          border-radius: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 0.9em;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CIRCUIT CART</h1>
        <p>Payment Receipt</p>
        <p>Date: ${currentDate}</p>
      </div>

      ${customer ? `
        <div class="customer-info">
          <h3>Customer Information</h3>
          <p><strong>Name:</strong> ${customer.full_name}</p>
          <p><strong>Customer ID:</strong> ${customer.id}</p>
          <p><strong>Payment Method:</strong> ${lastPaymentMethod}</p>
        </div>
      ` : `
        <div class="customer-info">
          <h3>Guest Purchase</h3>
          <p><strong>Payment Method:</strong> ${lastPaymentMethod}</p>
        </div>
      `}

      <h3>Items Purchased:</h3>
      ${cart.map(item => `
        <div class="bill-item">
          <span>${PRICES[item.label].description} (x${item.quantity})</span>
          <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      `).join('')}

      <div class="total">
        Total: $${total.toFixed(2)}
      </div>

      <div class="footer">
        <p>Thank you for shopping with Circuit Cart!</p>
        <p>Powered by Circuit Cart System</p>
      </div>
    </body>
    </html>
  `;

  // Write content to print window
  printWindow.document.write(printContent);
  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = function() {
    printWindow.print();
    printWindow.close();
  };
}

async function fetchData(feedKey, elementId) {
  const url = `https://io.adafruit.com/api/v2/${ADAFRUIT_AIO_USERNAME}/feeds/${feedKey}/data/last`;
  try {
    const response = await fetch(url, { headers: { "X-AIO-Key": ADAFRUIT_AIO_KEY } });
    if (!response.ok) throw new Error(`Failed to fetch data for feed: ${feedKey}`);
    const data = await response.json();
    if (feedKey === "camera") {
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
  console.log('updateCart called with label:', label);
  const normalizedLabel = label.trim().toUpperCase();
  console.log('Normalized label:', normalizedLabel);
  console.log('Current cart before update:', cart);

  if (PRICES[normalizedLabel] && !cart.some(item => item.label.toUpperCase() === normalizedLabel)) {
    const newItem = { label: normalizedLabel, price: PRICES[normalizedLabel].price, quantity: 1 };
    cart.push(newItem);
    // Ensure global cart is synced
    window.circuitCart = cart;
    console.log('Item added to cart. New cart:', cart);
    console.log('Global cart synced:', window.circuitCart);
    updateCartList();
    updateTotalAmount();
  } else {
    console.log('Item not added - either not in PRICES or already in cart');
  }
}

function updateCartList() {
  const cartElement = document.getElementById("cart-list");
  if (cartElement) {
    cartElement.innerHTML = "";
    cart.forEach((item) => {
      const itemElement = document.createElement("div");
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description} - $${item.price.toFixed(2)}</p>
        <div class="quantity-controls">
          <span>${item.quantity}</span>
          <button class="increase-btn" data-label="${item.label}">+</button>
          <button class="decrease-btn" data-label="${item.label}">-</button>
        </div>
      `;
      cartElement.appendChild(itemElement);
    });

    // Add event listeners for all quantity buttons
    document.querySelectorAll('.increase-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        increaseQuantity(btn.dataset.label);
      });
    });

    document.querySelectorAll('.decrease-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        decreaseQuantity(btn.dataset.label);
      });
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

async function displayBill() {
  const billItemsElement = document.getElementById("bill-items");
  const billTotalElement = document.getElementById("bill-total-value");

  if (billItemsElement && billTotalElement) {
    const customer = await getCurrentCustomer();
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    billItemsElement.innerHTML = "";

    // Add customer info if member
    if (customer) {
      const customerInfoElement = document.createElement("div");
      customerInfoElement.innerHTML = `
        <div style="border-bottom: 2px solid #ddd; padding-bottom: 15px; margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; color: #28a745;">Member Purchase</h3>
          <p style="margin: 5px 0;"><strong>Customer:</strong> ${customer.full_name}</p>
          <p style="margin: 5px 0;"><strong>Customer ID:</strong> ${customer.customer_id || customer.id}</p>
          <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${lastPaymentMethod}</p>
          <p style="margin: 5px 0;"><strong>Remaining Balance:</strong> $${(customer.wallet_balance || 0).toFixed(2)}</p>
        </div>
      `;
      billItemsElement.appendChild(customerInfoElement);
    } else {
      const guestInfoElement = document.createElement("div");
      guestInfoElement.innerHTML = `
        <div style="border-bottom: 2px solid #ddd; padding-bottom: 15px; margin-bottom: 15px;">
          <h3 style="margin: 0 0 10px 0; color: #007bff;">Guest Purchase</h3>
          <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${lastPaymentMethod}</p>
        </div>
      `;
      billItemsElement.appendChild(guestInfoElement);
    }

    // Add cart items
    cart.forEach(item => {
      const itemElement = document.createElement("div");
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description} = $${item.price.toFixed(2)} x ${item.quantity}</p>
        <p>$${(item.price * item.quantity).toFixed(2)}</p>`;
      billItemsElement.appendChild(itemElement);
    });

    billTotalElement.textContent = total.toFixed(2);
  }
}

function goBackToDashboard() {
  cart.length = 0; // Clear array contents
  window.circuitCart.length = 0; // Clear global cart too
  updateCartList();
  updateTotalAmount();

  // Import navigation module to show member selection
  import('./navigation.js').then(module => {
    module.showPage('member-selection');
  });
}

function clearCart() {
  cart.length = 0; // Clear array contents
  window.circuitCart.length = 0; // Clear global cart too
  updateCartList();
  updateTotalAmount();
}

// Removed phone number related functions as they are no longer needed

// Note: Initial fetch and polling is now handled by navigation.js
// when the dashboard page is shown

// Debug function to check cart state
window.debugCart = function() {
  console.log('Local cart state:', cart);
  console.log('Global cart state:', window.circuitCart);
  console.log('Cart length:', cart.length);
  console.log('Global cart length:', window.circuitCart.length);
  console.log('Cart total:', cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  return { local: cart, global: window.circuitCart };
};

// Export functions
export {
  fetchData,
  handlePayment,
  goBackToDashboard,
  printBill,
  clearCart
};