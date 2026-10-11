<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AlertTriangle,
  Bell,
  Bike,
  Box,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileChartColumnIncreasing,
  Home,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  Warehouse,
  X,
} from "@lucide/vue";
import api from "./services/api";

const route = useRoute();
const router = useRouter();
const mobileMenuOpen = ref(false);
const authLoading = ref(false);
const authError = ref("");
const currentUser = ref(readStoredUser());
const authToken = ref(sessionStorage.getItem("auth_token"));
const authForm = ref({
  email: "admin@motoparts.test",
  password: "password123",
});
const search = ref("");
const selectedCategory = ref("All categories");
const selectedStatus = ref("All status");
const dashboard = ref({
  total_products: 0,
  low_stock: 0,
  out_of_stock: 0,
  todays_sales: 0,
  transaction_count: 0,
  recent: [],
});
const cashReceived = ref(0);
const operationError = ref("");
const operationMessage = ref("");
const stockForm = ref({ product_id: "", quantity: 1, reason: "", reference: "" });
const staffSearch = ref("");
const showStaffModal = ref(false);
const newStaff = ref({ name: "", email: "", password: "", role: "staff" });
const notifications = ref([]);
const stockMovements = ref([]);
const activeRole = computed(() => currentUser.value?.role || "admin");
const isAuthenticated = computed(() => Boolean(authToken.value));

const products = ref([
  {
    id: 1,
    sku: "SPK-001",
    name: "Spark Plug",
    brand: "Honda",
    category: "Engine Parts",
    price: 150,
    quantity: 25,
    reorder_level: 10,
  },
  {
    id: 2,
    sku: "BRK-014",
    name: "Brake Pad",
    brand: "Honda",
    category: "Brake Parts",
    price: 420,
    quantity: 8,
    reorder_level: 10,
  },
  {
    id: 3,
    sku: "OIL-008",
    name: "Oil Filter",
    brand: "Yamaha",
    category: "Engine Parts",
    price: 280,
    quantity: 0,
    reorder_level: 8,
  },
  {
    id: 4,
    sku: "CVR-022",
    name: "Motorcycle Cover",
    brand: "Yamaha",
    category: "Accessories",
    price: 1500,
    quantity: 15,
    reorder_level: 5,
  },
]);
const transactions = ref([
  {
    id: "TRX-0023",
    date: "September 27, 2026",
    items: 3,
    total: 1500,
    payment: "Cash",
  },
  {
    id: "TRX-0022",
    date: "September 27, 2026",
    items: 1,
    total: 550,
    payment: "GCash",
  },
  {
    id: "TRX-0021",
    date: "September 27, 2026",
    items: 3,
    total: 1890,
    payment: "Cash",
  },
  {
    id: "TRX-0020",
    date: "September 27, 2026",
    items: 2,
    total: 670,
    payment: "Cash",
  },
  {
    id: "TRX-0019",
    date: "September 26, 2026",
    items: 4,
    total: 2550,
    payment: "GCash",
  },
]);
const staff = ref([
  {
    id: 1,
    name: "Juan Dela Cruz",
    username: "juan123",
    role: "Manager",
    status: "Active",
  },
  {
    id: 2,
    name: "Jang Wonyoung",
    username: "luckyvicky",
    role: "Staff",
    status: "Active",
  },
  {
    id: 3,
    name: "Luisa Marie Yano",
    username: "skrrtskrrt",
    role: "Staff",
    status: "Inactive",
  },
  {
    id: 4,
    name: "Joe Honey Bee",
    username: "thankyouso-",
    role: "Staff",
    status: "Inactive",
  },
]);
const cart = ref([]);
const showProductModal = ref(false);
const editingProductId = ref(null);
const newProduct = ref({
  name: "",
  sku: "",
  brand: "",
  category: "Engine Parts",
  price: 0,
  quantity: 0,
});

