// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

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

// Cart to store detected items
let cart = [];

// Twilio credentials
const TWILIO_ACCOUNT_SID = 'AC9802b8b790a4dae149be9a52a2c67620';
const TWILIO_AUTH_TOKEN = '6aa01d546c7800614c6e791e298b8fbd';
const TWILIO_PHONE_NUMBER = '+18312783055';

// Fetch product prices from Firestore
let PRICES = {};
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
    console.log("Products loaded from Firestore");
  } catch (error) {
    console.error("Error loading products:", error);
    // Fallback to default prices if Firestore fails
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

// Function to fetch data from Adafruit IO
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

// [Keep all your existing display functions: displayData, displayImage, etc.]

// Modified payment function to save to Firestore
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
    console.error("Error saving payment:", error);
    return false;
  }
}

// Updated payment selection
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
    } else {
      alert("Payment failed. Please try again.");
    }
  }
}

// Updated SMS function to include Firestore reference
async function sendBillViaSMS() {
  const phoneNumber = document.getElementById('phone-number').value.trim();
  
  if (!isValidSriLankanPhoneNumber(phoneNumber)) {
    alert('Please enter a valid 10-digit Sri Lankan phone number.');
    return;
  }

  try {
    // Get the most recent bill
    const billsQuery = await getDocs(
      query(collection(db, 'bills'), orderBy('timestamp', 'desc'), limit(1))
    );
    
    if (!billsQuery.empty) {
      const billId = billsQuery.docs[0].id;
      await updateDoc(doc(db, 'bills', billId), {
        phoneNumber: phoneNumber
      });
    }

    // Rest of your Twilio SMS code...
    const billItems = cart.map(item => 
      `${PRICES[item.label].description} - $${item.price.toFixed(2)} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');
    
    const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2);
    const billMessage = `Your Bill:\n${billItems}\nTotal: $${totalAmount}`;

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
    console.error('Error:', error);
    alert('Failed to process bill. Please try again.');
  }
}

// [Keep all your other existing functions unchanged]

// Initialize the app
fetchData(FEEDS.CAMERA, "camera-image");
fetchData(FEEDS.LABEL, "label-data");
setInterval(() => {
  fetchData(FEEDS.CAMERA, "camera-image");
  fetchData(FEEDS.LABEL, "label-data");
}, 5000);