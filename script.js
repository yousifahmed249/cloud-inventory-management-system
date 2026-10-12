const PRODUCT_KEY = "cloudInventoryProducts";
const ACTIVITY_KEY = "inventoryActivities";
const TRANSACTION_KEY = "inventoryTransactions";
const AUTH_TOKEN_KEY = "inventoryAuthToken";
const AUTH_USER_KEY = "inventoryAuthUser";

const authScreen = document.getElementById("authScreen");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const authSubmitButton = document.getElementById("authSubmitButton");
const toggleAuthModeButton = document.getElementById("toggleAuthMode");
const authMessage = document.getElementById("authMessage");
const logoutButton = document.getElementById("logoutButton");

const productNameInput = document.getElementById("productName");
const categoryInput = document.getElementById("category");
const supplierInput = document.getElementById("supplier");
const lowStockAlertInput = document.getElementById("lowStockAlert");
const quantityInput = document.getElementById("quantity");
const priceInput = document.getElementById("price");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const categoryFilter = document.getElementById("categoryFilter");
const sortBy = document.getElementById("sortBy");
const exportButton = document.getElementById("exportButton");
const clearAllButton = document.getElementById("clearAllButton");
const productTable = document.getElementById("productTable");
const activityList = document.getElementById("activityList");
const transactionList = document.getElementById("transactionList");
const invoiceCustomerSelect = document.getElementById("invoiceCustomerSelect");
const invoiceProductSelect = document.getElementById("invoiceProductSelect");
const invoiceQuantityInput = document.getElementById("invoiceQuantity");
const createInvoiceButton = document.getElementById("createInvoiceButton");
const invoiceSummary = document.getElementById("invoiceSummary");
const invoiceList = document.getElementById("invoiceList");
const reportList = document.getElementById("reportList");
const supplierNameInput = document.getElementById("supplierNameInput");
const supplierPhoneInput = document.getElementById("supplierPhoneInput");
const addSupplierButton = document.getElementById("addSupplierButton");
const supplierList = document.getElementById("supplierList");
const customerNameInput = document.getElementById("customerNameInput");
const customerPhoneInput = document.getElementById("customerPhoneInput");
const addCustomerButton = document.getElementById("addCustomerButton");
const customerList = document.getElementById("customerList");

let products = [];
let activities = [];
let transactions = [];
let suppliers = [];
let customers = [];
let invoices = [];
let editingIndex = null;
let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
let authMode = "login";
let currentUser = null;

function normalizeProduct(product) {
    return {
        id: product.id || Date.now() + Math.random(),
        name: product.name || "Unknown Product",
        category: product.category || "Uncategorized",
        supplier: product.supplier || "N/A",
        lowStockAlert: Number(product.lowStockAlert) > 0 ? Number(product.lowStockAlert) : 5,
        quantity: Number(product.quantity) || 0,
        price: Number(product.price) || 0
    };
}

function getStockStatus(quantity, alertLevel = 5) {
    if (quantity === 0) {
        return "Out of Stock";
    }

    if (quantity <= alertLevel) {
        return "Low Stock";
    }

    return "Stock Available";
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(value);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function loadProductsFromStorage() {
    try {
        const storedProducts = JSON.parse(localStorage.getItem(PRODUCT_KEY));
        return Array.isArray(storedProducts) ? storedProducts.map(normalizeProduct) : [];
    } catch (error) {
        return [];
    }
}

function loadActivitiesFromStorage() {
    try {
        const storedActivities = JSON.parse(localStorage.getItem(ACTIVITY_KEY));
        return Array.isArray(storedActivities) ? storedActivities : [];
    } catch (error) {
        return [];
    }
}

function loadTransactionsFromStorage() {
    try {
        const storedTransactions = JSON.parse(localStorage.getItem(TRANSACTION_KEY));
        return Array.isArray(storedTransactions) ? storedTransactions : [];
    } catch (error) {
        return [];
    }
}

function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };

    if (authToken) {
        headers.Authorization = "Bearer " + authToken;
    }

    return headers;
}

