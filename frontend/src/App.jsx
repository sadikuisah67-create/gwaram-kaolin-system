import React, { useEffect, useState } from "react";
import "./App.css";

const API = "https://gwaram-kaolin-backend.onrender.com/api";

// =====================================================
// MENU ITEMS
// =====================================================

const menuItems = [
  { name: "Dashboard", icon: "fa-solid fa-chart-column" },
  { name: "Workers", icon: "fa-solid fa-helmet-safety" },
  { name: "Mining Sites", icon: "fa-solid fa-mountain" },
  { name: "Products", icon: "fa-solid fa-box" },
  { name: "Orders", icon: "fa-solid fa-file-invoice" },
  { name: "Customers", icon: "fa-solid fa-users" },
  { name: "Suppliers", icon: "fa-solid fa-truck" },
  { name: "Reports", icon: "fa-solid fa-chart-line" },
];

// =====================================================
// API HELPER
// =====================================================

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

// =====================================================
// HELPERS
// =====================================================

function getArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatCurrency(value) {
  return `₦${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (
    value === "completed" ||
    value === "active" ||
    value === "available"
  ) {
    return "status-success";
  }

  if (value === "pending" || value === "inactive") {
    return "status-warning";
  }

  if (value === "processing" || value === "in progress") {
    return "status-processing";
  }

  if (value === "cancelled" || value === "unavailable") {
    return "status-danger";
  }

  return "status-processing";
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${getStatusClass(status)}`}>
      {status || "N/A"}
    </span>
  );
}

// =====================================================
// MAIN APP
// =====================================================

