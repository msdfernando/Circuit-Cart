// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

// Global variables
let currentCustomer = null;

// Page navigation functions
function showPage(pageId) {
  // Hide all pages
  const pages = ['member-selection', 'qr-scanner', 'customer-info', 'dashboard', 'bill-page'];
  pages.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.add('hidden');
    }
  });
  
  // Show the requested page
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove('hidden');
  }
}

// Member selection handlers
function handleMemberSelection() {
  showPage('qr-scanner');
  initializeQRScanner();
}

function handleGuestSelection() {
  currentCustomer = null;
  showPage('dashboard');
  // Start the camera feed and label detection for guest mode
  startDashboardFeeds();
}

// USB Scanner functionality
function initializeQRScanner() {
  const scannerInput = document.getElementById('scanner-input');
  const clearButton = document.getElementById('clear-scanner');
  const focusButton = document.getElementById('focus-scanner');
  const statusDiv = document.getElementById('scanner-status');

  if (scannerInput) {
    // Auto-focus the input
    scannerInput.focus();

    // Handle scanner input with aggressive clearing
    scannerInput.addEventListener('input', handleScannerInput);
    scannerInput.addEventListener('keypress', handleEnterKey);
    scannerInput.addEventListener('paste', handlePasteEvent);

    // Add aggressive input monitoring to stop continuous typing
    let inputCount = 0;
    let lastInputTime = 0;

    scannerInput.addEventListener('input', function(e) {
      const currentTime = Date.now();

      // If input is happening too frequently, clear it
      if (currentTime - lastInputTime < 50) {
        inputCount++;
        if (inputCount > 5 && isProcessingQR) {
          e.target.value = '';
          return;
        }
      } else {
        inputCount = 0;
      }

      lastInputTime = currentTime;
    });

    // Keep focus on scanner input
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#customer-section') && !e.target.closest('.btn')) {
        setTimeout(() => scannerInput.focus(), 100);
      }
    });

    showScannerStatus('System ready. Click in the green field and scan a QR code.', 'info');
  }

  // Setup button handlers
  if (clearButton) {
    clearButton.addEventListener('click', clearScanner);
  }

  if (focusButton) {
    focusButton.addEventListener('click', focusScanner);
  }
}

// Global variables to prevent multiple processing
let isProcessingQR = false;
let scanTimeout = null;
let lastProcessedQR = '';
let scanStartTime = 0;

// Handle scanner input
function handleScannerInput(event) {
  const input = event.target;
  const scannedData = input.value.trim();

  // If we're already processing, immediately clear, disable input and stop
  if (isProcessingQR) {
    input.value = '';
    input.disabled = true;
    setTimeout(() => {
      input.disabled = false;
      input.focus();
    }, 3000);
    return;
  }

  // Check if this looks like a complete QR code
  if (scannedData.length >= 8 && (scannedData.includes('CUSTOMER:') || scannedData.match(/^[A-Z0-9]+$/))) {
    // Immediately disable input to stop continuous typing
    input.disabled = true;

    // Check if this is the same QR code we just processed
    if (scannedData === lastProcessedQR) {
      input.value = '';
      input.disabled = false;
      input.focus();
      return;
    }

    // Process immediately
    processScannedData(scannedData);
  }
}

// Handle Enter key press
function handleEnterKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const scannedData = event.target.value.trim();
    if (scannedData && !isProcessingQR) {
      processScannedData(scannedData);
    }
  }
}

// Handle paste event (some USB scanners trigger this)
function handlePasteEvent(event) {
  event.preventDefault();
  const pastedData = (event.clipboardData || window.clipboardData).getData('text').trim();

  if (pastedData && !isProcessingQR) {
    // Clear the input first
    event.target.value = '';
    // Process the pasted data immediately
    processScannedData(pastedData);
  }
}