async function fetchJson(url, options = {}) {
    const apiBaseUrl = (window.INVENTORY_API_URL || "").trim().replace(/\/+$/, "");
    const apiUrl = apiBaseUrl ? apiBaseUrl + url : url;
    const response = await fetch(apiUrl, {
        headers: getAuthHeaders(),
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        if (response.status === 405) {
            throw new Error("The API server rejected this request. Check config.js and set INVENTORY_API_URL to your deployed API URL.");
        }
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
    }

    return response.json();
}

function setAuthMessage(message, isError = false) {
    if (!authMessage) {
        return;
    }

    authMessage.textContent = message;
    authMessage.style.color = isError ? "#b91c1c" : "#166534";
}

function showApp() {
    if (authScreen) authScreen.classList.add("hidden");
    if (appShell) appShell.classList.remove("hidden");
}

function showAuth() {
    if (appShell) appShell.classList.add("hidden");
    if (authScreen) authScreen.classList.remove("hidden");
}

function setAuthMode(nextMode) {
    authMode = nextMode;
    if (authSubmitButton) {
        authSubmitButton.textContent = nextMode === "login" ? "Login" : "Create Account";
    }
    if (toggleAuthModeButton) {
        toggleAuthModeButton.textContent = nextMode === "login" ? "Create Account" : "Back to Login";
    }
    setAuthMessage("");
}

async function logout() {
    authToken = "";
    currentUser = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    showAuth();
    setAuthMode("login");
    authEmailInput.value = "";
    authPasswordInput.value = "";
    authEmailInput.focus();
}

async function submitAuth(event) {
    event.preventDefault();

    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();

    if (!email || !password) {
        setAuthMessage("Email and password are required.", true);
        return;
    }

    try {
        const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
        const payload = authMode === "login"
            ? { email, password }
            : { name: email.split("@")[0] || "User", email, password };

        const result = await fetchJson(endpoint, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        authToken = result.token;
        currentUser = result.user;
        localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
        authPasswordInput.value = "";
        setAuthMessage("Login successful.");
        await loadInitialState();
        showApp();
    } catch (error) {
        setAuthMessage(error.message || "Authentication failed.", true);
    }
}

async function persistState() {
    const payload = {
        products: products.map(normalizeProduct),
        activities,
        transactions,
        suppliers,
        customers,
        invoices
    };

    try {
        await fetchJson("/api/state", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    } catch (error) {
        localStorage.setItem(PRODUCT_KEY, JSON.stringify(payload.products));
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(payload.activities));
        localStorage.setItem(TRANSACTION_KEY, JSON.stringify(payload.transactions));
        localStorage.setItem("inventorySuppliers", JSON.stringify(payload.suppliers));
        localStorage.setItem("inventoryCustomers", JSON.stringify(payload.customers));
        localStorage.setItem("inventoryInvoices", JSON.stringify(payload.invoices));
    }
}

async function loadInitialState() {
    if (!authToken) {
        showAuth();
        return;
    }

    try {
        const currentUserResponse = await fetchJson("/api/auth/me");
        currentUser = currentUserResponse.user;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));

        const state = await fetchJson("/api/state");
        products = Array.isArray(state.products) ? state.products.map(normalizeProduct) : [];
        activities = Array.isArray(state.activities) ? state.activities : [];
        transactions = Array.isArray(state.transactions) ? state.transactions : [];
        suppliers = Array.isArray(state.suppliers) ? state.suppliers : [];
        customers = Array.isArray(state.customers) ? state.customers : [];
        invoices = Array.isArray(state.invoices) ? state.invoices : [];
        showApp();
    } catch (error) {
        console.warn("Failed to load protected state, falling back to local cache.", error);
        products = loadProductsFromStorage();
        activities = loadActivitiesFromStorage();
        transactions = loadTransactionsFromStorage();
        suppliers = JSON.parse(localStorage.getItem("inventorySuppliers") || "[]");
        customers = JSON.parse(localStorage.getItem("inventoryCustomers") || "[]");
        invoices = JSON.parse(localStorage.getItem("inventoryInvoices") || "[]");
        showApp();
    }

    renderCategoryFilter();
    renderActivity();
    renderTransactions();
    renderSuppliers();
    renderCustomers();
    renderInvoices();
    renderReports();
    renderInvoiceOptions();
    renderProducts();
    resetForm();
}

