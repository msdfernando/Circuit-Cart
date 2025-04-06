// scripts/admin.js
import { db, auth } from './firebase-config.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  where,
  onAuthStateChanged,
  signOut
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

// Check authentication state
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html';
  }
});

// Logout button
document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
});

// Add product
document.getElementById('add-product-btn').addEventListener('click', async () => {
  const name = document.getElementById('product-name').value.trim();
  const description = document.getElementById('product-desc').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);

  if (!name || !description || isNaN(price)) {
    alert('Please fill all fields correctly');
    return;
  }

  try {
    await addDoc(collection(db, 'products'), {
      name: name.toUpperCase(),
      description,
      price,
      createdAt: serverTimestamp()
    });

    alert('Product added successfully');
    document.getElementById('product-name').value = '';
    document.getElementById('product-desc').value = '';
    document.getElementById('product-price').value = '';
    loadProducts();
  } catch (error) {
    console.error('Error adding product:', error);
    alert('Failed to add product');
  }
});

// Load products
async function loadProducts() {
  const productsContainer = document.getElementById('products-container');
  productsContainer.innerHTML = '<p>Loading products...</p>';

  try {
    const q = query(collection(db, 'products'), orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    productsContainer.innerHTML = '';
    if (querySnapshot.empty) {
      productsContainer.innerHTML = '<p>No products found</p>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const product = doc.data();
      const productItem = document.createElement('div');
      productItem.className = 'product-item';
      productItem.innerHTML = `
        <div>
          <strong>${product.name}</strong>
          <p>${product.description}</p>
        </div>
        <div>$${product.price.toFixed(2)}</div>
      `;
      productsContainer.appendChild(productItem);
    });
  } catch (error) {
    console.error('Error loading products:', error);
    productsContainer.innerHTML = '<p>Error loading products</p>';
  }
}

// Load transactions with date filtering
async function loadTransactions() {
  const transactionsContainer = document.getElementById('transactions-container');
  transactionsContainer.innerHTML = '<p>Loading transactions...</p>';

  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;

  try {
    let q = query(collection(db, 'bills'), orderBy('timestamp', 'desc'), limit(50));
    
    if (startDate) {
      q = query(q, where('timestamp', '>=', new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      q = query(q, where('timestamp', '<=', end));
    }

    const querySnapshot = await getDocs(q);
    transactionsContainer.innerHTML = '';

    if (querySnapshot.empty) {
      transactionsContainer.innerHTML = '<p>No transactions found</p>';
      return;
    }

    querySnapshot.forEach((doc) => {
      const bill = doc.data();
      const transactionItem = document.createElement('div');
      transactionItem.className = 'transaction-item';
      
      const date = bill.timestamp?.toDate().toLocaleString() || 'No date';
      const phone = bill.phoneNumber || 'No phone';
      
      transactionItem.innerHTML = `
        <div>${date}</div>
        <div>$${bill.total.toFixed(2)}</div>
        <div>${phone}</div>
      `;
      transactionsContainer.appendChild(transactionItem);
    });
  } catch (error) {
    console.error('Error loading transactions:', error);
    transactionsContainer.innerHTML = '<p>Error loading transactions</p>';
  }
}

// Initialize the admin page
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadTransactions();
  
  document.getElementById('apply-filter').addEventListener('click', () => {
    loadTransactions();
  });
});