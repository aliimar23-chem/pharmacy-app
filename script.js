
// Register service worker for PWA installation/offline cache.
// It works only when the app is served through HTTPS or localhost, not by opening index.html as file://.
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}

// script.js
// This file contains the core logic for the Pharmacy Inventory PWA.

/*
 * Data structure:
 * Each product is stored as an object with the following properties:
 * {
 *   id: string (unique identifier),
 *   barcode: string,
 *   name: string,
 *   price: number,
 *   quantity: number,
 *   expiry: string (YYYY-MM-DD or empty),
 *   minStock: number
 * }
 */

// Cached DOM elements for convenience
const scanBtn = document.getElementById('scanBtn');
const addBtn = document.getElementById('addBtn');
const inventoryBtn = document.getElementById('inventoryBtn');

const scanSection = document.getElementById('scanSection');
const addSection = document.getElementById('addSection');
const inventorySection = document.getElementById('inventorySection');
const messageDiv = document.getElementById('message');

const video = document.getElementById('video');
const scanResult = document.getElementById('scanResult');
const stopScanBtn = document.getElementById('stopScanBtn');
const manualBarcodeInput = document.getElementById('manualBarcode');
const manualSearchBtn = document.getElementById('manualSearch');

const productForm = document.getElementById('productForm');
const productIdInput = document.getElementById('productId');
const barcodeInput = document.getElementById('barcode');
const nameInput = document.getElementById('name');
const priceInput = document.getElementById('price');
const quantityInput = document.getElementById('quantity');
const expiryInput = document.getElementById('expiry');
const minStockInput = document.getElementById('minStock');
const cancelAddBtn = document.getElementById('cancelAdd');

const inventoryTableBody = document.querySelector('#inventoryTable tbody');
const exportBtn = document.getElementById('exportBtn');

// In-memory cache of products
let products = [];

// Barcode scanning variables
let scanning = false;
let videoStream = null;
let barcodeDetector = null;

// Load products from localStorage at startup
function loadProducts() {
  const stored = localStorage.getItem('products');
  if (stored) {
    try {
      products = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse products from localStorage', e);
      products = [];
    }
  }
}

// Save current products to localStorage
function saveProducts() {
  localStorage.setItem('products', JSON.stringify(products));
}

// Utility to show feedback messages
function showMessage(text, type = 'success', duration = 3000) {
  messageDiv.textContent = text;
  messageDiv.className = 'message ' + type;
  messageDiv.style.display = 'block';
  if (duration > 0) {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, duration);
  }
}

// Hide all sections and then show the requested one
function showSection(section) {
  // Hide all
  scanSection.style.display = 'none';
  addSection.style.display = 'none';
  inventorySection.style.display = 'none';
  // Stop scanning if switching away from scan section
  if (section !== scanSection) {
    stopScanning();
  }
  // Show requested section
  section.style.display = 'block';
}

// Initialize navigation buttons
scanBtn.addEventListener('click', () => {
  showSection(scanSection);
  startScanning();
});

addBtn.addEventListener('click', () => {
  openAddProductForm();
});

inventoryBtn.addEventListener('click', () => {
  showSection(inventorySection);
  renderInventory();
});

// Start barcode scanning using the BarcodeDetector API
async function startScanning() {
  // Reset previous results
  scanResult.innerHTML = '';
  // If scanning already started, do nothing
  if (scanning) return;
  // Check for BarcodeDetector support
  if (!('BarcodeDetector' in window)) {
    showMessage('Barcode scanning is not supported in this browser. Please use manual entry.', 'error', 5000);
    return;
  }
  try {
    // Create a detector for common barcode formats
    barcodeDetector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'upc_e', 'qr_code']
    });
  } catch (e) {
    console.error('Failed to create BarcodeDetector', e);
    showMessage('Error initializing barcode detector.', 'error');
    return;
  }
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = videoStream;
    scanning = true;
    requestAnimationFrame(scanFrame);
  } catch (err) {
    console.error('Error accessing camera', err);
    showMessage('Unable to access the camera.', 'error');
  }
}

// Stop scanning and release the camera
function stopScanning() {
  scanning = false;
  if (videoStream) {
    const tracks = videoStream.getTracks();
    tracks.forEach((t) => t.stop());
    video.srcObject = null;
    videoStream = null;
  }
}