function addActivity(message) {
    const timestamp = new Date().toLocaleString();
    activities.unshift({ message, timestamp });
    activities = activities.slice(0, 8);
    renderActivity();
}

function addTransaction(productName, action, quantity, totalValue) {
    const timestamp = new Date().toLocaleString();
    transactions.unshift({
        productName,
        action,
        quantity,
        totalValue,
        timestamp
    });
    transactions = transactions.slice(0, 10);
    renderTransactions();
}

function renderSuppliers() {
    if (!supplierList) {
        return;
    }

    if (suppliers.length === 0) {
        supplierList.innerHTML = "<li>No suppliers yet.</li>";
        return;
    }

    supplierList.innerHTML = suppliers.map((supplier) => `
        <li>
            <span>${escapeHtml(supplier.name)}${supplier.phone ? ` · ${escapeHtml(supplier.phone)}` : ""}</span>
            <button type="button" class="delete-btn" data-supplier-id="${escapeHtml(String(supplier.id))}">Delete</button>
        </li>
    `).join("");
}

function renderCustomers() {
    if (!customerList) {
        return;
    }

    if (customers.length === 0) {
        customerList.innerHTML = "<li>No customers yet.</li>";
        return;
    }

    customerList.innerHTML = customers.map((customer) => `
        <li>
            <span>${escapeHtml(customer.name)}${customer.phone ? ` · ${escapeHtml(customer.phone)}` : ""}</span>
            <button type="button" class="delete-btn" data-customer-id="${escapeHtml(String(customer.id))}">Delete</button>
        </li>
    `).join("");
}

function renderActivity() {
    if (!activityList) {
        return;
    }

    if (activities.length === 0) {
        activityList.innerHTML = "<li>No recent activity yet.</li>";
        return;
    }

    activityList.innerHTML = activities.map((activity) => `
        <li><strong>${escapeHtml(activity.timestamp)}</strong> — ${escapeHtml(activity.message)}</li>
    `).join("");
}

function renderTransactions() {
    if (!transactionList) {
        return;
    }

    if (transactions.length === 0) {
        transactionList.innerHTML = "<li>No transactions yet.</li>";
        return;
    }

    transactionList.innerHTML = transactions.map((transaction) => `
        <li>
            <strong>${escapeHtml(transaction.timestamp)}</strong> —
            ${escapeHtml(transaction.productName)}
            ${escapeHtml(transaction.action)}
            (${escapeHtml(String(transaction.quantity))})
            ${formatCurrency(Number(transaction.totalValue || 0))}
        </li>
    `).join("");
}

function renderInvoices() {
    if (!invoiceList) {
        return;
    }

    if (invoices.length === 0) {
        invoiceList.innerHTML = "<li>No invoices yet.</li>";
        return;
    }

    invoiceList.innerHTML = invoices.map((invoice) => `
        <li>
            <span>
                <strong>${escapeHtml(invoice.customerName || "Customer")}</strong> —
                ${escapeHtml(invoice.productName || "Product")} x ${escapeHtml(String(invoice.quantity || 0))}
            </span>
            <span>${formatCurrency(Number(invoice.subtotal || 0))}</span>
        </li>
    `).join("");
}