function App() {
  const [loggedIn, setLoggedIn] = useState(
    !!localStorage.getItem("gwaram_user")
  );

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("gwaram_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [loginEmail, setLoginEmail] = useState(
    "admin@gwaramkaolin.com"
  );

  const [loginPassword, setLoginPassword] = useState("Admin123");
  const [loginLoading, setLoginLoading] = useState(false);

  const [activePage, setActivePage] = useState("Dashboard");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [workers, setWorkers] = useState([]);
  const [miningSites, setMiningSites] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(false);

  // =====================================================
  // FORMS
  // =====================================================

  const [workerForm, setWorkerForm] = useState({
    worker_type: "",
    skill: "",
    availability: "available",
    daily_rate: "",
    site_id: "",
  });

  const [siteForm, setSiteForm] = useState({
    site_name: "",
    location: "",
    description: "",
    status: "active",
  });

  const [productForm, setProductForm] = useState({
    product_name: "",
    grade: "",
    quantity_available: "",
    unit: "tons",
    price_per_unit: "",
  });

  const [customerForm, setCustomerForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
  });

  const [supplierForm, setSupplierForm] = useState({
    supplier_name: "",
    phone: "",
    email: "",
    address: "",
    status: "active",
  });

  const [orderForm, setOrderForm] = useState({
    customer_id: "",
    product_id: "",
    quantity: "",
    order_status: "pending",
  });

  // =====================================================
  // MESSAGE
  // =====================================================

  function showMessage(text, type = "success") {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  // =====================================================
  // LOAD DATA
  // =====================================================

  async function loadAllData(showSuccess = false) {
    setLoading(true);

    try {
      const results = await Promise.all([
        apiRequest("/workers"),
        apiRequest("/mining-sites"),
        apiRequest("/kaolin-products"),
        apiRequest("/customers"),
        apiRequest("/suppliers"),
        apiRequest("/orders"),
      ]);

      setWorkers(getArray(results[0]));
      setMiningSites(getArray(results[1]));
      setProducts(getArray(results[2]));
      setCustomers(getArray(results[3]));
      setSuppliers(getArray(results[4]));
      setOrders(getArray(results[5]));

      if (showSuccess) {
        showMessage("System data refreshed successfully.");
      }
    } catch (error) {
      showMessage(
        `Unable to load system data: ${error.message}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loggedIn) {
      loadAllData();
    }
  }, [loggedIn]);

  // =====================================================
  // LOGIN
  // =====================================================

  async function handleLogin(event) {
    event.preventDefault();

    setLoginLoading(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      localStorage.setItem(
        "gwaram_user",
        JSON.stringify(data.user)
      );

      setCurrentUser(data.user);
      setLoggedIn(true);

      showMessage("Login successful.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoginLoading(false);
    }
  }

  // =====================================================
  // LOGOUT
  // =====================================================

  function handleLogout() {
    localStorage.removeItem("gwaram_user");
    setLoggedIn(false);
    setCurrentUser(null);
    setActivePage("Dashboard");
    setMessage("");
  }

  // =====================================================
  // WORKERS
  // =====================================================

  async function addWorker(event) {
    event.preventDefault();

    try {
      await apiRequest("/workers", {
        method: "POST",
        body: JSON.stringify({
          ...workerForm,
          site_id: workerForm.site_id || null,
        }),
      });

      setWorkerForm({
        worker_type: "",
        skill: "",
        availability: "available",
        daily_rate: "",
        site_id: "",
      });

      showMessage("Worker added successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function deleteWorker(id) {
    if (!window.confirm("Delete this worker?")) return;

    try {
      await apiRequest(`/workers/${id}`, {
        method: "DELETE",
      });

      showMessage("Worker deleted successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  // =====================================================
  // MINING SITES
  // =====================================================

  async function addMiningSite(event) {
    event.preventDefault();

    try {
      await apiRequest("/mining-sites", {
        method: "POST",
        body: JSON.stringify(siteForm),
      });

      setSiteForm({
        site_name: "",
        location: "",
        description: "",
        status: "active",
      });

      showMessage("Mining site added successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function deleteMiningSite(id) {
    if (!window.confirm("Delete this mining site?")) return;

    try {
      await apiRequest(`/mining-sites/${id}`, {
        method: "DELETE",
      });

      showMessage("Mining site deleted successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  // =====================================================
  // PRODUCTS
  // =====================================================

  async function addProduct(event) {
    event.preventDefault();

    try {
      await apiRequest("/kaolin-products", {
        method: "POST",
        body: JSON.stringify(productForm),
      });

      setProductForm({
        product_name: "",
        grade: "",
        quantity_available: "",
        unit: "tons",
        price_per_unit: "",
      });

      showMessage("Product added successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function deleteProduct(id) {
    if (!window.confirm("Delete this product?")) return;

    try {
      await apiRequest(`/kaolin-products/${id}`, {
        method: "DELETE",
      });

      showMessage("Product deleted successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  // =====================================================
  // CUSTOMERS
  // =====================================================

  async function addCustomer(event) {
    event.preventDefault();

    try {
      await apiRequest("/customers", {
        method: "POST",
        body: JSON.stringify(customerForm),
      });

      setCustomerForm({
        full_name: "",
        phone: "",
        email: "",
        address: "",
      });

      showMessage("Customer added successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function deleteCustomer(id) {
    if (!window.confirm("Delete this customer?")) return;

    try {
      await apiRequest(`/customers/${id}`, {
        method: "DELETE",
      });

      showMessage("Customer deleted successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  // =====================================================
  // SUPPLIERS
  // =====================================================

  async function addSupplier(event) {
    event.preventDefault();

    try {
      await apiRequest("/suppliers", {
        method: "POST",
        body: JSON.stringify(supplierForm),
      });

      setSupplierForm({
        supplier_name: "",
        phone: "",
        email: "",
        address: "",
        status: "active",
      });

      showMessage("Supplier added successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function deleteSupplier(id) {
    if (!window.confirm("Delete this supplier?")) return;

    try {
      await apiRequest(`/suppliers/${id}`, {
        method: "DELETE",
      });

      showMessage("Supplier deleted successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  // =====================================================
  // ORDERS
  // =====================================================

  const selectedProduct = products.find(
    (product) =>
      String(product.product_id) ===
      String(orderForm.product_id)
  );

  const calculatedTotalAmount =
    Number(selectedProduct?.price_per_unit || 0) *
    Number(orderForm.quantity || 0);

  async function addOrder(event) {
    event.preventDefault();

    try {
      await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify(orderForm),
      });

      setOrderForm({
        customer_id: "",
        product_id: "",
        quantity: "",
        order_status: "pending",
      });

      showMessage("Order added successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  async function deleteOrder(id) {
    if (!window.confirm("Delete this order?")) return;

    try {
      await apiRequest(`/orders/${id}`, {
        method: "DELETE",
      });

      showMessage("Order deleted successfully.");
      loadAllData();
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  // =====================================================
  // LOGIN PAGE
  // =====================================================

  if (!loggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">GK</div>

          <h1>Gwaram Kaolin</h1>

          <p className="login-subtitle">
            Supply Chain and Labor Management System
          </p>

          <h2>Administrator Login</h2>

          {message && (
            <div
              className={
                messageType === "error"
                  ? "error-message"
                  : "success-message"
              }
            >
              {message}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <label>Email Address</label>

            <input
              type="email"
              value={loginEmail}
              onChange={(event) =>
                setLoginEmail(event.target.value)
              }
              required
            />

            <label>Password</label>

            <input
              type="password"
              value={loginPassword}
              onChange={(event) =>
                setLoginPassword(event.target.value)
              }
              required
            />

            <button
              type="submit"
              className="login-button"
              disabled={loginLoading}
            >
              {loginLoading
                ? "Signing In..."
                : "Login to System"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =====================================================
  // DASHBOARD
  // =====================================================

  function renderDashboard() {
    const totalOrderAmount = orders.reduce(
      (sum, order) =>
        sum + Number(order.total_amount || 0),
      0
    );

    return (
      <>
        <div className="dashboard-heading">
          <div>
            <h1>Dashboard</h1>
            <p>
              Overview of the Gwaram Kaolin mining
              management system.
            </p>
          </div>

          <button
            onClick={() => loadAllData(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-rotate"></i>{" "}
            {loading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        <div className="cards">
          <div className="card">
            <h3>Workers</h3>
            <strong>{workers.length}</strong>
            <span>Registered workers</span>
          </div>

          <div className="card">
            <h3>Mining Sites</h3>
            <strong>{miningSites.length}</strong>
            <span>Registered mining sites</span>
          </div>

          <div className="card">
            <h3>Products</h3>
            <strong>{products.length}</strong>
            <span>Available products</span>
          </div>

          <div className="card">
            <h3>Orders</h3>
            <strong>{orders.length}</strong>
            <span>Customer orders</span>
          </div>
        </div>

        <div className="dashboard-summary">
          <h2>System Summary</h2>

          <p>
            This system supports the management of artisanal
            kaolin mining operations in Gwaram by organizing
            workers, mining sites, products, customers,
            suppliers and customer orders.
          </p>

          <div className="order-value">
            <span>Total Order Value</span>
            <strong>{formatCurrency(totalOrderAmount)}</strong>
          </div>
        </div>
      </>
    );
  }

  // =====================================================
  // WORKERS PAGE
  // =====================================================

  function renderWorkers() {
    return (
      <div className="section-box">
        <h2>Workers Management</h2>

        <form className="data-form" onSubmit={addWorker}>
          <input
            placeholder="Worker Type"
            value={workerForm.worker_type}
            onChange={(event) =>
              setWorkerForm({
                ...workerForm,
                worker_type: event.target.value,
              })
            }
            required
          />

          <input
            placeholder="Skill"
            value={workerForm.skill}
            onChange={(event) =>
              setWorkerForm({
                ...workerForm,
                skill: event.target.value,
              })
            }
            required
          />

          <select
            value={workerForm.availability}
            onChange={(event) =>
              setWorkerForm({
                ...workerForm,
                availability: event.target.value,
              })
            }
          >
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>

          <input
            type="number"
            placeholder="Daily Rate"
            value={workerForm.daily_rate}
            onChange={(event) =>
              setWorkerForm({
                ...workerForm,
                daily_rate: event.target.value,
              })
            }
            required
          />

          <select
            value={workerForm.site_id}
            onChange={(event) =>
              setWorkerForm({
                ...workerForm,
                site_id: event.target.value,
              })
            }
          >
            <option value="">Select Mining Site</option>

            {miningSites.map((site) => (
              <option
                key={site.site_id}
                value={site.site_id}
              >
                {site.site_name}
              </option>
            ))}
          </select>

          <button type="submit">Add Worker</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Worker Type</th>
                <th>Skill</th>
                <th>Availability</th>
                <th>Daily Rate</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {workers.length === 0 ? (
                <tr>
                  <td colSpan="6">No workers found.</td>
                </tr>
              ) : (
                workers.map((worker) => (
                  <tr key={worker.worker_id}>
                    <td>{worker.worker_id}</td>
                    <td>{worker.worker_type}</td>
                    <td>{worker.skill}</td>
                    <td>
                      <StatusBadge
                        status={worker.availability}
                      />
                    </td>
                    <td>
                      {formatCurrency(worker.daily_rate)}
                    </td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() =>
                          deleteWorker(worker.worker_id)
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // =====================================================
  // SIMPLE DATA PAGES
  // =====================================================

  function renderMiningSites() {
    return (
      <div className="section-box">
        <h2>Mining Sites</h2>

        <form className="data-form" onSubmit={addMiningSite}>
          <input
            placeholder="Site Name"
            value={siteForm.site_name}
            onChange={(event) =>
              setSiteForm({
                ...siteForm,
                site_name: event.target.value,
              })
            }
            required
          />

          <input
            placeholder="Location"
            value={siteForm.location}
            onChange={(event) =>
              setSiteForm({
                ...siteForm,
                location: event.target.value,
              })
            }
            required
          />

          <input
            placeholder="Description"
            value={siteForm.description}
            onChange={(event) =>
              setSiteForm({
                ...siteForm,
                description: event.target.value,
              })
            }
          />

          <select
            value={siteForm.status}
            onChange={(event) =>
              setSiteForm({
                ...siteForm,
                status: event.target.value,
              })
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button type="submit">Add Site</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Site Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {miningSites.map((site) => (
                <tr key={site.site_id}>
                  <td>{site.site_id}</td>
                  <td>{site.site_name}</td>
                  <td>{site.location}</td>
                  <td>
                    <StatusBadge status={site.status} />
                  </td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() =>
                        deleteMiningSite(site.site_id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderProducts() {
    return (
      <div className="section-box">
        <h2>Kaolin Products</h2>

        <form className="data-form" onSubmit={addProduct}>
          <input
            placeholder="Product Name"
            value={productForm.product_name}
            onChange={(event) =>
              setProductForm({
                ...productForm,
                product_name: event.target.value,
              })
            }
            required
          />

          <input
            placeholder="Grade"
            value={productForm.grade}
            onChange={(event) =>
              setProductForm({
                ...productForm,
                grade: event.target.value,
              })
            }
            required
          />

          <input
            type="number"
            placeholder="Quantity Available"
            value={productForm.quantity_available}
            onChange={(event) =>
              setProductForm({
                ...productForm,
                quantity_available: event.target.value,
              })
            }
            required
          />

          <select
            value={productForm.unit}
            onChange={(event) =>
              setProductForm({
                ...productForm,
                unit: event.target.value,
              })
            }
          >
            <option value="tons">Tons</option>
            <option value="kg">Kilograms</option>
            <option value="bags">Bags</option>
          </select>

          <input
            type="number"
            step="0.01"
            placeholder="Price Per Unit"
            value={productForm.price_per_unit}
            onChange={(event) =>
              setProductForm({
                ...productForm,
                price_per_unit: event.target.value,
              })
            }
            required
          />

          <button type="submit">Add Product</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Grade</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.product_id}>
                  <td>{product.product_id}</td>
                  <td>{product.product_name}</td>
                  <td>{product.grade}</td>
                  <td>
                    {formatNumber(product.quantity_available)}
                  </td>
                  <td>
                    {formatCurrency(product.price_per_unit)}
                  </td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() =>
                        deleteProduct(product.product_id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderCustomers() {
    return (
      <div className="section-box">
        <h2>Customers</h2>

        <form className="data-form" onSubmit={addCustomer}>
          <input
            placeholder="Full Name"
            value={customerForm.full_name}
            onChange={(event) =>
              setCustomerForm({
                ...customerForm,
                full_name: event.target.value,
              })
            }
            required
          />

          <input
            placeholder="Phone"
            value={customerForm.phone}
            onChange={(event) =>
              setCustomerForm({
                ...customerForm,
                phone: event.target.value,
              })
            }
            required
          />

          <input
            placeholder="Email"
            type="email"
            value={customerForm.email}
            onChange={(event) =>
              setCustomerForm({
                ...customerForm,
                email: event.target.value,
              })
            }
          />

          <input
            placeholder="Address"
            value={customerForm.address}
            onChange={(event) =>
              setCustomerForm({
                ...customerForm,
                address: event.target.value,
              })
            }
          />

          <button type="submit">Add Customer</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {customers.map((customer) => (
                <tr key={customer.customer_id}>
                  <td>{customer.customer_id}</td>
                  <td>{customer.full_name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.email || "-"}</td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() =>
                        deleteCustomer(customer.customer_id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderSuppliers() {
    return (
      <div className="section-box">
        <h2>Suppliers</h2>

        <form className="data-form" onSubmit={addSupplier}>
          <input
            placeholder="Supplier Name"
            value={supplierForm.supplier_name}
            onChange={(event) =>
              setSupplierForm({
                ...supplierForm,
                supplier_name: event.target.value,
              })
            }
            required
          />

          <input
            placeholder="Phone"
            value={supplierForm.phone}
            onChange={(event) =>
              setSupplierForm({
                ...supplierForm,
                phone: event.target.value,
              })
            }
          />

          <input
            placeholder="Email"
            type="email"
            value={supplierForm.email}
            onChange={(event) =>
              setSupplierForm({
                ...supplierForm,
                email: event.target.value,
              })
            }
          />

          <input
            placeholder="Address"
            value={supplierForm.address}
            onChange={(event) =>
              setSupplierForm({
                ...supplierForm,
                address: event.target.value,
              })
            }
          />

          <button type="submit">Add Supplier</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Supplier</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.supplier_id}>
                  <td>{supplier.supplier_id}</td>
                  <td>{supplier.supplier_name}</td>
                  <td>{supplier.phone || "-"}</td>
                  <td>{supplier.email || "-"}</td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() =>
                        deleteSupplier(supplier.supplier_id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderOrders() {
    return (
      <div className="section-box">
        <h2>Orders</h2>

        <form className="data-form" onSubmit={addOrder}>
          <select
            value={orderForm.customer_id}
            onChange={(event) =>
              setOrderForm({
                ...orderForm,
                customer_id: event.target.value,
              })
            }
            required
          >
            <option value="">Select Customer</option>

            {customers.map((customer) => (
              <option
                key={customer.customer_id}
                value={customer.customer_id}
              >
                {customer.full_name}
              </option>
            ))}
          </select>

          <select
            value={orderForm.product_id}
            onChange={(event) =>
              setOrderForm({
                ...orderForm,
                product_id: event.target.value,
              })
            }
            required
          >
            <option value="">Select Product</option>

            {products.map((product) => (
              <option
                key={product.product_id}
                value={product.product_id}
              >
                {product.product_name}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            placeholder="Quantity"
            value={orderForm.quantity}
            onChange={(event) =>
              setOrderForm({
                ...orderForm,
                quantity: event.target.value,
              })
            }
            required
          />

          <select
            value={orderForm.order_status}
            onChange={(event) =>
              setOrderForm({
                ...orderForm,
                order_status: event.target.value,
              })
            }
          >
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div className="total-display">
            Total: {formatCurrency(calculatedTotalAmount)}
          </div>

          <button type="submit">Create Order</button>
        </form>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order.order_id}>
                  <td>{order.order_id}</td>
                  <td>{order.customer_name || "-"}</td>
                  <td>{order.product_name || "-"}</td>
                  <td>{formatNumber(order.quantity)}</td>
                  <td>
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td>
                    <StatusBadge
                      status={order.order_status}
                    />
                  </td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() =>
                        deleteOrder(order.order_id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderReports() {
    const totalOrderAmount = orders.reduce(
      (sum, order) =>
        sum + Number(order.total_amount || 0),
      0
    );

    return (
      <div className="reports-box">
        <h1>System Reports</h1>

        <div className="report-cards">
          <div className="report-card">
            <h3>Total Workers</h3>
            <strong>{workers.length}</strong>
          </div>

          <div className="report-card">
            <h3>Total Mining Sites</h3>
            <strong>{miningSites.length}</strong>
          </div>

          <div className="report-card">
            <h3>Total Products</h3>
            <strong>{products.length}</strong>
          </div>

          <div className="report-card">
            <h3>Total Orders</h3>
            <strong>{orders.length}</strong>
          </div>

          <div className="report-card">
            <h3>Total Order Value</h3>
            <strong>
              {formatCurrency(totalOrderAmount)}
            </strong>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // PAGE ROUTER
  // =====================================================

  function renderPage() {
    switch (activePage) {
      case "Workers":
        return renderWorkers();

      case "Mining Sites":
        return renderMiningSites();

      case "Products":
        return renderProducts();

      case "Customers":
        return renderCustomers();

      case "Suppliers":
        return renderSuppliers();

      case "Orders":
        return renderOrders();

      case "Reports":
        return renderReports();

      default:
        return renderDashboard();
    }
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">GK</div>

          <h2>Gwaram Kaolin</h2>

          <p>
            Supply Chain and Labor Management System
          </p>
        </div>

        <nav>
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                activePage === item.name ? "active" : ""
              }`}
              onClick={() => setActivePage(item.name)}
            >
              <i className={item.icon}></i>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          © 2026 Gwaram Kaolin System
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div>
            <h2>{activePage}</h2>

            <p>
              Web-Based Supply Chain and Labor Management
              System
            </p>
          </div>

          <div className="admin-area">
            <div className="admin-avatar">
              {currentUser?.full_name
                ? currentUser.full_name
                    .charAt(0)
                    .toUpperCase()
                : "A"}
            </div>

            <div>
              <strong>
                {currentUser?.full_name || "Administrator"}
              </strong>

              <small>
                {currentUser?.role || "admin"}
              </small>
            </div>

            <button
              className="logout-btn"
              onClick={handleLogout}
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              {" "}Logout
            </button>
          </div>
        </header>

        {message && (
          <div
            className={
              messageType === "error"
                ? "message error-message"
                : "message success-message"
            }
          >
            {message}
          </div>
        )}

        <div className="page-content">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;