// Continuously scan frames from the video element
async function scanFrame() {
  if (!scanning) return;
  try {
    const barcodes = await barcodeDetector.detect(video);
    if (barcodes && barcodes.length > 0) {
      const barcode = barcodes[0].rawValue;
      handleBarcode(barcode);
      // Pause scanning to handle result
      stopScanning();
      return;
    }
  } catch (e) {
    console.error('Error during barcode detection', e);
  }
  requestAnimationFrame(scanFrame);
}

// Handle a detected or manually entered barcode
function handleBarcode(barcode) {
  const product = products.find((p) => p.barcode === barcode);
  if (product) {
    // Display product info and action buttons
    scanResult.innerHTML = '';
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
      <p><strong>${product.name}</strong> (Barcode: ${product.barcode})</p>
      <p>Price: ${product.price.toFixed(2)} EGP</p>
      <p>Quantity: ${product.quantity}</p>
      <p>Expiry: ${product.expiry || '—'}</p>
      <p>Min stock: ${product.minStock}</p>
    `;
    const actionsDiv = document.createElement('div');
    actionsDiv.style.marginTop = '0.5rem';
    // Sell button
    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Sell 1';
    sellBtn.className = 'primary';
    sellBtn.onclick = () => {
      sellProduct(product.id);
      scanResult.innerHTML = '';
      showMessage(`Sold 1 item of ${product.name}.`, 'success');
    };
    // Add stock button
    const addStockBtn = document.createElement('button');
    addStockBtn.textContent = 'Add stock';
    addStockBtn.className = 'secondary';
    addStockBtn.onclick = () => {
      const qtyStr = prompt('Enter quantity to add:', '1');
      const qty = parseInt(qtyStr, 10);
      if (!isNaN(qty) && qty > 0) {
        addStock(product.id, qty);
        showMessage(`Added ${qty} to ${product.name}.`, 'success');
      }
      scanResult.innerHTML = '';
    };
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'secondary';
    editBtn.onclick = () => {
      openAddProductForm(product);
      scanResult.innerHTML = '';
    };
    actionsDiv.appendChild(sellBtn);
    actionsDiv.appendChild(addStockBtn);
    actionsDiv.appendChild(editBtn);
    scanResult.appendChild(infoDiv);
    scanResult.appendChild(actionsDiv);
  } else {
    // New product: prompt user to add
    scanResult.innerHTML = `<p>Barcode <strong>${barcode}</strong> is not in the system. You can add it below.</p>`;
    openAddProductForm({ barcode });
  }
}

// Manual search handler
manualSearchBtn.addEventListener('click', () => {
  const code = manualBarcodeInput.value.trim();
  if (!code) return;
  handleBarcode(code);
});

// Stop scanning when stop button is pressed
stopScanBtn.addEventListener('click', () => {
  stopScanning();
});

// Open the add product form (empty or prefilled)
function openAddProductForm(product = null) {
  // Clear the form
  productIdInput.value = product && product.id ? product.id : '';
  barcodeInput.value = product && product.barcode ? product.barcode : '';
  nameInput.value = product && product.name ? product.name : '';
  priceInput.value = product && product.price != null ? product.price : '';
  quantityInput.value = product && product.quantity != null ? product.quantity : '';
  expiryInput.value = product && product.expiry ? product.expiry : '';
  minStockInput.value = product && product.minStock != null ? product.minStock : 0;
  showSection(addSection);
}

// Handle saving or updating a product
productForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = productIdInput.value;
  const barcode = barcodeInput.value.trim();
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  const quantity = parseInt(quantityInput.value, 10);
  const expiry = expiryInput.value;
  const minStock = parseInt(minStockInput.value, 10) || 0;
  if (!barcode || !name || isNaN(price) || isNaN(quantity)) {
    showMessage('Please fill in all required fields.', 'error');
    return;
  }
  if (id) {
    // Update existing product
    const prodIndex = products.findIndex((p) => p.id === id);
    if (prodIndex >= 0) {
      products[prodIndex].barcode = barcode;
      products[prodIndex].name = name;
      products[prodIndex].price = price;
      products[prodIndex].quantity = quantity;
      products[prodIndex].expiry = expiry;
      products[prodIndex].minStock = minStock;
      showMessage('Product updated successfully.');
    }
  } else {
    // Create new product
    const newProduct = {
      id: Date.now().toString(),
      barcode,
      name,
      price,
      quantity,
      expiry,
      minStock
    };
    products.push(newProduct);
    showMessage('Product added successfully.');
  }
  saveProducts();
  showSection(inventorySection);
  renderInventory();
});

// Cancel add/edit form
cancelAddBtn.addEventListener('click', () => {
  showSection(inventorySection);
  renderInventory();
});

// Render the inventory table
function renderInventory() {
  // Clear existing rows
  inventoryTableBody.innerHTML = '';
  const today = new Date().toISOString().split('T')[0];
  products.forEach((product) => {
    const tr = document.createElement('tr');
    // Determine row classes based on low stock or expiry
    if (product.quantity <= product.minStock) {
      tr.classList.add('low-stock');
    }
    if (product.expiry && product.expiry < today) {
      tr.classList.add('expired');
    }
    tr.innerHTML = `
      <td>${product.barcode}</td>
      <td>${product.name}</td>
      <td>${product.price.toFixed(2)}</td>
      <td>${product.quantity}</td>
      <td>${product.expiry || '—'}</td>
      <td>${product.minStock}</td>
      <td class="actions"></td>
    `;
    const actionsCell = tr.querySelector('.actions');
    // Sell button
    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Sell';
    sellBtn.className = 'primary';
    sellBtn.style.fontSize = '0.75rem';
    sellBtn.onclick = () => {
      sellProduct(product.id);
      showMessage(`Sold 1 item of ${product.name}.`, 'success');
      renderInventory();
    };
    // Add stock button
    const addStockBtn = document.createElement('button');
    addStockBtn.textContent = 'Add';
    addStockBtn.className = 'secondary';
    addStockBtn.style.fontSize = '0.75rem';
    addStockBtn.onclick = () => {
      const qtyStr = prompt('Enter quantity to add:', '1');
      const qty = parseInt(qtyStr, 10);
      if (!isNaN(qty) && qty > 0) {
        addStock(product.id, qty);
        showMessage(`Added ${qty} to ${product.name}.`, 'success');
        renderInventory();
      }
    };
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'secondary';
    editBtn.style.fontSize = '0.75rem';
    editBtn.onclick = () => {
      openAddProductForm(product);
    };
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'secondary';
    deleteBtn.style.fontSize = '0.75rem';
    deleteBtn.onclick = () => {
      if (confirm(`Are you sure you want to delete ${product.name}?`)) {
        deleteProduct(product.id);
        showMessage(`${product.name} deleted.`, 'success');
        renderInventory();
      }
    };
    actionsCell.appendChild(sellBtn);
    actionsCell.appendChild(addStockBtn);
    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(deleteBtn);
    inventoryTableBody.appendChild(tr);
  });
}

// Sell one quantity of a product
function sellProduct(id) {
  const index = products.findIndex((p) => p.id === id);
  if (index >= 0) {
    if (products[index].quantity > 0) {
      products[index].quantity -= 1;
      saveProducts();
    } else {
      showMessage('No more stock available to sell.', 'error');
    }
  }
}

// Add stock to a product
function addStock(id, quantity) {
  const index = products.findIndex((p) => p.id === id);
  if (index >= 0) {
    products[index].quantity += quantity;
    saveProducts();
  }
}

// Delete a product from the list
function deleteProduct(id) {
  const index = products.findIndex((p) => p.id === id);
  if (index >= 0) {
    products.splice(index, 1);
    saveProducts();
  }
}

// Export products data to CSV
function exportCSV() {
  if (products.length === 0) {
    showMessage('No products to export.', 'error');
    return;
  }
  const header = ['Barcode', 'Name', 'Price', 'Quantity', 'Expiry', 'MinStock'];
  const rows = products.map((p) => [
    p.barcode,
    p.name,
    p.price,
    p.quantity,
    p.expiry || '',
    p.minStock
  ]);
  let csvContent = header.join(',') + '\n';
  rows.forEach((r) => {
    csvContent += r.map((v) => {
      // Escape commas and quotes
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(',') + '\n';
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'inventory.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

exportBtn.addEventListener('click', exportCSV);

// Initialise app: load products and show inventory section by default
function init() {
  loadProducts();
  showSection(inventorySection);
  renderInventory();
}

// Run initialisation when DOM is ready
document.addEventListener('DOMContentLoaded', init);