function renderReports() {
    if (!reportList) {
        return;
    }

    const lowStockCount = products.filter((product) => getStockStatus(product.quantity, product.lowStockAlert || 5) !== "Stock Available").length;
    const inventoryValue = products.reduce((total, product) => total + (product.quantity * product.price), 0);
    const totalRevenue = invoices.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0), 0);

    const summary = [
        { label: "Inventory Value", value: formatCurrency(inventoryValue) },
        { label: "Revenue", value: formatCurrency(totalRevenue) },
        { label: "Low Stock", value: String(lowStockCount) },
        { label: "Invoices", value: String(invoices.length) }
    ];

    reportList.innerHTML = summary.map((item) => `
        <li>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
        </li>
    `).join("");
}

function renderSummary() {
    const totalProducts = products.length;
    const lowStockCount = products.filter((product) => getStockStatus(product.quantity, product.lowStockAlert || 5) !== "Stock Available").length;
    const inventoryValue = products.reduce((total, product) => total + (product.quantity * product.price), 0);
    const totalRevenue = invoices.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0), 0);

    document.getElementById("totalProducts").textContent = String(totalProducts);
    document.getElementById("lowStockCount").textContent = String(lowStockCount);
    document.getElementById("inventoryValue").textContent = formatCurrency(inventoryValue);
    document.getElementById("totalRevenue").textContent = formatCurrency(totalRevenue);
}

function sortProducts(list) {
    const sortOption = sortBy.value;
    const sorted = [...list];

    switch (sortOption) {
        case "name-desc":
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case "quantity-desc":
            sorted.sort((a, b) => b.quantity - a.quantity);
            break;
        case "quantity-asc":
            sorted.sort((a, b) => a.quantity - b.quantity);
            break;
        case "price-desc":
            sorted.sort((a, b) => b.price - a.price);
            break;
        case "price-asc":
            sorted.sort((a, b) => a.price - b.price);
            break;
        case "name-asc":
        default:
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }

    return sorted;
}

function renderCategoryFilter() {
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const currentValue = categoryFilter.value;

    categoryFilter.innerHTML = '<option value="all">All Categories</option>' + categories.map((category) => `
        <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
    `).join("");

    if (categories.includes(currentValue)) {
        categoryFilter.value = currentValue;
    } else {
        categoryFilter.value = "all";
    }
}

