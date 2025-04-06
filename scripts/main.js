// Adafruit IO credentials
const ADAFRUIT_AIO_USERNAME = "Dilshan98";
const ADAFRUIT_AIO_KEY = "aio_PPJw298yJot4MbBwIhNKb2cQlSFU";

// Feed keys
const FEEDS = {
  CAMERA: "camera", // Feed key for the camera feed
  LABEL: "label",   // Feed key for the label feed
};

// Price mapping for detected labels
const PRICES = {
  SOORYA: {
    price: 20.00,
    description: "SOORYA Matches Box, Avg. Sticks 45",
  },
  ZESTA: {
    price: 100.00,
    description: "ZESTA Green Tea, 2g",
  },
  "T-SIPS": {
    price: 50.00,
    description: "T-SIPS Green Tea With Jasmine, 2g",
  },
  IODEX: {
    price: 200.00,
    description: "IODEX Bam, 9g",
  },
};

// Cart to store detected items
let cart = [];

// Twilio 
const TWILIO_ACCOUNT_SID = 'AC9802b8b790a4dae149be9a52a2c67620';
const TWILIO_AUTH_TOKEN = '6aa01d546c7800614c6e791e298b8fbd';
const TWILIO_PHONE_NUMBER = '+18312783055';

// Function to fetch data from Adafruit IO
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
    if (feedKey === FEEDS.CAMERA) {
      displayImage(data.value, elementId); // Display image for camera feed
    } else {
      console.log("Detected Label:", data.value); // Debugging: Log detected label
      updateCart(data.value); // Update cart for label feed
      displayData(data.value, elementId); // Display text for label feed
    }
  } catch (error) {
    console.error(`Error fetching data for feed ${feedKey}:`, error);
    displayData("Error loading data", elementId);
  }
}


function displayData(value, elementId) {
  const dataElement = document.getElementById(elementId);
  if (dataElement) {
    dataElement.innerHTML = `Detected Object: <strong>${value}</strong>`;
  }
}

// Function to display image data on the webpage
function displayImage(base64Data, elementId) {
  const imageElement = document.getElementById(elementId);
  if (imageElement) {
    imageElement.src = `data:image/jpeg;base64,${base64Data}`; // Set base64 data as image source
  }
}

// Function to update the cart with detected labels
function updateCart(label) {
  // Normalize the label: trim spaces and convert to uppercase
  const normalizedLabel = label.trim().toUpperCase();

  // Check if the normalized label exists in the PRICES object
  if (PRICES.hasOwnProperty(normalizedLabel)) {
    // Check if the item already exists in the cart
    const existingItem = cart.find((item) => item.label.toUpperCase() === normalizedLabel);

    if (!existingItem) {
      // If the item doesn't exist, add it to the cart with quantity 1
      cart.push({
        label: normalizedLabel,
        price: PRICES[normalizedLabel].price,
        quantity: 1,
      });
      console.log("Cart:", cart); // Debugging: Log the updated cart
      updateCartList(); // Update the cart list in the HTML
      updateTotalAmount(); // Update the total amount
    }
  } else {
    console.error("Label not found in PRICES:", normalizedLabel);
  }
}