const navItems = computed(() =>
  activeRole.value === "staff"
    ? [
        { label: "Dashboard", path: "/", icon: Home },
        { label: "Point of Sale", path: "/pos", icon: ShoppingBag },
        { label: "Inventory", path: "/inventory", icon: Warehouse },
        { label: "Transactions", path: "/sales", icon: CircleDollarSign },
        { label: "Notifications", path: "/notifications", icon: Bell },
      ]
    : [
        { label: "Dashboard", path: "/", icon: Home },
        { label: "Products", path: "/products", icon: Settings2 },
        { label: "Inventory", path: "/inventory", icon: Warehouse },
        { label: "Stock In", path: "/stock-in", icon: Box },
        {
          label: "Adjust Stock",
          path: "/adjust-stock",
          icon: SlidersHorizontal,
        },
        { label: "Sales", path: "/sales", icon: CircleDollarSign },
        {
          label: "Reports & Monitoring",
          path: "/reports",
          icon: FileChartColumnIncreasing,
        },
        { label: "Manage Staff", path: "/users", icon: Users },
        { label: "Notifications", path: "/notifications", icon: Bell },
      ],
);
const routeName = computed(() =>
  route.path === "/"
    ? "Dashboard"
    : navItems.value.find(
        (item) => route.path.startsWith(item.path) && item.path !== "/",
      )?.label || "Dashboard",
);
const filteredProducts = computed(() =>
  products.value.filter((product) => {
    const matchesSearch = `${product.name} ${product.category} ${product.sku}`
      .toLowerCase()
      .includes(search.value.toLowerCase());
    const matchesCategory =
      selectedCategory.value === "All categories" ||
      product.category === selectedCategory.value;
    const matchesStatus =
      selectedStatus.value === "All status" ||
      statusFor(product) === selectedStatus.value;
    return matchesSearch && matchesCategory && matchesStatus;
  }),
);
const inventoryStats = computed(() => ({
  total: products.value.length,
  low: products.value.filter(
    (item) => item.quantity > 0 && item.quantity <= item.reorder_level,
  ).length,
  out: products.value.filter((item) => item.quantity === 0).length,
}));
const cartTotal = computed(() =>
  cart.value.reduce((sum, item) => sum + item.price * item.cartQuantity, 0),
);

