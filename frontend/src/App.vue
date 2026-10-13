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
const loading = ref(false);
const categories = ref([]);
const suppliers = ref([]);
const stockForm = ref({ product_id: "", quantity: 1, reason: "", reference: "", supplier_id: "" });
const paymentMethod = ref("cash");
const lastReceipt = ref(null);
const salesSearch = ref("");
const salesFrom = ref("");
const salesTo = ref("");
const selectedSale = ref(null);
const notificationTab = ref("alerts");
const staffSearch = ref("");
const showStaffModal = ref(false);
const newStaff = ref({ name: "", email: "", password: "", role: "staff" });
const notifications = ref([]);
const stockMovements = ref([]);
const viewedProfile = ref(null);
const showProfileEdit = ref(false);
const profileForm = ref({ name: "", email: "", password: "" });
const activeRole = computed(() => currentUser.value?.role || "admin");
const isAuthenticated = computed(() => Boolean(authToken.value));

const products = ref([]);
const transactions = ref([]);
const staff = ref([]);
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

const filteredTransactions = computed(() => transactions.value.filter((sale) => {
  const text = `${sale.id} ${sale.payment}`.toLowerCase();
  return text.includes(salesSearch.value.toLowerCase()) && (!salesFrom.value || sale.rawDate >= salesFrom.value) && (!salesTo.value || sale.rawDate <= salesTo.value);
}));
const visibleNotifications = computed(() => notifications.value.filter((item) => notificationTab.value === "alerts" ? item.type !== "announcement" : item.type === "announcement"));
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
    : route.path === "/profile" || route.path.includes("/profile")
      ? "Profile"
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
  if (route.path === "/profile") viewedProfile.value = currentUser.value;
  await refreshData();
});
async function refreshData() {
  loading.value = true;
  operationError.value = "";
  try {
    const [productResponse, salesResponse, dashboardResponse, movementResponse, categoryResponse, supplierResponse] = await Promise.all([
      api.get("/products"),
      api.get("/sales"),
      api.get("/dashboard/summary"),
      api.get("/stock-movements"),
      api.get("/categories"),
      api.get("/suppliers"),
    ]);
    products.value = (productResponse.data.data || []).map((item) => ({
      ...item,
      category: item.category?.name || "Uncategorized",
      brand: item.brand || "Motorcycle",
    }));
    transactions.value = (salesResponse.data.data || []).map((sale) => ({
      ...sale,
      saleId: sale.id,
      id: sale.transaction_number,
      date: new Date(`${sale.sold_at}Z`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      items: sale.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      total: sale.total_amount,
      payment: sale.payment_method,
      rawDate: sale.sold_at?.slice(0, 10) || "",
    }));
    dashboard.value = dashboardResponse.data.data;
    stockMovements.value = movementResponse.data.data || [];
    categories.value = categoryResponse.data.data || [];
    suppliers.value = supplierResponse.data.data || [];
    if (activeRole.value === "admin") {
      const usersResponse = await api.get("/users");
      staff.value = usersResponse.data.data.map((user) => ({
        ...user,
        username: user.email,
        status: user.is_active ? "Active" : "Inactive",
        role: user.role === "admin" ? "Admin" : "Staff",
      }));
    }
    await loadNotifications();
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to load data.";
    await loadNotifications();
  } finally {
    loading.value = false;
  }
}
async function loadNotifications() {
  try {
    const notificationsResponse = await api.get("/notifications");
    notifications.value = notificationsResponse.data.data;
  } catch (error) {
    operationError.value =
      error.response?.data?.message || "Unable to load notifications.";
  }
}
async function submitStockMovement() {
    operationError.value = "";
    const quantity = Number(stockForm.value.quantity);
    if (!stockForm.value.product_id || !Number.isInteger(quantity) || quantity < 1)
      return (operationError.value = "Select a product and enter a positive quantity.");
    if (route.path === "/stock-in" && !stockForm.value.supplier_id)
      return (operationError.value = "Select a supplier.");
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
              supplier_id: Number(stockForm.value.supplier_id),
              notes: stockForm.value.reason || "Inventory stock-in",
            }
          : {
              product_id: Number(stockForm.value.product_id),
              quantity,
              reason: stockForm.value.reason,
            },
      );
      stockForm.value = { product_id: "", quantity: 1, reason: "", reference: "", supplier_id: "" };
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
async function toggleStaff(person) {
  try {
    await api.put(`/users/${person.id}`, {
      name: person.name,
      email: person.email,
      role: (person.role || "staff").toLowerCase(),
      is_active: person.status !== "Active",
    });
    await refreshData();
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to update account status.";
  }
}
async function markNotificationRead(notification) {
  if (notification.is_read) return;
  try {
    await api.patch(`/notifications/${notification.id}/read`);
    notification.is_read = true;
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to update notification.";
  }
}
async function markAllNotificationsRead() {
  try {
    await api.post("/notifications/read-all");
    notifications.value.forEach((notification) => (notification.is_read = true));
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to update notifications.";
  }
}
async function deleteNotification(notification) {
try {
  await api.delete(`/notifications/${notification.id}`);
  notifications.value = notifications.value.filter((item) => item.id !== notification.id);
} catch (error) {
  operationError.value = error.response?.data?.message || "Unable to delete notification.";
}
}
async function deleteStaff(person) {
if (!window.confirm(`Delete ${person.name}'s account?`)) return;
operationError.value = "";
try {
  await api.delete(`/users/${person.id}`);
  staff.value = staff.value.filter((item) => item.id !== person.id);
  operationMessage.value = "User account deleted successfully.";
} catch (error) {
  operationError.value = error.response?.data?.message || "Unable to delete user account.";
}
}
async function openProfile(person = null) {
operationError.value = "";
if (!person || person.id === currentUser.value?.id) {
  viewedProfile.value = currentUser.value;
  navigate("/profile");
  return;
}
try {
  const { data } = await api.get(`/users/${person.id}`);
  viewedProfile.value = data.data;
  navigate(`/users/${person.id}/profile`);
} catch (error) {
  operationError.value = error.response?.data?.message || "Unable to load profile.";
}
function beginProfileEdit() {
  const profile = viewedProfile.value || currentUser.value;
  profileForm.value = { name: profile?.name || "", email: profile?.email || "", password: "" };
  showProfileEdit.value = true;
}
async function saveProfile() {
  try {
    const payload = { name: profileForm.value.name, email: profileForm.value.email, role: currentUser.value.role, is_active: true };
    if (profileForm.value.password) payload.password = profileForm.value.password;
    const response = await api.put(`/users/${currentUser.value.id}`, payload);
    currentUser.value = response.data.data;
    sessionStorage.setItem("auth_user", JSON.stringify(currentUser.value));
    viewedProfile.value = currentUser.value;
    showProfileEdit.value = false;
    operationMessage.value = "Profile updated successfully.";
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to update profile.";
  }
}
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
  if (existing && existing.cartQuantity < product.quantity) existing.cartQuantity += 1;
  else cart.value.push({ ...product, cartQuantity: 1 });
}
function changeCartQuantity(item, amount) {
  const next = item.cartQuantity + amount;
  if (next < 1) return removeFromCart(item);
  if (next <= item.quantity) item.cartQuantity = next;
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
      reorder_level: Number(newProduct.value.reorder_level || 0),
      cost_price: Number(newProduct.value.cost_price || 0),
      barcode: newProduct.value.barcode || null,
      description: newProduct.value.description || null,
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
async function completeSale() {
  operationError.value = "";
  if (!cart.value.length || (paymentMethod.value === "cash" && Number(cashReceived.value) < cartTotal.value)) {
    operationError.value = "Enter enough payment to complete this sale.";
    return;
  }
  try {
    await api.post("/sales", {
      items: cart.value.map((item) => ({ product_id: item.id, quantity: item.cartQuantity })),
      payment_amount: Number(cashReceived.value),
      payment_method: paymentMethod.value,
    });
    lastReceipt.value = data.data;
    cart.value = [];
    cashReceived.value = 0;
    await refreshData();
    navigate("/sales");
  } catch (error) {
    operationError.value = error.response?.data?.message || "Unable to complete sale.";
    await refreshData();
  }
  async function viewSale(transaction) {
    try {
      const response = await api.get(`/sales/${transaction.saleId || transaction.id}`);
      selectedSale.value = response.data.data;
    } catch (error) {
      operationError.value = error.response?.data?.message || "Unable to load transaction details.";
    }
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
        <button class="sidebar-item profile-item" @click="openProfile()">
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
        ><button class="top-user" @click="openProfile()">
          <span class="mini-logo"><Bike :size="13" /></span
          ><b>{{ activeRole === "staff" ? "Staff" : "Admin" }}</b
          ><ChevronDown :size="15" />
        </button>
      </header>
      <div class="content-wrap">
        <div v-if="loading" class="loading-state">Loading data…</div>
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
              <button :class="{ selected: selectedCategory === 'All categories' }" @click="selectedCategory = 'All categories'">All</button>
              <button v-for="category in categories" :key="category.id" :class="{ selected: selectedCategory === category.name }" @click="selectedCategory = category.name">{{ category.name }}</button>
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
              <strong>{{ money(item.cartQuantity * item.price) }}</strong>
              <button @click="changeCartQuantity(item, -1)">−</button><button @click="changeCartQuantity(item, 1)">+</button><button @click="removeFromCart(item)">
                <Trash2 :size="16" />
              </button>
            </div>
            <div class="cart-bottom">
              <div>
                <b>Total</b><strong>{{ money(cartTotal) }}</strong>
              </div>
              <label>Payment method<select v-model="paymentMethod"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option></select></label>
              <label v-if="paymentMethod === 'cash'">Cash received<input v-model.number="cashReceived" type="number" min="0" /></label>
              <p v-if="paymentMethod === 'cash' && cashReceived >= cartTotal">Change: <b>{{ money(cashReceived - cartTotal) }}</b></p>
              <p v-if="operationError" class="auth-error">{{ operationError }}</p>
              <button class="button outline" @click="cart = []">Cancel</button
              ><button class="button primary" @click="completeSale">
                Checkout
              </button>
            </div>
            <div v-if="lastReceipt" class="receipt"><b>Receipt {{ lastReceipt.transaction_number }}</b><span>Total {{ money(lastReceipt.total_amount) }}</span><span>Change {{ money(lastReceipt.change_amount) }}</span></div>
          </aside>
        </section>

        <section v-else-if="route.path === '/sales'" class="page-view">
          <div class="white-panel table-panel">
            <div class="toolbar">
              <label class="date-field"
                ><CalendarDays :size="17" /><input v-model="salesFrom" type="date" />
                <span>-</span><input v-model="salesTo" type="date" /></label
              ><label class="search-field compact"
                ><Search :size="18" /><input v-model="salesSearch" placeholder="Search transaction..." /></label>
            </div>
            <p v-if="operationMessage" class="success-message">{{ operationMessage }}</p>
            <p v-if="operationError" class="auth-error">{{ operationError }}</p>
            <div class="data-table transaction-table">
              <div class="data-head">
                <span>Date</span><span>Transaction #</span><span>Items</span
                ><span>Total</span><span>Payment Method</span>
              </div>
              <div
                v-for="transaction in filteredTransactions"
                :key="transaction.id"
                class="data-row"
              >
                <span>{{ transaction.date }}</span
                ><button class="link-button" @click="viewSale(transaction)">{{ transaction.id }}</button
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
                  ><button @click="openProfile(person)" title="View profile"><Settings2 :size="18" /></button
                  ><button @click="toggleStaff(person)" :title="person.status === 'Active' ? 'Deactivate account' : 'Activate account'"><SlidersHorizontal :size="17" /></button><button @click="deleteStaff(person)" title="Delete account"><Trash2 :size="17" /></button
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
              <div class="form-heading">
                <span class="form-heading-icon"><Box :size="20" /></span>
                <div>
                  <span class="eyebrow">{{
                    route.path === "/stock-in" ? "Inventory receiving" : "Inventory control"
                  }}</span>
                  <h2>{{
                    route.path === "/stock-in"
                      ? "Add stock to inventory"
                      : "Record a stock adjustment"
                  }}</h2>
                  <p>{{
                    route.path === "/stock-in"
                      ? "Capture incoming parts accurately so your inventory stays up to date."
                      : "Keep a clear record whenever available stock needs to be corrected."
                  }}</p>
                </div>
              </div>
              <label
                >Product*<select v-model="stockForm.product_id">
                  <option value="">Select product...</option>
                  <option v-for="product in products" :key="product.id" :value="product.id">
                    {{ product.name }}
                  </option>
                </select></label
              ><label v-if="route.path === '/stock-in'"
                >Supplier*<select v-model="stockForm.supplier_id" required>
                  <option value="">Select supplier...</option>
                  <option v-for="supplier in suppliers.filter((item) => item.is_active)" :key="supplier.id" :value="supplier.id">{{ supplier.name }}</option>
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
                <button class="button outline" @click="stockForm = { product_id: '', quantity: 1, reason: '', reference: '', supplier_id: '' }">Cancel</button
                ><button class="button primary" @click="submitStockMovement">
                  Save
                  {{ route.path === "/stock-in" ? "Stock In" : "Adjustment" }}
                </button>
              </div>
            </div>
            <div class="white-panel helper-panel">
              <div class="helper-heading">
                <span class="helper-icon"><ClipboardList :size="18" /></span>
                <span class="eyebrow">Activity log</span>
              </div>
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
                <div v-if="!stockMovements.length" class="empty-state">
                  <span class="empty-state-icon"><Box :size="20" /></span>
                  <b>No activity yet</b>
                  <small>Your recent inventory movements will appear here.</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="route.path === '/profile' || route.path.includes('/profile')" class="page-view">
          <div class="profile-layout">
            <section class="white-panel profile-card">
              <span class="profile-avatar"><UserRound :size="34" /></span>
              <h2>{{ viewedProfile?.name || currentUser?.name }}</h2>
              <strong class="profile-role">{{ viewedProfile?.role === "admin" ? "Administrator" : "Staff member" }}</strong>
              <p>{{ viewedProfile?.email || currentUser?.email }}</p>
              <span class="status active">Active</span>
            </section>
            <section class="white-panel profile-details">
              <div class="panel-title"><h2>Account details</h2><button v-if="activeRole === 'admin' && viewedProfile?.id === currentUser?.id" class="button outline" @click="beginProfileEdit">Edit profile</button></div>
              <dl>
                <div><dt>Full name</dt><dd>{{ viewedProfile?.name || currentUser?.name }}</dd></div>
                <div><dt>Email address</dt><dd>{{ viewedProfile?.email || currentUser?.email }}</dd></div>
                <div><dt>Role</dt><dd>{{ viewedProfile?.role === "admin" ? "Administrator" : "Staff" }}</dd></div>
                <div><dt>Account created</dt><dd>{{ viewedProfile?.created_at ? new Date(`${viewedProfile.created_at}Z`).toLocaleDateString() : "—" }}</dd></div>
              </dl>
              <p v-if="operationError" class="auth-error">{{ operationError }}</p>
            </section>
          </div>
        </section>
        <section v-else class="page-view">
          <div class="white-panel notification-panel">
            <div class="notification-tabs">
              <button :class="{ active: notificationTab === 'alerts' }" @click="notificationTab = 'alerts'">Alerts</button
              ><button :class="{ active: notificationTab === 'announcements' }" @click="notificationTab = 'announcements'">Announcements</button
              ><button class="text-button" @click="markAllNotificationsRead">Mark all as read</button>
            </div>
            <div
              v-for="notification in visibleNotifications"
              :key="notification.id"
              class="notification-row"
              :class="{ 'unread': !notification.is_read }"
              @click="markNotificationRead(notification)"
            >
              <span
                class="metric-icon"
                :class="
                  notification.type === 'inventory'
                    ? notification.title.toLowerCase().includes('out of stock')
                      ? 'red'
                      : 'yellow'
                    : 'blue'
                "
                ><AlertTriangle :size="21"
              /></span>
              <div>
                <b>{{ notification.title }}</b><small>{{ notification.message }}</small>
              </div>
              <span>{{ new Date(`${notification.created_at}Z`).toLocaleString() }}</span><button class="notification-delete" title="Delete notification" @click.stop="deleteNotification(notification)"><Trash2 :size="15" /></button>
            </div>
            <p v-if="operationError" class="auth-error">{{ operationError }}</p>
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
          <option v-for="category in categories" :key="category.id">{{ category.name }}</option>
        </select></label
      >
      <div class="modal-grid">
        <label
          >Price<input v-model.number="newProduct.price" type="number" /></label
        ><label>Quantity<input v-model.number="newProduct.quantity" type="number" min="0" /></label>
      </div>
      <label>Reorder level<input v-model.number="newProduct.reorder_level" type="number" min="0" /></label>
      <label>Cost price<input v-model.number="newProduct.cost_price" type="number" min="0" /></label>
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
  <div v-if="showProfileEdit" class="modal-backdrop" @click.self="showProfileEdit = false">
    <div class="modal">
      <button class="modal-close" @click="showProfileEdit = false"><X :size="18" /></button>
      <h2>Edit profile</h2>
      <label>Full name<input v-model="profileForm.name" required /></label>
      <label>Email<input v-model="profileForm.email" type="email" required /></label>
      <label>New password (optional)<input v-model="profileForm.password" type="password" minlength="8" /></label>
      <button class="button primary wide" @click="saveProfile">Save changes</button>
    </div>
  </div>
  <div v-if="selectedSale" class="modal-backdrop" @click.self="selectedSale = null">
    <div class="modal">
      <button class="modal-close" @click="selectedSale = null"><X :size="18" /></button>
      <h2>Transaction {{ selectedSale.transaction_number }}</h2>
      <p v-for="item in selectedSale.items" :key="item.id">{{ item.product?.name }} × {{ item.quantity }} — {{ money(item.line_total) }}</p>
      <hr /><b>Total {{ money(selectedSale.total_amount) }}</b>
      <p>Paid {{ money(selectedSale.payment_amount) }} · Change {{ money(selectedSale.change_amount) }}</p>
      <p>Payment: {{ selectedSale.payment_method }}</p>
    </div>
  </div>
</template>