// Process scanned data
async function processScannedData(scannedData) {
  // Prevent multiple processing
  if (isProcessingQR) {
    return;
  }

  isProcessingQR = true;
  lastProcessedQR = scannedData; // Store the processed QR
  showScannerStatus('Processing scanned QR code...', 'info');

  // Get scanner input to manage its state
  const scannerInput = document.getElementById('scanner-input');

  try {
    // Clear and disable input immediately
    if (scannerInput) {
      scannerInput.value = '';
      scannerInput.disabled = true;
    }

    // Format QR data
    let qrData = scannedData;
    if (!qrData.startsWith('CUSTOMER:')) {
      qrData = `CUSTOMER:${scannedData}`;
    }

    // Process the QR code
    await processQRCode(qrData);

  } catch (error) {
    showScannerStatus(`Error: ${error.message}`, 'error');
    console.error('Scanner error:', error);
    // Reset last processed QR on error so user can try again
    lastProcessedQR = '';

    // Re-enable input on error
    if (scannerInput) {
      scannerInput.disabled = false;
      scannerInput.focus();
    }
  } finally {
    // Reset processing flag after a delay
    setTimeout(() => {
      isProcessingQR = false;
      // Re-enable input if still on scanner page
      if (scannerInput && !scannerInput.disabled) {
        scannerInput.focus();
      }
    }, 2000);
  }
}

// Utility functions for scanner
function clearScanner() {
  const scannerInput = document.getElementById('scanner-input');
  if (scannerInput) {
    scannerInput.value = '';
    scannerInput.disabled = false;
    scannerInput.focus();
  }

  // Reset all processing flags and variables
  isProcessingQR = false;
  lastProcessedQR = '';
  scanStartTime = 0;
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }

  showScannerStatus('Scanner cleared. Ready for next scan.', 'info');
}

function focusScanner() {
  const scannerInput = document.getElementById('scanner-input');
  if (scannerInput) {
    scannerInput.focus();
  }
  showScannerStatus('Scanner focused. Ready to scan.', 'info');
}

function showScannerStatus(message, type = 'info') {
  const statusDiv = document.getElementById('scanner-status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = `scanner-status ${type}`;
  }
}

// Process QR code data
async function processQRCode(qrData) {
  try {
    console.log('Raw QR data received:', JSON.stringify(qrData));
    console.log('QR data length:', qrData.length);
    console.log('QR data characters:', qrData.split('').map(c => c.charCodeAt(0)));

    // Extract customer ID from QR data
    let customerId;

    // Handle different QR code formats
    if (qrData.startsWith('CUSTOMER:')) {
      // Remove CUSTOMER: prefix and any extra colons
      customerId = qrData.replace('CUSTOMER:', '').replace(/^:+/, '').trim();
      console.log('Extracted customer ID from CUSTOMER: prefix:', customerId);
    } else if (qrData === 'CUSTOMER' || qrData.trim() === 'CUSTOMER') {
      // If QR code only contains "CUSTOMER", use a test customer ID
      console.log('QR code contains only "CUSTOMER", using test customer CC002287');
      customerId = 'CC002287';
    } else {
      // Assume the QR code contains the customer ID directly
      customerId = qrData.trim();
      console.log('Using QR data directly as customer ID:', customerId);
    }

    console.log('Final customer ID to process:', customerId);

    // Validate customer ID format
    if (!customerId || customerId.length < 2) {
      throw new Error(`Invalid customer ID format: "${customerId}"`);
    }

    showScannerStatus('Loading customer information...', 'info');

    // Fetch customer data from Firestore
    console.log('Fetching customer from Firestore with ID:', customerId);
    const customerDoc = await getDoc(doc(db, 'customers', customerId));

    if (!customerDoc.exists()) {
      console.log('Customer document not found for ID:', customerId);
      throw new Error(`Customer not found with ID: ${customerId}`);
    }

    const customerData = customerDoc.data();
    currentCustomer = {
      id: customerId,
      ...customerData
    };

    // Display customer information
    displayCustomerInfo(currentCustomer);
    showScannerStatus(`Customer loaded: ${customerData.full_name}`, 'success');

    // Navigate to customer info page after a short delay
    setTimeout(() => {
      showPage('customer-info');
    }, 1000);

  } catch (error) {
    console.error('Error processing QR code:', error);

    // Handle specific Firebase errors
    if (error.code === 'permission-denied') {
      showScannerStatus('Error: Database access denied. Please check Firebase security rules.', 'error');
    } else if (error.message.includes('Missing or insufficient permissions')) {
      showScannerStatus('Error: Missing database permissions. Please check Firebase configuration.', 'error');
    } else if (error.message.includes('client is offline') || error.message.includes('Failed to get document because the client is offline')) {
      showScannerStatus('Error: No internet connection. Please check your network and try again.', 'error');
    } else if (error.code === 'unavailable') {
      showScannerStatus('Error: Database temporarily unavailable. Please try again.', 'error');
    } else {
      showScannerStatus(`Error: ${error.message}`, 'error');
    }

    // Re-enable scanner input on error
    const scannerInput = document.getElementById('scanner-input');
    if (scannerInput) {
      scannerInput.disabled = false;
      scannerInput.focus();
    }
  }
}