// Function to update the cart list in the HTML
function updateCartList() {
  const cartElement = document.getElementById("cart-list");
  if (cartElement) {
    // Clear the existing cart list
    cartElement.innerHTML = "";

    // Add each item in the cart to the list
    cart.forEach((item, index) => {
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

// Function to increase the quantity of an item
function increaseQuantity(label) {
  const item = cart.find((item) => item.label === label);
  if (item) {
    item.quantity += 1;
    updateCartList();
    updateTotalAmount();
  }
}

// Function to decrease the quantity of an item
function decreaseQuantity(label) {
  const item = cart.find((item) => item.label === label);
  if (item) {
    item.quantity -= 1;
    if (item.quantity === 0) {
      // Remove the item if the quantity reaches 0
      cart = cart.filter((item) => item.label !== label);
    }
    updateCartList();
    updateTotalAmount();
  }
}

// Function to update the total amount
function updateTotalAmount() {
  const totalElement = document.getElementById("total-value");
  if (totalElement) {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    totalElement.textContent = total.toFixed(2);
  }
}

// Function to handle the PAY button
document.getElementById("pay-button").addEventListener("click", () => {
  // Hide the dashboard and show the payment page
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("payment-page").style.display = "block";
});

// Function to handle payment selection
function selectPayment(method) {
  alert(`Payment method selected: ${method}`);

  if (method === "CREDIT" || method === "DEBIT") {
    // Redirect to barcode scanning for Credit/Debit Card
    document.getElementById("payment-page").style.display = "none";
    document.getElementById("barcode-scan-page").style.display = "block";
  } else {
    // Simulate payment processing for other methods
    setTimeout(() => {
      // Hide the payment page and show the bill/receipt page
      document.getElementById("payment-page").style.display = "none";
      document.getElementById("bill-page").style.display = "block";

      // Display the bill/receipt
      displayBill();
    }, 2000); // Simulate a 2-second delay for payment processing
  }
}

// Function to handle barcode scanning
function handleBarcodeScan(event) {
  const scannedData = event.target.value.trim();

  // Map barcode values to payment methods
  const paymentMethods = {
    "D11558691": "DEBIT",       // Debit Card barcode
    "4792099010898": "CREDIT",  // Credit Card barcode
  };

  const paymentMethod = paymentMethods[scannedData];

  if (paymentMethod) {
    // Simulate payment processing
    setTimeout(() => {
      // Hide the barcode scan page and show the bill/receipt page
      document.getElementById("barcode-scan-page").style.display = "none";
      document.getElementById("bill-page").style.display = "block";

      // Display the bill/receipt
      displayBill();
    }, 2000); // Simulate a 2-second delay for payment processing
  } else {
    alert("Invalid card type. Please scan a valid card (Debit or Credit).");
  }

  // Clear the input field after scanning
  event.target.value = "";
}

// Function to display the bill/receipt
function displayBill() {
  const billItemsElement = document.getElementById("bill-items");
  const billTotalElement = document.getElementById("bill-total-value");

  if (billItemsElement && billTotalElement) {
    // Clear existing bill items
    billItemsElement.innerHTML = "";

    // Add each item in the cart to the bill
    cart.forEach((item) => {
      const itemElement = document.createElement("div");
      itemElement.innerHTML = `
        <p>${PRICES[item.label].description} = $${item.price.toFixed(2)} x ${item.quantity}</p>
        <p>$${(item.price * item.quantity).toFixed(2)}</p>
      `;
      billItemsElement.appendChild(itemElement);
    });

    // Update the total amount
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    billTotalElement.textContent = total.toFixed(2);
  }
}

// Function to go back to the dashboard
function goBackToDashboard() {
  // Clear the cart
  cart = [];
  updateCartList();
  updateTotalAmount();

  // Hide the bill/receipt page and show the dashboard
  document.getElementById("bill-page").style.display = "none";
  document.getElementById("dashboard").style.display = "block";
}

// Function to validate Sri Lankan phone number (10 digits)
function isValidSriLankanPhoneNumber(phoneNumber) {
  const regex = /^\d{10}$/; // Matches exactly 10 digits
  return regex.test(phoneNumber);
}

// Function to append a number to the phone number input
function appendNumber(number) {
  const phoneNumberInput = document.getElementById('phone-number');
  if (phoneNumberInput.value.length < 10) { // Limit to 10 digits
    phoneNumberInput.value += number;
  }
}

// Function to clear the phone number input
function clearNumber() {
  const phoneNumberInput = document.getElementById('phone-number');
  phoneNumberInput.value = '';
}

// Function to send the bill via SMS
async function sendBillViaSMS() {
  const phoneNumber = document.getElementById('phone-number').value.trim();

  // Validate phone number
  if (!isValidSriLankanPhoneNumber(phoneNumber)) {
    alert('Please enter a valid 10-digit Sri Lankan phone number.');
    return;
  }

  // Format the bill message
  const billItems = cart.map(item => 
    `${PRICES[item.label].description} - $${item.price.toFixed(2)} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
  const billMessage = `Your Bill:\n${billItems}\nTotal: $${totalAmount}`;

  // Send SMS using Twilio
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

    if (!response.ok) {
      throw new Error('Failed to send SMS.');
    }

    alert('Bill sent successfully via SMS!');
  } catch (error) {
    console.error('Error sending SMS:', error);
    alert('Failed to send SMS. Please try again.');
  }
}

// Add event listener for barcode scanning
document.getElementById("barcode-input").addEventListener("change", handleBarcodeScan);

// Fetch data for both feeds every 5 seconds
setInterval(() => {
  fetchData(FEEDS.CAMERA, "camera-image"); 
  fetchData(FEEDS.LABEL, "label-data");    
}, 5000);

// Initial fetch
fetchData(FEEDS.CAMERA, "camera-image");
fetchData(FEEDS.LABEL, "label-data");