onMounted(async () => {
  if (!isAuthenticated.value) return;
  await refreshData();
});
async function refreshData() {
  try {
    const [productResponse, salesResponse, dashboardResponse, movementResponse] = await Promise.all([
      api.get("/products"),
      api.get("/sales"),
      api.get("/dashboard/summary"),
      api.get("/stock-movements"),
    ]);
    products.value = (productResponse.data.data || []).map((item) => ({
      ...item,
      category: item.category?.name || "Uncategorized",
      brand: item.brand || "Motorcycle",
    }));
    transactions.value = (salesResponse.data.data || []).map((sale) => ({
      ...sale,
      id: sale.transaction_number,
      date: new Date(`${sale.sold_at}Z`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      items: sale.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      total: sale.total_amount,
      payment: sale.payment_method,
    }));
    dashboard.value = dashboardResponse.data.data;
    stockMovements.value = movementResponse.data.data || [];
    if (activeRole.value === "admin") {
      const [usersResponse, notificationsResponse] = await Promise.all([
        api.get("/users"),
        api.get("/notifications"),
      ]);
      staff.value = usersResponse.data.data.map((user) => ({
        ...user,
        username: user.email,
        status: user.is_active ? "Active" : "Inactive",
        role: user.role === "admin" ? "Admin" : "Staff",
      }));
      notifications.value = notificationsResponse.data.data;
    } else {
      const notificationsResponse = await api.get("/notifications");
      notifications.value = notificationsResponse.data.data;
    }
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to load data.";
  }
}
async function submitStockMovement() {
    operationError.value = "";
    const quantity = Number(stockForm.value.quantity);
    if (!stockForm.value.product_id || !Number.isInteger(quantity) || quantity < 1)
      return (operationError.value = "Select a product and enter a positive quantity.");
    if (route.path === "/adjust-stock" && !stockForm.value.reason.trim())
      return (operationError.value = "An adjustment reason is required.");
    try {
      await api.post(
        route.path === "/stock-in" ? "/stock-movements" : "/stock-out",
        route.path === "/stock-in"
          ? {
              product_id: Number(stockForm.value.product_id),
              quantity,
              reference: stockForm.value.reference || "STOCK-IN",
              notes: stockForm.value.reason || "Inventory stock-in",
            }
          : {
              product_id: Number(stockForm.value.product_id),
              quantity,
              reason: stockForm.value.reason,
            },
      );
      stockForm.value = { product_id: "", quantity: 1, reason: "", reference: "" };
      await refreshData();
    } catch (error) {
      operationError.value = error.response?.data?.message || "Unable to save inventory movement.";
    }
}
async function submitStaff() {
    operationError.value = "";
    try {
      await api.post("/users", newStaff.value);
      newStaff.value = { name: "", email: "", password: "", role: "staff" };
      showStaffModal.value = false;
      await refreshData();
    } catch (error) {
      operationError.value = error.response?.data?.message || "Unable to create staff account.";
    }
}
async function markNotificationRead(notification) {
    await api.patch(`/notifications/${notification.id}/read`);
    notification.is_read = true;
}
async function markAllNotificationsRead() {
    await api.post("/notifications/read-all");
    notifications.value.forEach((notification) => (notification.is_read = true));
}

function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("auth_user") || "null");
  } catch {
    return null;
  }
}
function statusFor(product) {
  return product.quantity === 0
    ? "Out of Stock"
    : product.quantity <= product.reorder_level
      ? "Low Stock"
      : "In Stock";
}
function money(value) {
  return `P${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}
function navigate(path) {
  mobileMenuOpen.value = false;
  router.push(path);
}
function addToCart(product) {
  if (!product.quantity) return;
  const existing = cart.value.find((item) => item.id === product.id);
  if (existing) existing.cartQuantity += 1;
  else cart.value.push({ ...product, cartQuantity: 1 });
}
function removeFromCart(product) {
  cart.value = cart.value.filter((item) => item.id !== product.id);
}
async function archiveProduct(product) {
  if (!window.confirm(`Archive ${product.name}?`)) return;
  try {
    await api.delete(`/products/${product.id}`);
    await refreshData();
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to archive product.";
  }
}
async function submitProduct() {
  operationError.value = "";
  operationMessage.value = "";
  try {
    const isEditing = Boolean(editingProductId.value);
    const categories = await api.get("/categories");
    const category = categories.data.data.find((item) => item.name === newProduct.value.category);
    const payload = {
      ...newProduct.value,
      category_id: category?.id,
      reorder_level: 5,
      cost_price: 0,
    };
    const { data } = editingProductId.value
      ? await api.put(`/products/${editingProductId.value}`, payload)
      : await api.post("/products", payload);
    const saved = {
      ...data.data,
      category: data.data.category?.name || newProduct.value.category,
      brand: data.data.brand || "Motorcycle",
    };
    if (editingProductId.value) {
      const index = products.value.findIndex((item) => item.id === editingProductId.value);
      if (index >= 0) products.value[index] = saved;
    } else products.value.unshift(saved);
    newProduct.value = { name: "", sku: "", brand: "", category: "Engine Parts", price: 0, quantity: 0 };
    editingProductId.value = null;
    showProductModal.value = false;
    operationMessage.value = `Product ${isEditing ? "updated" : "saved"} successfully.`;
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to save product.";
  }
  function editProduct(product) {
    editingProductId.value = product.id;
    newProduct.value = {
      name: product.name,
      sku: product.sku,
      brand: product.brand || "",
      category: product.category?.name || product.category || "Engine Parts",
      price: product.price,
      quantity: product.quantity,
    };
    showProductModal.value = true;
  }
}
async function completeSale() {
  operationError.value = "";
  if (!cart.value.length || Number(cashReceived.value) < cartTotal.value) {
    operationError.value = "Enter enough cash to complete this sale.";
    return;
  }
  try {
    await api.post("/sales", {
      items: cart.value.map((item) => ({ product_id: item.id, quantity: item.cartQuantity })),
      payment_amount: Number(cashReceived.value),
      payment_method: "cash",
    });
    cart.value = [];
    cashReceived.value = 0;
    await refreshData();
    navigate("/sales");
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to complete sale.";
    await refreshData();
  }
}
async function submitLogin() {
  authLoading.value = true;
  authError.value = "";
  try {
    const { data } = await api.post("/auth/login", authForm.value);
    sessionStorage.setItem("auth_token", data.token);
    sessionStorage.setItem("auth_user", JSON.stringify(data.user));
    authToken.value = data.token;
    currentUser.value = data.user;
    navigate("/");
  } catch (error) {
    authError.value =
      error.response?.data?.message ||
      "Unable to sign in. Please check your email and password.";
  } finally {
    authLoading.value = false;
  }
}
async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {
    /* local logout still clears the session */
  }
  sessionStorage.clear();
  authToken.value = null;
  currentUser.value = null;
  navigate("/login");
}
</script>

<template>
  <div v-if="!isAuthenticated || route.path === '/login'" class="auth-screen">
    <div class="auth-brand-panel">
      <div class="brand-lockup auth-lockup">
        <span class="brand-symbol"><Bike :size="24" /></span
        ><strong>BSZ Tarluck</strong>
      </div>

      <div class="auth-illustration">
        <Bike :size="88" stroke-width="1.1" />
      </div>
      <h2>Motorcycle Parts Inventory<br />and Sales Management System</h2>
    </div>
    <div class="auth-form-panel">
      <div class="auth-card">
        <h1>Welcome Back!</h1>
        <p>Sign in to your account</p>
        <form @submit.prevent="submitLogin">
          <label class="input-with-icon"
            ><UserRound :size="23" /><input
              v-model="authForm.email"
              type="email"
              placeholder="Username"
              required /></label
          ><label class="input-with-icon"
            ><span class="lock-icon">▣</span
            ><input
              v-model="authForm.password"
              type="password"
              placeholder="Password"
              required /></label
          ><a class="forgot-link" href="#" @click.prevent>Forgot password?</a>
          <p v-if="authError" class="auth-error">{{ authError }}</p>
          <button class="button primary wide" :disabled="authLoading">
            {{ authLoading ? "Signing in..." : "Login" }}
          </button>
        </form>
        <small class="demo-note"
          >Demo: admin@motoparts.test / password123</small
        >
      </div>
      <small class="copyright">2026 BSZ Tarluck. All rights reserved</small>
    </div>
  </div>

  <div v-else class="dashboard-shell">
    <aside class="sidebar" :class="{ open: mobileMenuOpen }">
      <div class="brand-lockup sidebar-brand">
        <span class="brand-symbol"><Bike :size="23" /></span
        ><strong>BSZ Tarluck</strong>
      </div>
      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="sidebar-item"
          :class="{
            active:
              route.path === item.path ||
              (item.path !== '/' && route.path.startsWith(item.path)),
          }"
          @click="navigate(item.path)"
        >
          <component :is="item.icon" :size="20" /><span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <button class="sidebar-item profile-item">
          <span class="mini-logo"><Bike :size="13" /></span
          ><span>{{
            currentUser?.name ||
            (activeRole === "staff" ? "Juan Dela Cruz" : "Admin")
          }}</span></button
        ><button class="sidebar-item" @click="logout">
          <LogOut :size="20" /><span>Log out</span>
        </button>
      </div>
    </aside>
    <main class="main-area">
      <header class="topbar">
        <button class="mobile-toggle" @click="mobileMenuOpen = !mobileMenuOpen">
          <Menu :size="22" />
        </button>
        <div class="topbar-spacer"></div>
        <button class="top-icon" @click="navigate('/notifications')"><Bell :size="19" /><b v-if="notifications.filter((item) => !item.is_read).length" class="notification-badge">{{ notifications.filter((item) => !item.is_read).length }}</b></button
        ><button class="top-user" @click="logout">
          <span class="mini-logo"><Bike :size="13" /></span
          ><b>{{ activeRole === "staff" ? "Staff" : "Admin" }}</b
          ><ChevronDown :size="15" />
        </button>
      </header>
      <div class="content-wrap">
        <div class="page-title-row">
          <div>
            <h1>{{ routeName }}</h1>
            <div class="breadcrumbs">
              <span>{{ activeRole === "staff" ? "Staff" : "Admin" }}</span
              ><span>/</span><b>{{ routeName }}</b>
            </div>
          </div>
          <button
            v-if="route.path === '/'"
            class="button primary"
            @click="navigate('/pos')"
          >
            <ShoppingCart :size="17" /> Point of Sale
          </button>
        </div>
        <section v-if="route.path === '/'" class="page-view">
          <div class="metric-grid">
            <article class="metric-card">
              <span class="metric-icon blue"><Settings2 :size="22" /></span>
              <div>
                <small>Total Products</small
                ><strong>{{ dashboard.total_products }}</strong>
              </div>
            </article>
            <article class="metric-card">
              <span class="metric-icon yellow"
                ><AlertTriangle :size="22"
              /></span>
              <div>
                <small>Low Stock</small
                ><strong>{{ dashboard.low_stock }}</strong>
              </div>
            </article>
            <article class="metric-card">
              <span class="metric-icon red"><X :size="23" /></span>
              <div>
                <small>Out of Stock</small
                ><strong>{{ dashboard.out_of_stock }}</strong>
              </div>
            </article>
            <article class="metric-card">
              <span class="metric-icon green"
                ><CircleDollarSign :size="22"
              /></span>
              <div>
                <small>Today's Sales</small><strong>{{ money(dashboard.todays_sales) }}</strong>
              </div>
            </article>
          </div>
          <div class="dashboard-grid">
            <section class="white-panel chart-panel">
              <div class="panel-title">
                <h2>Sales Overview</h2>
                <select>
                  <option>Last 7 Days</option>
                </select>
              </div>
              <div class="bar-chart">
                <span
                  v-for="height in [42, 51, 70, 58, 36, 77, 48]"
                  :key="height"
                  :style="{ height: `${height}%` }"
                ></span>
              </div>
              <div class="chart-labels">
                <span>Sep 15</span><span>Sep 16</span><span>Sep 17</span
                ><span>Sep 18</span><span>Sep 19</span><span>Sep 20</span
                ><span>Sep 21</span>
              </div>
            </section>
            <section class="white-panel">
              <div class="panel-title">
                <h2>Recent Transactions</h2>
                <button class="text-button" @click="navigate('/sales')">
                  View All
                </button>
              </div>
              <div class="mini-table">
                <div class="mini-table-head">
                  <span>Date</span><span>Transaction #</span><span>Total</span>
                </div>
                <div
                  v-for="transaction in transactions.slice(0, 5)"
                  :key="transaction.id"
                  class="mini-table-row"
                >
                  <span>{{ transaction.date }}</span
                  ><span>{{ transaction.id }}</span
                  ><b>{{ money(transaction.total) }}</b>
                </div>
              </div>
            </section>
          </div>
          <div class="alert-strip">
            <AlertTriangle :size="28" />
            <div>
              <b>Stock Alert</b
              ><span
                >{{ dashboard.out_of_stock }} products are out of stock,
                {{ dashboard.low_stock }} products are running low on
                stock.</span
              >
            </div>
            <button class="text-button" @click="navigate('/inventory')">
              View All
            </button>
          </div>
        </section>

        <section
          v-else-if="route.path === '/products' || route.path === '/inventory'"
          class="page-view"
        >
          <div class="white-panel table-panel">
            <div class="toolbar">
              <label class="search-field"
                ><Search :size="18" /><input
                  v-model="search"
                  placeholder="Search product..." /></label
              ><select v-model="selectedCategory">
                <option>All categories</option>
                <option>Engine Parts</option>
                <option>Brake Parts</option>
                <option>Electrical</option>
                <option>Tires</option>
                <option>Accessories</option></select
              ><select v-model="selectedStatus">
                <option>All status</option>
                <option>In Stock</option>
                <option>Low Stock</option>
                <option>Out of Stock</option></select
              ><button
                v-if="route.path === '/products'"
                class="button primary"
                @click="editingProductId = null; newProduct = { name: '', sku: '', brand: '', category: 'Engine Parts', price: 0, quantity: 0 }; showProductModal = true"
              >
                <Plus :size="18" /> Add Product
              </button>
            </div>
            <p v-if="operationMessage" class="success-message">{{ operationMessage }}</p>
            <p v-if="operationError" class="auth-error">{{ operationError }}</p>
            <div class="data-table">
              <div class="data-head">
                <span>Product</span><span>Name</span><span>Category</span
                ><span>Price</span><span>Stock</span><span>Status</span
                ><span v-if="route.path === '/products'">Actions</span>
              </div>
              <div
                v-for="product in filteredProducts"
                :key="product.id"
                class="data-row"
              >
                <span class="product-thumb"><Bike :size="24" /></span
                ><span
                  ><b>{{ product.name }}</b
                  ><em>{{ product.brand }}</em></span
                ><span>{{ product.category }}</span
                ><span>{{ money(product.price) }}</span
                ><span>{{ product.quantity }}</span
                ><span
                  ><strong
                    class="status"
                    :class="
                      statusFor(product).toLowerCase().replaceAll(' ', '-')
                    "
                    >{{ statusFor(product) }}</strong
                  ></span
                ><span v-if="route.path === '/products'" class="row-actions"
                  ><button aria-label="Edit" @click="editProduct(product)"><Settings2 :size="18" /></button
                  ><button aria-label="Delete" @click="archiveProduct(product)"><Trash2 :size="17" /></button
                ></span>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="route.path === '/pos'" class="page-view pos-view">
          <div class="pos-products white-panel">
            <label class="search-field"
              ><Search :size="18" /><input
                v-model="search"
                placeholder="Search product..."
            /></label>
            <div class="category-tabs">
              <button class="selected">All</button><button>Engine</button
              ><button>Brake</button><button>Electrical</button
              ><button>Tires</button><button>Accessories</button>
            </div>
            <div class="pos-grid">
              <button
                v-for="product in filteredProducts"
                :key="product.id"
                class="pos-card"
                :disabled="!product.quantity"
                @click="addToCart(product)"
              >
                <span class="product-thumb large"><Bike :size="35" /></span
                ><b>{{ product.name }}</b
                ><small>{{ money(product.price) }}</small
                ><em :class="{ sold: !product.quantity }">{{
                  product.quantity
                    ? `${product.quantity} in stock`
                    : "Out of Stock"
                }}</em>
              </button>
            </div>
          </div>
          <aside class="cart-panel white-panel">
            <div class="panel-title">
              <h2>Current Sale ({{ cart.length }})</h2>
              <button class="text-button">View All</button>
            </div>
            <div v-for="item in cart" :key="item.id" class="cart-item">
              <span class="product-thumb"><Bike :size="22" /></span>
              <div>
                <b>{{ item.name }}</b
                ><small
                  >{{ item.cartQuantity }} x {{ money(item.price) }}</small
                >
              </div>
              <strong>{{ money(item.cartQuantity * item.price) }}</strong
              ><button @click="removeFromCart(item)">
                <Trash2 :size="16" />
              </button>
            </div>
            <div class="cart-bottom">
              <div>
                <b>Total</b><strong>{{ money(cartTotal) }}</strong>
              </div>
              <label>Cash received<input v-model.number="cashReceived" type="number" min="0" /></label>
              <p v-if="operationError" class="auth-error">{{ operationError }}</p>
              <button class="button outline" @click="cart = []">Cancel</button
              ><button class="button primary" @click="completeSale">
                Checkout
              </button>
            </div>
          </aside>
        </section>

        <section v-else-if="route.path === '/sales'" class="page-view">
          <div class="white-panel table-panel">
            <div class="toolbar">
              <label class="date-field"
                ><CalendarDays :size="17" /> 09/01/2026
                <span>-</span> 10/01/2026</label
              ><label class="search-field compact"
                ><Search :size="18" /><input
                  placeholder="Search transaction..." /></label
              ><button class="button outline">
                <SlidersHorizontal :size="17" /> Filter
              </button>
            </div>
            <p v-if="operationMessage" class="success-message">{{ operationMessage }}</p>
            <p v-if="operationError" class="auth-error">{{ operationError }}</p>
            <div class="data-table transaction-table">
              <div class="data-head">
                <span>Date</span><span>Transaction #</span><span>Items</span
                ><span>Total</span><span>Payment Method</span>
              </div>
              <div
                v-for="transaction in transactions"
                :key="transaction.id"
                class="data-row"
              >
                <span>{{ transaction.date }}</span
                ><span>{{ transaction.id }}</span
                ><span>{{ transaction.items }}</span
                ><b>{{ money(transaction.total) }}</b
                ><span>{{ transaction.payment }}</span>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="route.path === '/reports'" class="page-view">
          <div class="report-date">September 27, 2026</div>
          <div class="metric-grid three">
            <article class="metric-card">
              <span class="metric-icon blue"><Settings2 :size="22" /></span>
              <div><small>Products Sold</small><strong>{{ dashboard.recent.reduce((sum, sale) => sum + (sale.items?.reduce((items, item) => items + item.quantity, 0) || 0), 0) }}</strong></div>
            </article>
            <article class="metric-card">
              <span class="metric-icon yellow"
                ><ClipboardList :size="22"
              /></span>
              <div><small>Transactions</small><strong>{{ dashboard.transaction_count }}</strong></div>
            </article>
            <article class="metric-card">
              <span class="metric-icon green"
                ><CircleDollarSign :size="22"
              /></span>
              <div>
                <small>Today's Sales</small><strong>{{ money(dashboard.todays_sales) }}</strong>
              </div>
            </article>
          </div>
          <div class="dashboard-grid reports-grid">
            <section class="white-panel chart-panel">
              <div class="panel-title">
                <h2>Sales Report</h2>
                <span class="date-chip">09/15/2026 - 09/21/2026</span>
              </div>
              <div class="bar-chart tall">
                <span
                  v-for="height in [42, 54, 76, 61, 35, 79, 48]"
                  :key="height"
                  :style="{ height: `${height}%` }"
                ></span>
              </div>
            </section>
            <section class="white-panel inventory-status">
              <div class="panel-title"><h2>Inventory Status</h2></div>
              <div class="donut"></div>
              <div class="legend">
                <span><i class="green-dot"></i>In Stock <b>80%</b></span
                ><span><i class="yellow-dot"></i>Low Stock <b>15%</b></span
                ><span><i class="red-dot"></i>Out of Stock <b>5%</b></span>
              </div>
            </section>
          </div>
        </section>

        <section v-else-if="route.path === '/users'" class="page-view">
          <div class="white-panel table-panel">
            <div class="toolbar">
              <label class="search-field"
                ><Search :size="18" /><input
                  v-model="staffSearch"
                  placeholder="Search staff..." /></label
              ><button class="button primary" @click="showStaffModal = true">
                <Plus :size="18" /> Add Staff
              </button>
            </div>
            <div class="data-table staff-table">
              <div class="data-head">
                <span>Name</span><span>Username</span><span>Role</span
                ><span>Status</span><span>Actions</span>
              </div>
              <div v-for="person in staff.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(staffSearch.toLowerCase()))" :key="person.id" class="data-row">
                <span>{{ person.name }}</span
                ><span>{{ person.username }}</span
                ><span>{{ person.role }}</span
                ><strong class="status" :class="person.status.toLowerCase()">{{
                  person.status
                }}</strong
                ><span class="row-actions"
                  ><button><Settings2 :size="18" /></button
                  ><button><Trash2 :size="17" /></button
                ></span>
              </div>
            </div>
          </div>
        </section>

        <section
          v-else-if="
            route.path === '/stock-in' || route.path === '/adjust-stock'
          "
          class="page-view"
        >
          <div class="white-panel form-panel">
            <div class="form-fields">
              <label
                >Product*<select v-model="stockForm.product_id">
                  <option value="">Select product...</option>
                  <option v-for="product in products" :key="product.id" :value="product.id">
                    {{ product.name }}
                  </option>
                </select></label
              ><label v-if="route.path === '/stock-in'"
                >Supplier*<select>
                  <option>Select supplier...</option>
                  <option>ABC Parts</option>
                  <option>MotoSupplies</option>
                </select></label
              ><label>Quantity<input v-model.number="stockForm.quantity" type="number" min="1" /></label
              ><label v-if="route.path === '/adjust-stock'"
                >Adjustment Type*<select>
                  <option>Damage / Loss</option>
                  <option>Stock correction</option>
                </select></label
              ><label
                >Reason<textarea v-model="stockForm.reason" placeholder="Operational notes..."></textarea>
              </label>
              <label v-if="route.path === '/stock-in'">Reference<input v-model="stockForm.reference" placeholder="Supplier invoice or reference" /></label>
              <p v-if="operationError" class="auth-error">{{ operationError }}</p>
              <div class="form-actions">
                <button class="button outline" @click="stockForm = { product_id: '', quantity: 1, reason: '', reference: '' }">Cancel</button
                ><button class="button primary" @click="submitStockMovement">
                  Save
                  {{ route.path === "/stock-in" ? "Stock In" : "Adjustment" }}
                </button>
              </div>
            </div>
            <div class="white-panel helper-panel">
              <h2>
                {{
                  route.path === "/stock-in"
                    ? "Recent Stock In"
                    : "Adjustment History"
                }}
              </h2>
              <p>
                Review inventory activity and keep your stock records accurate.
              </p>
              <div class="movement-list">
                <div v-for="movement in stockMovements.slice(0, 5)" :key="movement.id">
                  <b>{{ movement.product?.name }}</b>
                  <span>{{ movement.type }}: {{ movement.quantity }} unit(s)</span>
                </div>
                <small v-if="!stockMovements.length">No inventory movements yet.</small>
              </div>
            </div>
          </div>
        </section>

        <section v-else class="page-view">
          <div class="white-panel notification-panel">
            <div class="notification-tabs">
              <button class="active">Alerts</button
              ><button>Announcements</button
              ><button class="text-button" @click="markAllNotificationsRead">Mark all as read</button>
            </div>
            <div
              v-for="notification in notifications"
              :key="notification.id"
              class="notification-row"
              :class="{ 'unread': !notification.is_read }"
              @click="markNotificationRead(notification)"
            >
              <span
                class="metric-icon"
                :class="notification.type === 'inventory' ? 'yellow' : 'blue'"
                ><AlertTriangle :size="21"
              /></span>
              <div>
                <b>{{ notification.title }}</b><small>{{ notification.message }}</small>
              </div>
              <span>{{ new Date(`${notification.created_at}Z`).toLocaleString() }}</span><Trash2 :size="15" />
            </div>
            <p v-if="!notifications.length">No notifications yet.</p>
          </div>
        </section>
      </div>
    </main>
  </div>

  <div
    v-if="showProductModal"
    class="modal-backdrop"
    @click.self="showProductModal = false"
  >
    <div class="modal">
      <button class="modal-close" @click="showProductModal = false">
        <X :size="18" />
      </button>
      <h2>{{ editingProductId ? "Edit Product" : "Add Product" }}</h2>
      <label
        >Product name<input
          v-model="newProduct.name"
          placeholder="e.g. Clutch cable" /></label
      ><label
        >SKU<input v-model="newProduct.sku" placeholder="e.g. CLT-001" required /></label
      ><label
        >Brand<input v-model="newProduct.brand" placeholder="e.g. Honda" /></label
      ><label
        >Category<select v-model="newProduct.category">
          <option>Engine Parts</option>
          <option>Brake Parts</option>
          <option>Electrical</option>
          <option>Tires</option>
          <option>Accessories</option>
        </select></label
      >
      <div class="modal-grid">
        <label
          >Price<input v-model.number="newProduct.price" type="number" /></label
        ><label
          >Quantity<input v-model.number="newProduct.quantity" type="number"
        /></label>
      </div>
      <button class="button primary wide" @click="submitProduct">
        {{ editingProductId ? "Update Product" : "Save Product" }}
      </button>
    </div>
  </div>

  <div v-if="showStaffModal" class="modal-backdrop" @click.self="showStaffModal = false">
    <div class="modal">
      <button class="modal-close" @click="showStaffModal = false"><X :size="18" /></button>
      <h2>Add Staff</h2>
      <label>Name<input v-model="newStaff.name" required /></label>
      <label>Email<input v-model="newStaff.email" type="email" required /></label>
      <label>Password<input v-model="newStaff.password" type="password" minlength="8" required /></label>
      <label>Role<select v-model="newStaff.role"><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
      <p v-if="operationError" class="auth-error">{{ operationError }}</p>
      <button class="button primary wide" @click="submitStaff">Save Staff</button>
    </div>
  </div>
</template>