// Display customer information
function displayCustomerInfo(customer) {
  const nameElement = document.getElementById('customer-name');
  const photoElement = document.getElementById('customer-photo');
  const balanceElement = document.getElementById('wallet-balance');
  
  if (nameElement) {
    nameElement.textContent = customer.full_name || 'Unknown Customer';
  }
  
  if (photoElement) {
    const photoUrl = customer.photo_url || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.full_name || 'User')}&background=eee&color=111&size=120`;
    photoElement.src = photoUrl;
    photoElement.alt = customer.full_name || 'Customer Photo';
  }
  
  if (balanceElement) {
    const balance = customer.wallet_balance || 0;
    balanceElement.textContent = `$${balance.toFixed(2)}`;
  }
}

// Continue shopping handler
function handleContinueShopping() {
  showPage('dashboard');
  startDashboardFeeds();
}

// Back navigation handlers
function handleBackToSelection() {
  currentCustomer = null;
  // Clear scanner input if present
  const scannerInput = document.getElementById('scanner-input');
  if (scannerInput) {
    scannerInput.value = '';
  }

  // Reset processing flags
  isProcessingQR = false;
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }

  showPage('member-selection');
}

function handleBackToScanner() {
  // Reset processing flags
  isProcessingQR = false;
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }

  showPage('qr-scanner');
  initializeQRScanner();
}

// Start dashboard feeds (camera and label detection)
function startDashboardFeeds() {
  // Import and call the existing fetchData function
  import('./main.js').then(module => {
    module.fetchData("camera", "camera-image");
    module.fetchData("label", "label-data");
    
    // Set up polling
    setInterval(() => {
      module.fetchData("camera", "camera-image"); 
      module.fetchData("label", "label-data");    
    }, 5000);
  });
}

// Initialize navigation when DOM is loaded
function initializeNavigation() {
  // Member selection buttons
  const memberBtn = document.getElementById('member-btn');
  const guestBtn = document.getElementById('guest-btn');
  
  if (memberBtn) {
    memberBtn.addEventListener('click', handleMemberSelection);
  }
  
  if (guestBtn) {
    guestBtn.addEventListener('click', handleGuestSelection);
  }
  
  // Back navigation buttons
  const backToSelectionBtn = document.getElementById('back-to-selection');
  const backToScannerBtn = document.getElementById('back-to-scanner');
  const continueShopping = document.getElementById('continue-shopping');
  
  if (backToSelectionBtn) {
    backToSelectionBtn.addEventListener('click', handleBackToSelection);
  }
  
  if (backToScannerBtn) {
    backToScannerBtn.addEventListener('click', handleBackToScanner);
  }
  
  if (continueShopping) {
    continueShopping.addEventListener('click', handleContinueShopping);
  }
  
  // Show the member selection page by default
  showPage('member-selection');
}

// Function to get current customer (for external access)
function getCurrentCustomer() {
  return currentCustomer;
}

// Export functions
export {
  showPage,
  initializeNavigation,
  currentCustomer,
  getCurrentCustomer,
  updateDoc,
  doc,
  db
};