function renderProducts() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedStatus = statusFilter.value;
    const selectedCategory = categoryFilter.value;

    const filteredProducts = products.filter((product) => {
        const matchesSearch = !query || [product.name, product.category, product.supplier]
            .join(" ")
            .toLowerCase()
            .includes(query);
        const matchesStatus = selectedStatus === "all" || getStockStatus(product.quantity, product.lowStockAlert || 5) === selectedStatus;
        const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
        return matchesSearch && matchesStatus && matchesCategory;
    });

    const sortedProducts = sortProducts(filteredProducts);

    if (sortedProducts.length === 0) {
        productTable.innerHTML = '<tr><td colspan="8" class="empty-state">No products found.</td></tr>';
        renderSummary();
        renderInvoiceOptions();
        return;
    }

    productTable.innerHTML = sortedProducts.map((product) => {
        const originalIndex = products.indexOf(product);
        const status = getStockStatus(product.quantity, product.lowStockAlert || 5);
        const statusClass = status === "Out of Stock"
            ? "stock-out"
            : status === "Low Stock"
                ? "stock-low"
                : "stock-good";

        return `
            <tr data-index="${originalIndex}">
                <td>${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.category)}</td>
                <td>${escapeHtml(product.supplier)}</td>
                <td>${product.quantity}</td>
                <td>${formatCurrency(product.price)}</td>
                <td>${formatCurrency(product.quantity * product.price)}</td>
                <td><span class="status-pill ${statusClass}">${status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="restock-btn" data-index="${originalIndex}">Restock</button>
                        <button type="button" class="sell-btn" data-index="${originalIndex}">Sell</button>
                        <button type="button" class="edit-btn" data-index="${originalIndex}">Edit</button>
                        <button type="button" class="delete-btn" data-index="${originalIndex}">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    renderSummary();
    renderCategoryFilter();
    renderInvoiceOptions();
}

function renderInvoiceOptions() {
    if (!invoiceCustomerSelect || !invoiceProductSelect) {
        return;
    }

    const customerOptions = [
        '<option value="">Select customer</option>',
        ...customers.map((customer) => `<option value="${escapeHtml(String(customer.id))}">${escapeHtml(customer.name)}</option>`)
    ].join("");

    const productOptions = [
        '<option value="">Select product</option>',
        ...products.map((product) => `<option value="${escapeHtml(String(product.id))}">${escapeHtml(product.name)} (${escapeHtml(String(product.quantity))})</option>`)
    ].join("");

    invoiceCustomerSelect.innerHTML = customerOptions;
    invoiceProductSelect.innerHTML = productOptions;
    updateInvoiceSummary();
}

function updateInvoiceSummary() {
    if (!invoiceSummary || !invoiceProductSelect || !invoiceQuantityInput) {
        return;
    }

    const productId = invoiceProductSelect.value;
    const quantity = Number(invoiceQuantityInput.value) || 1;
    const product = products.find((candidate) => String(candidate.id) === String(productId));

    if (!product) {
        invoiceSummary.textContent = "Select a product to see the total value.";
        return;
    }

    const maxAllowed = product.quantity;
    if (quantity > maxAllowed) {
        invoiceQuantityInput.value = String(maxAllowed || 1);
    }

    const subtotal = product.price * Number(invoiceQuantityInput.value || 1);
    invoiceSummary.textContent = `${product.name} · ${formatCurrency(product.price)} each · Total: ${formatCurrency(subtotal)}`;
}

function resetForm() {
    productNameInput.value = "";
    categoryInput.value = "";
    supplierInput.value = "";
    lowStockAlertInput.value = "5";
    quantityInput.value = "";
    priceInput.value = "";
    editingIndex = null;
    submitButton.textContent = "Add Product";
    cancelEditButton.classList.add("hidden");
    productNameInput.focus();
}

async function createInvoice() {
    const customerId = invoiceCustomerSelect.value;
    const productId = invoiceProductSelect.value;
    const quantity = Number(invoiceQuantityInput.value);
    const customer = customers.find((entry) => String(entry.id) === String(customerId));
    const product = products.find((entry) => String(entry.id) === String(productId));

    if (!customer || !product) {
        alert("Please select a customer and a product.");
        return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        alert("Invoice quantity must be greater than zero.");
        return;
    }

    if (quantity > product.quantity) {
        alert(`Only ${product.quantity} units are available for ${product.name}.`);
        return;
    }

    const subtotal = quantity * product.price;
    const invoice = {
        id: `INV-${Date.now()}`,
        customerName: customer.name,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        subtotal,
        createdAt: new Date().toISOString()
    };

    invoices.unshift(invoice);
    product.quantity = Math.max(0, product.quantity - quantity);
    addActivity(`Invoice created for ${customer.name} — ${product.name} (${quantity})`);
    addTransaction(product.name, "Sold", quantity, subtotal);
    await persistState();
    renderProducts();
    renderInvoices();
    renderReports();
    renderSummary();
    invoiceQuantityInput.value = "1";
    invoiceProductSelect.value = "";
    updateInvoiceSummary();
}

async function addSupplier() {
    const name = supplierNameInput.value.trim();
    const phone = supplierPhoneInput.value.trim();

    if (!name) {
        alert("Supplier name is required.");
        return;
    }

    const supplier = {
        id: `supplier-${Date.now()}`,
        name,
        phone,
        email: ""
    };

    suppliers.push(supplier);
    supplierNameInput.value = "";
    supplierPhoneInput.value = "";
    addActivity(`Supplier ${name} added.`);
    await persistState();
    renderSuppliers();
    renderInvoiceOptions();
}

async function addCustomer() {
    const name = customerNameInput.value.trim();
    const phone = customerPhoneInput.value.trim();

    if (!name) {
        alert("Customer name is required.");
        return;
    }

    const customer = {
        id: `customer-${Date.now()}`,
        name,
        phone,
        email: ""
    };

    customers.push(customer);
    customerNameInput.value = "";
    customerPhoneInput.value = "";
    addActivity(`Customer ${name} added.`);
    await persistState();
    renderCustomers();
    renderInvoiceOptions();
}

async function addProduct() {
    const name = productNameInput.value.trim();
    const category = categoryInput.value.trim() || "Uncategorized";
    const supplier = supplierInput.value.trim() || "N/A";
    const lowStockAlert = Number(lowStockAlertInput.value);
    const quantity = Number(quantityInput.value);
    const price = Number(priceInput.value);

    if (!name || Number.isNaN(quantity) || Number.isNaN(price) || quantity < 0 || price < 0 || Number.isNaN(lowStockAlert) || lowStockAlert < 0) {
        alert("Please enter a valid product name, quantity, price, and alert level.");
        return;
    }

    const newProduct = normalizeProduct({
        id: editingIndex !== null ? products[editingIndex].id : Date.now(),
        name,
        category,
        supplier,
        lowStockAlert,
        quantity,
        price
    });

    if (editingIndex !== null) {
        products[editingIndex] = newProduct;
        addActivity(`${name} updated in inventory.`);
    } else {
        products.push(newProduct);
        addActivity(`${name} added to inventory.`);
        addTransaction(name, "Added", quantity, quantity * price);
    }

    await persistState();
    renderProducts();
    resetForm();
}

function editProduct(index) {
    const product = products[index];
    if (!product) {
        return;
    }

    productNameInput.value = product.name;
    categoryInput.value = product.category;
    supplierInput.value = product.supplier;
    lowStockAlertInput.value = product.lowStockAlert || 5;
    quantityInput.value = product.quantity;
    priceInput.value = product.price;
    editingIndex = index;
    submitButton.textContent = "Save Changes";
    cancelEditButton.classList.remove("hidden");
    productNameInput.focus();
}

async function deleteProduct(index) {
    const product = products[index];
    if (!product) {
        return;
    }

    const confirmed = window.confirm(`Delete "${product.name}" from inventory?`);
    if (!confirmed) {
        return;
    }

    products.splice(index, 1);
    addActivity(`${product.name} removed from inventory.`);

    if (editingIndex !== null) {
        if (index === editingIndex) {
            resetForm();
        } else if (index < editingIndex) {
            editingIndex -= 1;
        }
    }

    await persistState();
    renderProducts();
}

async function adjustQuantity(index, change) {
    const product = products[index];
    if (!product) {
        return;
    }

    const nextQuantity = product.quantity + change;
    if (nextQuantity < 0) {
        alert("Quantity cannot go below zero.");
        return;
    }

    product.quantity = nextQuantity;
    const actionName = change > 0 ? "Restocked" : "Sold";
    const value = Math.abs(change) * product.price;
    addActivity(`${product.name} ${change > 0 ? "restocked" : "sold"}. New quantity: ${nextQuantity}.`);
    addTransaction(product.name, actionName, Math.abs(change), value);
    await persistState();
    renderProducts();
}

async function clearAllProducts() {
    if (products.length === 0) {
        return;
    }

    const confirmed = window.confirm("Delete all products from inventory?");
    if (!confirmed) {
        return;
    }

    products = [];
    addActivity("All products cleared from inventory.");
    addTransaction("Inventory", "Cleared", 0, 0);
    await persistState();
    resetForm();
    renderProducts();
}

function exportToCsv() {
    if (products.length === 0) {
        alert("No products available to export.");
        return;
    }

    const rows = [
        ["Product", "Category", "Supplier", "Low Stock Alert", "Quantity", "Price", "Value", "Status"],
        ...products.map((product) => [
            product.name,
            product.category,
            product.supplier,
            String(product.lowStockAlert || 5),
            String(product.quantity),
            String(product.price),
            String(product.quantity * product.price),
            getStockStatus(product.quantity, product.lowStockAlert || 5)
        ])
    ];

    const csvContent = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

submitButton.addEventListener("click", () => {
    addProduct().catch((error) => {
        console.error("Failed to save product", error);
        alert("Failed to save product.");
    });
});
cancelEditButton.addEventListener("click", resetForm);
clearAllButton.addEventListener("click", () => {
    clearAllProducts().catch((error) => {
        console.error("Failed to clear products", error);
    });
});
exportButton.addEventListener("click", exportToCsv);
searchInput.addEventListener("input", renderProducts);
statusFilter.addEventListener("change", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
sortBy.addEventListener("change", renderProducts);

[productNameInput, categoryInput, supplierInput, lowStockAlertInput, quantityInput, priceInput, supplierNameInput, supplierPhoneInput, customerNameInput, customerPhoneInput].forEach((input) => {
    if (!input) {
        return;
    }

    input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
            return;
        }

        if (input === supplierNameInput || input === supplierPhoneInput) {
            addSupplier().catch((error) => {
                console.error("Failed to add supplier", error);
            });
            return;
        }

        if (input === customerNameInput || input === customerPhoneInput) {
            addCustomer().catch((error) => {
                console.error("Failed to add customer", error);
            });
            return;
        }

        addProduct().catch((error) => {
            console.error("Failed to save product", error);
            alert("Failed to save product.");
        });
    });
});

productTable.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const index = Number(target.dataset.index);

    if (target.classList.contains("restock-btn")) {
        adjustQuantity(index, 1).catch((error) => {
            console.error("Failed to restock", error);
        });
        return;
    }

    if (target.classList.contains("sell-btn")) {
        adjustQuantity(index, -1).catch((error) => {
            console.error("Failed to sell product", error);
        });
        return;
    }

    if (target.classList.contains("edit-btn")) {
        editProduct(index);
        return;
    }

    if (target.classList.contains("delete-btn")) {
        deleteProduct(index).catch((error) => {
            console.error("Failed to delete product", error);
        });
    }
});

addSupplierButton.addEventListener("click", () => {
    addSupplier().catch((error) => {
        console.error("Failed to add supplier", error);
    });
});

addCustomerButton.addEventListener("click", () => {
    addCustomer().catch((error) => {
        console.error("Failed to add customer", error);
    });
});

createInvoiceButton.addEventListener("click", () => {
    createInvoice().catch((error) => {
        console.error("Failed to create invoice", error);
        alert("Failed to create invoice.");
    });
});

invoiceProductSelect.addEventListener("change", updateInvoiceSummary);
invoiceQuantityInput.addEventListener("input", updateInvoiceSummary);

supplierList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const supplierId = target.dataset.supplierId;
    if (!supplierId) {
        return;
    }

    const confirmed = window.confirm("Delete this supplier?");
    if (!confirmed) {
        return;
    }

    suppliers = suppliers.filter((supplier) => String(supplier.id) !== String(supplierId));
    addActivity("Supplier removed from directory.");
    persistState().catch((error) => {
        console.error("Failed to delete supplier", error);
    });
    renderSuppliers();
    renderInvoiceOptions();
});

customerList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const customerId = target.dataset.customerId;
    if (!customerId) {
        return;
    }

    const confirmed = window.confirm("Delete this customer?");
    if (!confirmed) {
        return;
    }

    customers = customers.filter((customer) => String(customer.id) !== String(customerId));
    addActivity("Customer removed from directory.");
    persistState().catch((error) => {
        console.error("Failed to delete customer", error);
    });
    renderCustomers();
    renderInvoiceOptions();
});

authForm.addEventListener("submit", submitAuth);
toggleAuthModeButton.addEventListener("click", () => {
    setAuthMode(authMode === "login" ? "register" : "login");
    authPasswordInput.value = "";
    authPasswordInput.focus();
});
logoutButton.addEventListener("click", () => {
    logout().catch((error) => {
        console.error("Failed to logout", error);
    });
});

if (authToken) {
    try {
        currentUser = JSON.parse(localStorage.getItem(AUTH_USER_KEY) || "null");
    } catch (error) {
        currentUser = null;
    }
}

loadInitialState();
