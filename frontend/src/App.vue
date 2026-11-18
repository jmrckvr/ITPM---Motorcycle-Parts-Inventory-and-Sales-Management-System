<script setup>
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpDown,
  ArrowUpFromLine,
  Banknote,
  Bell,
  Box,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileChartColumnIncreasing,
  FilterX,
  Home,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Power,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sun,
  Tags,
  Trash2,
  TrendingUp,
  Trophy,
  Truck,
  Upload,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Warehouse,
  X,
} from "@lucide/vue";
import OptionPicker from "./components/OptionPicker.vue";
import ProductPicker from "./components/ProductPicker.vue";
import api from "./services/api";
import bszLogo from "./assets/bsz-logo.png";

const route = useRoute();
const router = useRouter();

/* ------------------------------------------------------------------
 * Session
 * ------------------------------------------------------------------ */
const currentUser = ref(readStoredUser());
const authToken = ref(sessionStorage.getItem("auth_token"));
const isAuthenticated = computed(() => Boolean(authToken.value));
const activeRole = computed(() => currentUser.value?.role || "staff");
const isAdmin = computed(() => activeRole.value === "admin");
const authForm = ref({ email: "", password: "" });
const authLoading = ref(false);
const authError = ref("");
const showPassword = ref(false);
const showForgot = ref(false);

/* ------------------------------------------------------------------
 * Look and feel: dark mode is remembered in this browser only
 * ------------------------------------------------------------------ */
const theme = ref(readTheme());
const sidebarCollapsed = ref(readFlag("sidebar-collapsed"));
watch(sidebarCollapsed, (value) => {
  try {
    localStorage.setItem("sidebar-collapsed", value ? "1" : "0");
  } catch {
    /* storage blocked: still works for this visit */
  }
});
watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem("theme", value);
    } catch {
      /* storage blocked: the theme still works for this visit */
    }
  },
  { immediate: true },
);

/* ------------------------------------------------------------------
 * Toasts (short messages in the corner) and the confirm dialog
 * ------------------------------------------------------------------ */
const toasts = ref([]);
let toastId = 0;
function notify(message, type = "success") {
  const id = ++toastId;
  toasts.value.push({ id, message, type });
  window.setTimeout(() => dismissToast(id), type === "error" ? 4500 : 3000);
}
function dismissToast(id) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}
// Turns any API error into one readable sentence.
function apiError(error, fallback) {
  const details = error?.response?.data?.errors;
  if (details && typeof details === "object") {
    const [field, messages] = Object.entries(details)[0] || [];
    if (field && messages?.[0]) return `${field.replaceAll("_", " ")}: ${messages[0]}`;
  }
  return error?.response?.data?.message || error?.message || fallback;
}

// askConfirm() opens an in-page dialog and waits for Yes/No (replaces window.confirm).
const confirmDialog = ref(null);
function askConfirm(options) {
  return new Promise((resolve) => {
    confirmDialog.value = { confirmLabel: "Confirm", danger: false, ...options, resolve };
  });
}
function closeConfirm(answer) {
  confirmDialog.value?.resolve(answer);
  confirmDialog.value = null;
}

/* ------------------------------------------------------------------
 * Data loaded from the API
 * ------------------------------------------------------------------ */
const loading = ref(false);
const lastUpdated = ref(null);
const currentDate = ref(new Date());
let dateRefreshTimer;
const products = ref([]);
const transactions = ref([]);
const staff = ref([]);
const categories = ref([]);
const suppliers = ref([]);
const notifications = ref([]);
const stockMovements = ref([]);
const dashboard = ref(emptyDashboard());
const dashboardSales = ref([]);
const report = ref(emptyReport());
const reportFrom = ref("");
const reportTo = ref("");
const reportCategory = ref("overview");
const reportPreset = ref(null);
const reportLoading = ref(false);

/* ------------------------------------------------------------------
 * Page state (filters, forms, dialogs)
 * ------------------------------------------------------------------ */
const mobileMenuOpen = ref(false);
const search = ref("");
const selectedCategory = ref("All categories");
const selectedStatus = ref("All status");
const salesSearch = ref("");
const salesFrom = ref("");
const salesTo = ref("");
const staffSearch = ref("");
const catalogTab = ref("categories");
const catalogSearch = ref("");
const notificationTab = ref("alerts");
const quickViewId = ref(null); // product shown in the quick-view dialog

const cart = ref([]);
const cashReceived = ref(0);
const checkoutBusy = ref(false);
const receipt = ref(null); // { sale, fresh } shown in the receipt dialog

const stockForm = ref(emptyStockForm());
const adjustType = ref("Damage / Loss");
const stockSaving = ref(false);

const modalError = ref("");
const showProductModal = ref(false);
const editingProductId = ref(null);
const newProduct = ref(emptyProduct());
const showStaffModal = ref(false);
const newStaff = ref({ name: "", email: "", password: "", role: "staff" });
const revealPasswords = ref(false);
const viewedProfile = ref(null);
const showProfileEdit = ref(false);
const profileForm = ref({ name: "", email: "", password: "" });
const showResetPassword = ref(false);
const resetPasswordValue = ref("");
const catalogForm = ref(null);
const announcementForm = ref(null);

/* ------------------------------------------------------------------
 * Navigation
 * ------------------------------------------------------------------ */
const navItems = computed(() =>
  isAdmin.value
    ? [
        { label: "Dashboard", path: "/", icon: Home },
        { label: "Products", path: "/products", icon: Package },
        { label: "Inventory", path: "/inventory", icon: Warehouse },
        { label: "Stock In", path: "/stock-in", icon: Box },
        { label: "Adjust Stock", path: "/adjust-stock", icon: SlidersHorizontal },
        { label: "Catalog", path: "/catalog", icon: Tags },
        { label: "Sales", path: "/sales", icon: CircleDollarSign },
        { label: "Reports & Monitoring", path: "/reports", icon: FileChartColumnIncreasing },
        { label: "Manage Staff", path: "/users", icon: Users },
        { label: "Notifications", path: "/notifications", icon: Bell },
      ]
    : [
        { label: "Dashboard", path: "/", icon: Home },
        { label: "Point of Sale", path: "/pos", icon: ShoppingBag },
        { label: "Inventory", path: "/inventory", icon: Warehouse },
        { label: "Transactions", path: "/sales", icon: CircleDollarSign },
        { label: "Notifications", path: "/notifications", icon: Bell },
      ],
);
const routeName = computed(() => {
  if (route.path === "/") return "Dashboard";
  if (route.path === "/pos") return "Point of Sale";
  if (route.path.includes("/profile")) return "Profile";
  return navItems.value.find((item) => item.path !== "/" && route.path.startsWith(item.path))?.label || "Dashboard";
});
const unreadCount = computed(() => notifications.value.filter((item) => !item.is_read).length);
const userInitials = computed(() => initials(currentUser.value?.name));

/* ------------------------------------------------------------------
 * Derived lists
 * ------------------------------------------------------------------ */
const filteredProducts = computed(() =>
  products.value.filter((product) => {
    const text = `${product.name} ${product.category} ${product.sku} ${product.brand} ${product.barcode || ""}`.toLowerCase();
    return (
      text.includes(search.value.trim().toLowerCase()) &&
      (selectedCategory.value === "All categories" || product.category === selectedCategory.value) &&
      (selectedStatus.value === "All status" || statusFor(product) === selectedStatus.value)
    );
  }),
);
const productFiltersActive = computed(
  () => Boolean(search.value) || selectedCategory.value !== "All categories" || selectedStatus.value !== "All status",
);
const filteredTransactions = computed(() =>
  transactions.value.filter((sale) => {
    const text = `${sale.id} ${sale.payment} ${sale.cashier?.name || ""}`.toLowerCase();
    return (
      text.includes(salesSearch.value.trim().toLowerCase()) &&
      (!salesFrom.value || sale.rawDate >= salesFrom.value) &&
      (!salesTo.value || sale.rawDate <= salesTo.value)
    );
  }),
);
const salesFiltersActive = computed(() => Boolean(salesSearch.value || salesFrom.value || salesTo.value));
const filteredStaff = computed(() =>
  staff.value.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(staffSearch.value.trim().toLowerCase())),
);
const staffStats = computed(() => ({
  total: staff.value.length,
  active: staff.value.filter((person) => person.status === "Active").length,
  admins: staff.value.filter((person) => person.role === "Admin").length,
}));
const alertNotifications = computed(() => notifications.value.filter((item) => item.type !== "announcement"));
const announcementNotifications = computed(() => notifications.value.filter((item) => item.type === "announcement"));
const visibleNotifications = computed(() =>
  notificationTab.value === "alerts" ? alertNotifications.value : announcementNotifications.value,
);
const catalogItems = computed(() => {
  const term = catalogSearch.value.trim().toLowerCase();
  const list = catalogTab.value === "categories" ? categories.value : suppliers.value;
  return list.filter((item) =>
    `${item.name} ${item.description || ""} ${item.contact_person || ""} ${item.email || ""}`.toLowerCase().includes(term),
  );
});
const productCountByCategory = computed(() => {
  const counts = {};
  products.value.forEach((product) => {
    const id = product.category_id;
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
});
const activeSuppliers = computed(() => suppliers.value.filter((item) => item.is_active));
const activeCategories = computed(() => categories.value.filter((item) => item.is_active));

/* POS */
const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + Number(item.price) * item.cartQuantity, 0));
const cartUnits = computed(() => cart.value.reduce((sum, item) => sum + item.cartQuantity, 0));
const changeDue = computed(() => Number(cashReceived.value || 0) - cartTotal.value);
const canCheckout = computed(() => cart.value.length > 0 && changeDue.value >= 0 && !checkoutBusy.value);

/* Stock in / adjust */
const isStockIn = computed(() => route.path === "/stock-in");
const selectedStockProduct = computed(() => products.value.find((product) => product.id === Number(stockForm.value.product_id)));
const stockAfterSave = computed(() => {
  if (!selectedStockProduct.value) return null;
  const quantity = Number(stockForm.value.quantity) || 0;
  return selectedStockProduct.value.quantity + (isStockIn.value ? quantity : -quantity);
});
const pageMovements = computed(() =>
  stockMovements.value.filter((movement) => movement.type === (isStockIn.value ? "stock_in" : "stock_out")).slice(0, 20),
);

/* Dashboard and reports */
const dashboardChart = computed(() => {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(currentDate.value);
    date.setDate(date.getDate() - offset);
    const key = formatDateInput(date);
    const sales = dashboardSales.value.find((item) => item.date === key);
    days.push({
      key,
      label: date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      total: Number(sales?.total || 0),
    });
  }
  const max = Math.max(...days.map((day) => day.total), 1);
  return days.map((day) => ({ ...day, height: Math.max((day.total / max) * 100, day.total ? 8 : 2) }));
});
const weekTotal = computed(() => dashboardChart.value.reduce((sum, day) => sum + day.total, 0));
// Quick view: the product, plus its latest stock movements
const quickView = computed(() => products.value.find((product) => product.id === quickViewId.value) || null);
const quickViewMovements = computed(() =>
  quickViewId.value ? stockMovements.value.filter((movement) => movement.product_id === quickViewId.value).slice(0, 5) : [],
);
const productImages = computed(() => Object.fromEntries(products.value.map((product) => [product.id, product.image_data])));
const stockIssues = computed(() => Number(dashboard.value.low_stock || 0) + Number(dashboard.value.out_of_stock || 0));
const reportInventoryStatus = computed(() => ({
  healthy: report.value.inventory.filter((item) => !item.low_stock && !item.out_of_stock).length,
  low: report.value.inventory.filter((item) => item.low_stock).length,
  out: report.value.inventory.filter((item) => item.out_of_stock).length,
}));
const donutStyle = computed(() => {
  const total = report.value.inventory.length || 1;
  const healthy = (reportInventoryStatus.value.healthy / total) * 100;
  const low = healthy + (reportInventoryStatus.value.low / total) * 100;
  return { background: `conic-gradient(var(--chart-good) 0 ${healthy}%, var(--chart-warn) ${healthy}% ${low}%, var(--chart-bad) ${low}% 100%)` };
});
const reportChartMax = computed(() => Math.max(...report.value.daily_sales.map((item) => Number(item.total)), 1));
const showReportSection = (section) => reportCategory.value === "overview" || reportCategory.value === section;

/* ------------------------------------------------------------------
 * Sortable, paged tables (10 rows per page)
 * ------------------------------------------------------------------ */
function useTable(source, initialKey = null, initialDir = "asc", pageSize = 25) {
  const sortKey = ref(initialKey);
  const sortDir = ref(initialDir);
  const page = ref(1);
  const sorted = computed(() => {
    if (!sortKey.value) return source.value;
    const direction = sortDir.value === "asc" ? 1 : -1;
    return [...source.value].sort((a, b) => {
      const x = a[sortKey.value];
      const y = b[sortKey.value];
      const nx = Number(x);
      const ny = Number(y);
      if (x !== "" && y !== "" && !Number.isNaN(nx) && !Number.isNaN(ny)) return (nx - ny) * direction;
      return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true }) * direction;
    });
  });
  const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize)));
  const currentPage = computed(() => Math.min(page.value, pageCount.value));
  const rows = computed(() => sorted.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize));
  const total = computed(() => sorted.value.length);
  function sortBy(key) {
    if (sortKey.value === key) sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    else {
      sortKey.value = key;
      sortDir.value = "asc";
    }
    page.value = 1;
  }
  return reactive({ sortKey, sortDir, page, pageCount, currentPage, rows, total, pageSize, sortBy });
}
const productTable = useTable(filteredProducts, "name");
const salesTable = useTable(filteredTransactions, "sold_at", "desc");
const staffTable = useTable(filteredStaff, "name");
watch([search, selectedCategory, selectedStatus], () => (productTable.page = 1));
watch([salesSearch, salesFrom, salesTo], () => (salesTable.page = 1));
watch(staffSearch, () => (staffTable.page = 1));

// Small building blocks used inside the tables (written as render functions).
const SortHead = (props, { slots }) =>
  h(
    "button",
    {
      type: "button",
      class: ["sort-head", { active: props.table.sortKey === props.field }],
      onClick: () => props.table.sortBy(props.field),
    },
    [
      slots.default?.(),
      h(props.table.sortKey !== props.field ? ArrowUpDown : props.table.sortDir === "asc" ? ArrowUp : ArrowDown, { size: 13 }),
    ],
  );
SortHead.props = ["table", "field"];

const Pager = (props) => {
  const table = props.table;
  if (!table.total) return null;
  const start = (table.currentPage - 1) * table.pageSize + 1;
  const end = Math.min(table.currentPage * table.pageSize, table.total);
  return h("div", { class: "pager" }, [
    h("span", `Showing ${start}–${end} of ${table.total}`),
    table.pageCount > 1
      ? h("div", { class: "pager-buttons" }, [
          h("button", { type: "button", disabled: table.currentPage <= 1, "aria-label": "Previous page", onClick: () => (table.page = table.currentPage - 1) }, h(ChevronLeft, { size: 16 })),
          h("b", `${table.currentPage} / ${table.pageCount}`),
          h("button", { type: "button", disabled: table.currentPage >= table.pageCount, "aria-label": "Next page", onClick: () => (table.page = table.currentPage + 1) }, h(ChevronRight, { size: 16 })),
        ])
      : null,
  ]);
};
Pager.props = ["table"];

const CountUp = defineComponent({
  props: { value: { type: [Number, String], default: 0 }, money: Boolean },
  setup(props) {
    const shown = ref(0);
    let frame;
    watch(
      () => Number(props.value) || 0,
      (target, from) => {
        cancelAnimationFrame(frame);
        const start = Number(from) || 0;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || start === target) return (shown.value = target);
        const began = performance.now();
        const step = (now) => {
          const progress = Math.min((now - began) / 600, 1);
          shown.value = start + (target - start) * (1 - Math.pow(1 - progress, 3)); // ease-out
          if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { immediate: true },
    );
    onUnmounted(() => cancelAnimationFrame(frame));
    return () => (props.money ? money(shown.value) : Math.round(shown.value).toLocaleString("en-PH"));
  },
});

/* ------------------------------------------------------------------
 * Lifecycle and route changes
 * ------------------------------------------------------------------ */
onMounted(async () => {
  window.addEventListener("keydown", handleShortcuts);
  dateRefreshTimer = window.setInterval(() => {
    const previousDate = formatDateInput(currentDate.value);
    currentDate.value = new Date();
    if (previousDate !== formatDateInput(currentDate.value) && isAuthenticated.value) refreshData();
  }, 60000);
  if (isAuthenticated.value) await refreshData();
});
onUnmounted(() => {
  window.clearInterval(dateRefreshTimer);
  window.removeEventListener("keydown", handleShortcuts);
});

// Every time the page changes: close the mobile menu, reset filters, and prepare the new page.
watch(
  () => route.fullPath,
  async (_now, before) => {
    mobileMenuOpen.value = false;
    const samePage = before && before.split("?")[0] === route.path;
    if (!samePage) {
      search.value = "";
      selectedCategory.value = "All categories";
      selectedStatus.value = "All status";
      catalogSearch.value = "";
      if (!["/stock-in", "/adjust-stock"].includes(route.path) || !route.query.product) stockForm.value = emptyStockForm();
    }
    if (route.query.product && ["/stock-in", "/adjust-stock"].includes(route.path))
      stockForm.value = { ...emptyStockForm(), product_id: Number(route.query.product) };
    if (route.path === "/inventory" && route.query.status) selectedStatus.value = route.query.status;
    if (route.path === "/catalog" && ["categories", "suppliers"].includes(route.query.tab)) catalogTab.value = route.query.tab;
    if (route.path === "/profile") viewedProfile.value = currentUser.value;
    if (route.name === "user-profile" && isAuthenticated.value && viewedProfile.value?.id !== Number(route.params.id)) {
      try {
        const { data } = await api.get(`/users/${route.params.id}`);
        viewedProfile.value = data.data;
      } catch (error) {
        notify(apiError(error, "Unable to load profile."), "error");
      }
    }
  },
  { immediate: true },
);

// Keyboard shortcuts: Esc closes the top dialog, "/" jumps to the search box.
function handleShortcuts(event) {
  if (event.key === "Escape") {
    if (confirmDialog.value) return closeConfirm(false);
    if (receipt.value) return (receipt.value = null);
    if (catalogForm.value) return (catalogForm.value = null);
    if (announcementForm.value) return (announcementForm.value = null);
    if (showProductModal.value) return (showProductModal.value = false);
    if (showStaffModal.value) return (showStaffModal.value = false);
    if (showProfileEdit.value) return (showProfileEdit.value = false);
    if (showResetPassword.value) return (showResetPassword.value = false);
    if (quickViewId.value) return (quickViewId.value = null);
    if (showForgot.value) return (showForgot.value = false);
    if (mobileMenuOpen.value) return (mobileMenuOpen.value = false);
    return;
  }
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (event.key === "/" && !typing) {
    const field = document.querySelector(".content-wrap .search-field input");
    if (field) {
      event.preventDefault();
      field.focus();
    }
  }
}

/* ------------------------------------------------------------------
 * Loading data
 * ------------------------------------------------------------------ */
async function refreshData() {
  loading.value = true;
  try {
    const [productResponse, salesResponse, dashboardResponse, movementResponse, categoryResponse, supplierResponse] = await Promise.all([
      api.get("/products"),
      api.get("/sales"),
      api.get("/dashboard/summary"),
      api.get("/stock-movements?limit=200"),
      api.get("/categories"),
      api.get("/suppliers"),
    ]);
    products.value = (productResponse.data.data || []).map((item) => ({
      ...item,
      category_id: item.category?.id || item.category_id,
      category: item.category?.name || "Uncategorized",
      brand: item.brand || "Motorcycle",
      price: Number(item.price),
      quantity: Number(item.quantity),
      reorder_level: Number(item.reorder_level),
    }));
    transactions.value = (salesResponse.data.data || []).map(toTransaction);
    dashboard.value = { ...emptyDashboard(), ...dashboardResponse.data.data };
    dashboardSales.value = dashboardResponse.data.data.daily_sales || [];
    stockMovements.value = movementResponse.data.data || [];
    categories.value = categoryResponse.data.data || [];
    suppliers.value = supplierResponse.data.data || [];
    if (isAdmin.value) {
      const usersResponse = await api.get("/users");
      staff.value = usersResponse.data.data.map((user) => ({
        ...user,
        status: user.is_active ? "Active" : "Inactive",
        role: user.role === "admin" ? "Admin" : "Staff",
      }));
      await loadReport();
    }
    await loadNotifications();
    lastUpdated.value = new Date();
  } catch (error) {
    if (error.response?.status === 401) {
      notify("Your session has ended. Please sign in again.", "error");
      return endSession();
    }
    notify(apiError(error, "Unable to load data."), "error");
  } finally {
    loading.value = false;
  }
}
function toTransaction(sale) {
  const soldAt = parseApiDate(sale.sold_at);
  return {
    ...sale,
    saleId: sale.id,
    id: sale.transaction_number,
    date: soldAt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    shortDate: soldAt.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    time: soldAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
    items: sale.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    total: Number(sale.total_amount),
    payment: sale.payment_method,
    // Local calendar day, so a sale at 11 PM is filtered under the right date.
    rawDate: Number.isNaN(soldAt.getTime()) ? "" : formatDateInput(soldAt),
  };
}
async function loadReport() {
  reportLoading.value = true;
  try {
    const params = new URLSearchParams();
    if (reportFrom.value) params.set("from", reportFrom.value);
    if (reportTo.value) params.set("to", reportTo.value);
    const { data } = await api.get(`/reports/overview${params.toString() ? `?${params}` : ""}`);
    report.value = {
      summary: data.summary || {},
      inventory: data.inventory || [],
      sales: data.sales || [],
      movements: data.movements || [],
      daily_sales: data.daily_sales || [],
      low_stock: data.low_stock || [],
    };
  } catch (error) {
    notify(apiError(error, "Unable to load reports."), "error");
  } finally {
    reportLoading.value = false;
  }
}
async function loadNotifications() {
  try {
    const { data } = await api.get("/notifications");
    notifications.value = data.data || [];
  } catch (error) {
    notify(apiError(error, "Unable to load notifications."), "error");
  }
}
async function loadCatalog() {
  const [categoryResponse, supplierResponse] = await Promise.all([api.get("/categories"), api.get("/suppliers")]);
  categories.value = categoryResponse.data.data || [];
  suppliers.value = supplierResponse.data.data || [];
}

/* ------------------------------------------------------------------
 * Sign in / sign out
 * ------------------------------------------------------------------ */
async function submitLogin() {
  authLoading.value = true;
  authError.value = "";
  try {
    const { data } = await api.post("/auth/login", authForm.value);
    sessionStorage.setItem("auth_token", data.token);
    sessionStorage.setItem("auth_user", JSON.stringify(data.user));
    authToken.value = data.token;
    currentUser.value = data.user;
    authForm.value = { email: "", password: "" };
    showPassword.value = false;
    await router.push("/");
    await refreshData(); // load everything right away (it used to wait for a page reload)
  } catch (error) {
    authError.value = apiError(error, "Unable to sign in. Please check your email and password.");
  } finally {
    authLoading.value = false;
  }
}
async function logout() {
  const confirmed = cart.value.length
    ? await askConfirm({ title: "Log out?", message: "The items in the current sale will be cleared.", confirmLabel: "Log out", danger: true })
    : true;
  if (!confirmed) return;
  try {
    await api.post("/auth/logout");
  } catch {
    /* local logout still clears the session */
  }
  endSession();
}
// Clears everything from the previous user so the next sign-in starts clean.
function endSession() {
  sessionStorage.removeItem("auth_token");
  sessionStorage.removeItem("auth_user");
  authToken.value = null;
  currentUser.value = null;
  products.value = [];
  transactions.value = [];
  staff.value = [];
  notifications.value = [];
  stockMovements.value = [];
  cart.value = [];
  cashReceived.value = 0;
  receipt.value = null;
  viewedProfile.value = null;
  dashboard.value = emptyDashboard();
  dashboardSales.value = [];
  report.value = emptyReport();
  router.push("/login");
}

/* ------------------------------------------------------------------
 * Point of sale
 * ------------------------------------------------------------------ */
function addToCart(product) {
  if (!product.quantity) return;
  const existing = cart.value.find((item) => item.id === product.id);
  if (!existing) return cart.value.push({ ...product, cartQuantity: 1 });
  // Never add a second line for the same product; just raise the quantity if stock allows.
  if (existing.cartQuantity < product.quantity) existing.cartQuantity += 1;
  else notify(`Only ${product.quantity} ${product.name} in stock.`, "info");
}
function changeCartQuantity(item, amount) {
  const next = item.cartQuantity + amount;
  if (next < 1) return removeFromCart(item);
  if (next > item.quantity) return notify(`Only ${item.quantity} ${item.name} in stock.`, "info");
  item.cartQuantity = next;
}
function removeFromCart(product) {
  cart.value = cart.value.filter((item) => item.id !== product.id);
}
async function clearCart() {
  if (!cart.value.length) return;
  if (await askConfirm({ title: "Clear this sale?", message: "All items will be removed from the cart.", confirmLabel: "Clear sale", danger: true })) {
    cart.value = [];
    cashReceived.value = 0;
  }
}
// Pressing Enter in the POS search adds the product whose SKU or barcode matches
// exactly. Barcode scanners type the code and press Enter, so they work too.
function scanAdd() {
  const code = search.value.trim().toLowerCase();
  if (!code) return;
  const match =
    products.value.find((product) => product.sku?.toLowerCase() === code || product.barcode?.toLowerCase() === code) ||
    (filteredProducts.value.length === 1 ? filteredProducts.value[0] : null);
  if (!match) return notify(`No product found for "${search.value.trim()}".`, "info");
  if (!match.quantity) return notify(`${match.name} is out of stock.`, "info");
  addToCart(match);
  search.value = "";
}
function addCash(amount) {
  cashReceived.value = amount === "exact" ? Number(cartTotal.value.toFixed(2)) : Number(cashReceived.value || 0) + amount;
}
async function completeSale() {
  if (!cart.value.length) return notify("Add at least one product to the sale.", "info");
  if (changeDue.value < 0) return notify("Cash received is less than the total.", "error");
  checkoutBusy.value = true;
  try {
    const { data } = await api.post("/sales", {
      items: cart.value.map((item) => ({ product_id: item.id, quantity: item.cartQuantity })),
      payment_amount: Number(cashReceived.value),
      payment_method: "cash",
    });
    cart.value = [];
    cashReceived.value = 0;
    receipt.value = { sale: data.data, fresh: true }; // stay on POS and show the receipt
    refreshData();
  } catch (error) {
    notify(apiError(error, "Unable to complete sale."), "error");
    refreshData();
  } finally {
    checkoutBusy.value = false;
  }
}
async function viewSale(transaction) {
  try {
    const { data } = await api.get(`/sales/${transaction.saleId || transaction.id}`);
    receipt.value = { sale: data.data, fresh: false };
  } catch (error) {
    notify(apiError(error, "Unable to load transaction details."), "error");
  }
}
function scrollToCart() {
  document.getElementById("cart")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function printReceipt() {
  window.print();
}

/* ------------------------------------------------------------------
 * Products
 * ------------------------------------------------------------------ */
function openAddProduct() {
  editingProductId.value = null;
  newProduct.value = emptyProduct();
  modalError.value = "";
  showProductModal.value = true;
}
function editProduct(product) {
  editingProductId.value = product.id;
  modalError.value = "";
  newProduct.value = {
    name: product.name,
    sku: product.sku,
    brand: product.brand || "",
    category_id: product.category_id || "",
    price: product.price,
    cost_price: Number(product.cost_price || 0),
    quantity: product.quantity,
    reorder_level: product.reorder_level || 0,
    barcode: product.barcode || "",
    description: product.description || "",
    image_data: product.image_data || "",
  };
  showProductModal.value = true;
}
async function submitProduct() {
  modalError.value = "";
  const form = newProduct.value;
  if (!form.name.trim() || !form.sku.trim()) return (modalError.value = "Product name and SKU are required.");
  if (!Number(form.category_id)) return (modalError.value = "Select a category.");
  if (Number(form.price) < 0 || Number(form.cost_price) < 0) return (modalError.value = "Prices cannot be negative.");
  if (Number(form.reorder_level) < 0 || Number(form.quantity) < 0) return (modalError.value = "Quantities cannot be negative.");
  try {
    const isEditing = Boolean(editingProductId.value);
    const payload = {
      ...form,
      name: form.name.trim(),
      sku: form.sku.trim(),
      category_id: Number(form.category_id),
      price: Number(form.price || 0),
      quantity: Number(form.quantity || 0),
      reorder_level: Number(form.reorder_level || 0),
      cost_price: Number(form.cost_price || 0),
      barcode: form.barcode?.trim() || null,
      description: form.description?.trim() || null,
      image_data: form.image_data || null,
    };
    await (isEditing ? api.put(`/products/${editingProductId.value}`, payload) : api.post("/products", payload));
    showProductModal.value = false;
    notify(`${payload.name} ${isEditing ? "updated" : "added"}.`);
    await refreshData();
  } catch (error) {
    modalError.value = apiError(error, "Unable to save product.");
  }
}
async function archiveProduct(product) {
  const confirmed = await askConfirm({
    title: `Archive ${product.name}?`,
    message: "It will be hidden from products, inventory, and the POS. Past sales stay in the records.",
    confirmLabel: "Archive",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api.delete(`/products/${product.id}`);
    notify(`${product.name} archived.`);
    await refreshData();
  } catch (error) {
    notify(apiError(error, "Unable to archive product."), "error");
  }
}
function uploadProductImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    modalError.value = "Choose a JPG, PNG, WEBP, or GIF image.";
    event.target.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    modalError.value = "Product images must be 5 MB or smaller.";
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    newProduct.value.image_data = String(reader.result);
    modalError.value = "";
  };
  reader.onerror = () => (modalError.value = "Unable to read the selected image.");
  reader.readAsDataURL(file);
}
function restock(product) {
  router.push({ path: "/stock-in", query: { product: product.id } });
}

/* ------------------------------------------------------------------
 * Stock in and adjustments
 * ------------------------------------------------------------------ */
async function submitStockMovement() {
  const quantity = Number(stockForm.value.quantity);
  if (!stockForm.value.product_id) return notify("Select a product.", "error");
  if (!Number.isInteger(quantity) || quantity < 1) return notify("Enter a whole quantity of 1 or more.", "error");
  if (isStockIn.value && !stockForm.value.supplier_id) return notify("Select a supplier.", "error");
  if (!isStockIn.value && !stockForm.value.reason.trim()) return notify("Write a short reason for the adjustment.", "error");
  if (!isStockIn.value && quantity > (selectedStockProduct.value?.quantity || 0))
    return notify(`Only ${selectedStockProduct.value?.quantity || 0} unit(s) are in stock.`, "error");
  stockSaving.value = true;
  try {
    if (isStockIn.value)
      await api.post("/stock-movements", {
        product_id: Number(stockForm.value.product_id),
        quantity,
        reference: stockForm.value.reference.trim() || "STOCK-IN",
        supplier_id: Number(stockForm.value.supplier_id),
        notes: stockForm.value.reason.trim() || "Inventory stock-in",
      });
    else
      await api.post("/stock-out", {
        product_id: Number(stockForm.value.product_id),
        quantity,
        reason: `${adjustType.value}: ${stockForm.value.reason.trim()}`,
      });
    notify(isStockIn.value ? `${quantity} unit(s) added to stock.` : `${quantity} unit(s) removed from stock.`);
    stockForm.value = emptyStockForm();
    if (route.query.product) router.replace({ path: route.path });
    await refreshData();
  } catch (error) {
    notify(apiError(error, "Unable to save inventory movement."), "error");
  } finally {
    stockSaving.value = false;
  }
}

/* ------------------------------------------------------------------
 * Catalog: categories and suppliers
 * ------------------------------------------------------------------ */
function openCatalogForm(item = null) {
  modalError.value = "";
  catalogForm.value = {
    kind: catalogTab.value,
    id: item?.id || null,
    name: item?.name || "",
    description: item?.description || "",
    contact_person: item?.contact_person || "",
    phone: item?.phone || "",
    email: item?.email || "",
    address: item?.address || "",
  };
}
async function saveCatalogItem() {
  const form = catalogForm.value;
  modalError.value = "";
  if (!form.name.trim()) return (modalError.value = "Name is required.");
  const isCategory = form.kind === "categories";
  const payload = isCategory
    ? { name: form.name.trim(), description: form.description.trim() || null }
    : {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      };
  try {
    const path = `/${form.kind}`;
    await (form.id ? api.put(`${path}/${form.id}`, payload) : api.post(path, payload));
    notify(`${isCategory ? "Category" : "Supplier"} ${form.id ? "updated" : "added"}.`);
    catalogForm.value = null;
    await loadCatalog();
  } catch (error) {
    modalError.value = apiError(error, "Unable to save.");
  }
}
async function toggleCatalogItem(item) {
  const isCategory = catalogTab.value === "categories";
  const label = isCategory ? "category" : "supplier";
  if (item.is_active) {
    const confirmed = await askConfirm({
      title: `Deactivate ${item.name}?`,
      message: isCategory ? "It won't be offered for new products." : "It won't be offered for new stock-ins.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!confirmed) return;
  }
  try {
    // Deactivating uses DELETE (the server checks the category isn't in use); reactivating uses PUT.
    await (item.is_active ? api.delete(`/${catalogTab.value}/${item.id}`) : api.put(`/${catalogTab.value}/${item.id}`, { is_active: true }));
    notify(`${item.name} ${item.is_active ? "deactivated" : "activated"}.`);
    await loadCatalog();
  } catch (error) {
    notify(apiError(error, `Unable to update ${label}.`), "error");
  }
}

/* ------------------------------------------------------------------
 * Staff and profiles
 * ------------------------------------------------------------------ */
function openStaffModal() {
  newStaff.value = { name: "", email: "", password: "", role: "staff" };
  modalError.value = "";
  revealPasswords.value = false;
  showStaffModal.value = true;
}
async function submitStaff() {
  modalError.value = "";
  if (!newStaff.value.name.trim() || !newStaff.value.email.trim()) return (modalError.value = "Name and email are required.");
  if (newStaff.value.password.length < 8) return (modalError.value = "Password must be at least 8 characters.");
  try {
    await api.post("/users", { ...newStaff.value, name: newStaff.value.name.trim(), email: newStaff.value.email.trim() });
    showStaffModal.value = false;
    notify(`${newStaff.value.name} can now sign in.`);
    await refreshData();
  } catch (error) {
    modalError.value = apiError(error, "Unable to create staff account.");
  }
}
async function toggleStaff(person) {
  const deactivating = person.status === "Active";
  if (deactivating) {
    const confirmed = await askConfirm({
      title: `Deactivate ${person.name}?`,
      message: "They won't be able to sign in until you activate the account again.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!confirmed) return;
  }
  try {
    await api.put(`/users/${person.id}`, { is_active: !deactivating });
    notify(`${person.name} ${deactivating ? "deactivated" : "activated"}.`);
    await refreshData();
    if (viewedProfile.value?.id === person.id) viewedProfile.value = { ...viewedProfile.value, is_active: !deactivating };
  } catch (error) {
    notify(apiError(error, "Unable to update account status."), "error");
  }
}
async function deleteStaff(person) {
  const confirmed = await askConfirm({
    title: `Delete ${person.name}?`,
    message: "This removes the account for good. Accounts with sales history can only be deactivated.",
    confirmLabel: "Delete",
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api.delete(`/users/${person.id}`);
    staff.value = staff.value.filter((item) => item.id !== person.id);
    notify(`${person.name}'s account was deleted.`);
  } catch (error) {
    notify(apiError(error, "Unable to delete user account."), "error");
  }
}
async function openProfile(person = null) {
  if (!person || person.id === currentUser.value?.id) {
    viewedProfile.value = currentUser.value;
    return router.push("/profile");
  }
  try {
    const { data } = await api.get(`/users/${person.id}`);
    viewedProfile.value = data.data;
    router.push(`/users/${person.id}/profile`);
  } catch (error) {
    notify(apiError(error, "Unable to load profile."), "error");
  }
}
function beginProfileEdit() {
  const profile = viewedProfile.value || currentUser.value;
  profileForm.value = { name: profile?.name || "", email: profile?.email || "", password: "" };
  modalError.value = "";
  revealPasswords.value = false;
  showProfileEdit.value = true;
}
async function saveProfile() {
  modalError.value = "";
  if (profileForm.value.password && profileForm.value.password.length < 8) return (modalError.value = "New password must be at least 8 characters.");
  try {
    const payload = { name: profileForm.value.name.trim(), email: profileForm.value.email.trim() };
    if (profileForm.value.password) payload.password = profileForm.value.password;
    const { data } = await api.put("/profile", payload);
    currentUser.value = data.data;
    sessionStorage.setItem("auth_user", JSON.stringify(currentUser.value));
    viewedProfile.value = currentUser.value;
    showProfileEdit.value = false;
    notify("Profile updated.");
  } catch (error) {
    modalError.value = apiError(error, "Unable to update profile.");
  }
}
function openResetPassword() {
  resetPasswordValue.value = "";
  modalError.value = "";
  revealPasswords.value = false;
  showResetPassword.value = true;
}
async function submitResetPassword() {
  if (resetPasswordValue.value.length < 8) return (modalError.value = "Password must be at least 8 characters.");
  try {
    await api.put(`/users/${viewedProfile.value.id}`, { password: resetPasswordValue.value });
    showResetPassword.value = false;
    notify(`Password reset for ${viewedProfile.value.name}.`);
  } catch (error) {
    modalError.value = apiError(error, "Unable to reset password.");
  }
}

/* ------------------------------------------------------------------
 * Notifications
 * ------------------------------------------------------------------ */
async function markNotificationRead(notification) {
  if (notification.is_read) return;
  try {
    await api.patch(`/notifications/${notification.id}/read`);
    notification.is_read = true;
  } catch (error) {
    notify(apiError(error, "Unable to update notification."), "error");
  }
}
async function markAllNotificationsRead() {
  try {
    await api.post("/notifications/read-all");
    notifications.value.forEach((notification) => (notification.is_read = true));
    notify("All notifications marked as read.");
  } catch (error) {
    notify(apiError(error, "Unable to update notifications."), "error");
  }
}
async function deleteNotification(notification) {
  try {
    await api.delete(`/notifications/${notification.id}`);
    notifications.value = notifications.value.filter((item) => item.id !== notification.id);
  } catch (error) {
    notify(apiError(error, "Unable to delete notification."), "error");
  }
}
function openAnnouncement() {
  modalError.value = "";
  announcementForm.value = { title: "", message: "" };
}
async function postAnnouncement() {
  const form = announcementForm.value;
  if (!form.title.trim() || !form.message.trim()) return (modalError.value = "Write a title and a message.");
  try {
    await api.post("/notifications", { title: form.title.trim(), message: form.message.trim(), type: "announcement" });
    announcementForm.value = null;
    notificationTab.value = "announcements";
    notify("Announcement posted to everyone.");
    await loadNotifications();
  } catch (error) {
    modalError.value = apiError(error, "Unable to post announcement.");
  }
}
function notificationIcon(notification) {
  if (notification.type === "announcement") return Megaphone;
  if (notification.type === "inventory") return AlertTriangle;
  if (notification.type === "stock") return Box;
  if (notification.type === "product") return Package;
  if (notification.type === "user") return UserPlus;
  return Info;
}
function notificationTone(notification) {
  if (notification.type === "inventory") return notification.title.toLowerCase().includes("out of stock") ? "red" : "yellow";
  if (notification.type === "stock" || notification.type === "user") return "green";
  return "blue";
}

/* ------------------------------------------------------------------
 * Reports and CSV export
 * ------------------------------------------------------------------ */
function setReportRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  reportFrom.value = formatDateInput(start);
  reportTo.value = formatDateInput(end);
  reportPreset.value = days;
  loadReport();
}
function clearReportRange() {
  reportFrom.value = "";
  reportTo.value = "";
  reportPreset.value = null;
  loadReport();
}
function downloadCsv(rows, name) {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  link.download = `${name}-${formatDateInput(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function exportReport() {
  const rows = [["Report", "Date", "Reference", "Amount", "Type", "Stock"]];
  if (showReportSection("sales"))
    report.value.sales.forEach((sale) => rows.push(["sales", sale.sold_at, sale.transaction_number, sale.total_amount, "Sale", ""]));
  if (showReportSection("movements"))
    report.value.movements.forEach((movement) =>
      rows.push(["movements", movement.created_at, movement.product?.name || "", movement.quantity, movementLabel(movement.type), movement.quantity_after]),
    );
  if (showReportSection("inventory"))
    report.value.inventory.forEach((product) =>
      rows.push(["inventory", product.updated_at, product.sku, product.price, statusFor(product), product.stock_on_hand]),
    );
  downloadCsv(rows, `motoparts-${reportCategory.value}-report`);
  notify("Report downloaded as CSV.");
}
function exportSales() {
  const rows = [["Date", "Transaction #", "Items", "Total", "Payment", "Cashier"]];
  [...filteredTransactions.value]
    .sort((a, b) => String(b.sold_at).localeCompare(String(a.sold_at)))
    .forEach((sale) => rows.push([sale.date, sale.id, sale.items, sale.total, sale.payment, sale.cashier?.name || ""]));
  downloadCsv(rows, "motoparts-sales");
  notify(`${rows.length - 1} sale(s) exported.`);
}

/* ------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------ */
function emptyDashboard() {
  return { total_products: 0, low_stock: 0, out_of_stock: 0, todays_sales: 0, transaction_count: 0, recent: [], top_products: [] };
}
function emptyReport() {
  return { summary: {}, inventory: [], sales: [], movements: [], daily_sales: [], low_stock: [] };
}
function emptyStockForm() {
  return { product_id: "", quantity: 1, reason: "", reference: "", supplier_id: "" };
}
function emptyProduct() {
  return {
    name: "",
    sku: "",
    brand: "",
    category_id: categories.value.find((item) => item.is_active)?.id || "",
    price: 0,
    cost_price: 0,
    quantity: 0,
    reorder_level: 5,
    barcode: "",
    description: "",
    image_data: "",
  };
}
function readStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("auth_user") || "null");
  } catch {
    return null;
  }
}
function readTheme() {
  try {
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function statusFor(product) {
  const quantity = Number(product.quantity ?? product.stock_on_hand);
  return quantity === 0 ? "Out of Stock" : quantity <= Number(product.reorder_level) ? "Low Stock" : "In Stock";
}
// Pictures live on the product list only, so other lists look them up by product id.
function imageFor(productId) {
  return productImages.value[productId] || null;
}
function statusTone(product) {
  return { "In Stock": "good", "Low Stock": "warn", "Out of Stock": "bad" }[statusFor(product)];
}
function openQuickView(productId) {
  if (products.value.some((product) => product.id === productId)) quickViewId.value = productId;
}
function openInventory(status) {
  router.push({ path: "/inventory", query: status === "All status" ? {} : { status } });
}
function readFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function statusClass(product) {
  return statusFor(product).toLowerCase().replaceAll(" ", "-");
}
function money(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function initials(name = "") {
  return (
    String(name || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "?"
  );
}
function movementLabel(type) {
  return { stock_in: "Stock in", stock_out: "Adjustment", sale: "Sale" }[type] || type;
}
function formatDateInput(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseApiDate(value) {
  if (!value) return new Date(NaN);
  if (typeof value === "string" && value.includes(" ") && !value.includes("T")) return new Date(`${value.replace(" ", "T")}Z`);
  return new Date(value);
}
function formatReportDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
function formatDateTime(value) {
  return parseApiDate(value).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function timeAgo(value) {
  const date = parseApiDate(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}
function stagger(index) {
  return { "--i": Math.min(index, 12) };
}
async function focusFirstField(selector) {
  await nextTick();
  document.querySelector(`${selector} input:not([type="file"])`)?.focus();
}
watch(showProductModal, (open) => open && focusFirstField(".product-modal"));
watch(showStaffModal, (open) => open && focusFirstField(".staff-modal"));
watch(catalogForm, (form) => form && focusFirstField(".catalog-modal"));
</script>

<template>
  <!-- Thin progress bar while data loads (does not push the page down) -->
  <Transition name="fade"><div v-if="loading && isAuthenticated" class="top-progress"></div></Transition>

  <!-- ============================== SIGN IN ============================== -->
  <div v-if="!isAuthenticated || route.path === '/login'" class="auth-screen">
    <div class="auth-brand-panel">
      <div class="brand-lockup auth-lockup">
        <img class="brand-logo" :src="bszLogo" alt="BSZ Motorcycle Parts and Accessories" />
        <strong>BSZ Motorcycle</strong>
      </div>
      <div class="auth-illustration rise"><img :src="bszLogo" alt="" /></div>
      <div class="auth-brand-copy rise" :style="stagger(1)">
        <span class="eyebrow">Parts &amp; accessories</span>
        <h2>Everything your workshop needs,<br />in one place.</h2>
        <p>Manage stock, sales, and your team with confidence.</p>
      </div>
    </div>
    <div class="auth-form-panel">
      <div class="auth-card rise">
        <img class="auth-card-logo" :src="bszLogo" alt="BSZ Motorcycle" />
        <h1>Welcome back!</h1>
        <p>Sign in to your account</p>
        <form @submit.prevent="submitLogin">
          <label class="input-with-icon">
            <UserRound :size="20" />
            <input v-model="authForm.email" type="email" placeholder="Email address" autocomplete="username" required />
          </label>
          <label class="input-with-icon">
            <Lock :size="20" />
            <input v-model="authForm.password" :type="showPassword ? 'text' : 'password'" placeholder="Password" autocomplete="current-password" required />
            <button type="button" class="eye-button" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="18" /><Eye v-else :size="18" />
            </button>
          </label>
          <button type="button" class="forgot-link" @click="showForgot = true">Forgot password?</button>
          <Transition name="fade"><p v-if="authError" class="auth-error"><CircleX :size="15" /> {{ authError }}</p></Transition>
          <button class="button primary wide" :disabled="authLoading">
            <RefreshCw v-if="authLoading" :size="16" class="spinning" />{{ authLoading ? "Signing in…" : "Log in" }}
          </button>
        </form>
        <small class="demo-note">
          <span>Admin: admin@motoparts.test / password123</span>
          <span>Staff: staff@motoparts.test / password123</span>
        </small>
      </div>
      <small class="copyright">© 2026 BSZ Motorcycle Parts &amp; Accessories</small>
    </div>
  </div>

  <!-- ============================== APP SHELL ============================== -->
  <div v-else class="dashboard-shell" :class="{ collapsed: sidebarCollapsed }">
    <Transition name="fade"><div v-if="mobileMenuOpen" class="sidebar-backdrop" @click="mobileMenuOpen = false"></div></Transition>
    <aside class="sidebar" :class="{ open: mobileMenuOpen }">
      <RouterLink to="/" class="brand-lockup sidebar-brand" title="Go to Dashboard" @click="mobileMenuOpen = false">
        <img class="brand-logo" :src="bszLogo" alt="BSZ Motorcycle Parts and Accessories" />
        <span class="brand-text"><strong>BSZ</strong><small>Motorcycle Parts</small></span>
      </RouterLink>
      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="sidebar-item"
          :class="{ active: route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path) && !route.path.includes('/profile')) }"
          :title="sidebarCollapsed ? item.label : null"
          @click="router.push(item.path)"
        >
          <component :is="item.icon" :size="19" /><span class="nav-label">{{ item.label }}</span>
          <b v-if="item.path === '/notifications' && unreadCount" class="nav-count">{{ unreadCount > 99 ? "99+" : unreadCount }}</b>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <!-- Lives at the bottom so it never moves when the sidebar collapses -->
        <button class="sidebar-item collapse-toggle" :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'" :title="sidebarCollapsed ? 'Expand sidebar' : null" @click="sidebarCollapsed = !sidebarCollapsed">
          <ChevronsRight v-if="sidebarCollapsed" :size="19" /><ChevronsLeft v-else :size="19" /><span class="nav-label">Collapse</span>
        </button>
        <button class="sidebar-item" :title="sidebarCollapsed ? 'Log out' : null" @click="logout"><LogOut :size="19" /><span class="nav-label">Log out</span></button>
      </div>
    </aside>

    <main class="main-area">
      <!-- Top bar: page title on the left, page actions + account on the right -->
      <header class="topbar">
        <button class="mobile-toggle" aria-label="Open menu" @click="mobileMenuOpen = !mobileMenuOpen"><Menu :size="22" /></button>
        <Transition name="fade" mode="out-in">
          <div :key="routeName" class="topbar-title">
            <h1>{{ routeName }}</h1>
            <div class="breadcrumbs"><span>{{ isAdmin ? "Admin" : "Staff" }}</span><span>/</span><b>{{ routeName }}</b></div>
          </div>
        </Transition>
        <div class="topbar-spacer"></div>
        <div class="topbar-actions">
          <template v-if="route.path === '/'">
            <small v-if="lastUpdated" class="updated-at">Updated {{ lastUpdated.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) }}</small>
            <button class="button outline icon-only" aria-label="Refresh" title="Refresh" :disabled="loading" @click="refreshData"><RefreshCw :size="16" :class="{ spinning: loading }" /></button>
            <button class="button primary" @click="router.push('/pos')"><ShoppingCart :size="17" /><span class="btn-label">Point of Sale</span></button>
          </template>
          <button v-else-if="route.path === '/products'" class="button primary" @click="openAddProduct"><Plus :size="18" /><span class="btn-label">Add product</span></button>
          <button v-else-if="route.path === '/users'" class="button primary" @click="openStaffModal"><UserPlus :size="18" /><span class="btn-label">Add staff</span></button>
          <button v-else-if="route.path === '/sales'" class="button outline" :disabled="!filteredTransactions.length" @click="exportSales"><Download :size="16" /><span class="btn-label">Export CSV</span></button>
          <template v-else-if="route.path === '/reports'">
            <button class="button outline icon-only" aria-label="Refresh report" title="Refresh" :disabled="reportLoading" @click="loadReport"><RefreshCw :size="16" :class="{ spinning: reportLoading }" /></button>
            <button class="button primary" @click="exportReport"><Download :size="16" /><span class="btn-label">Export CSV</span></button>
          </template>
        </div>
        <span class="topbar-divider"></span>
        <button class="top-icon" :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'" :title="theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="theme = theme === 'dark' ? 'light' : 'dark'">
          <Sun v-if="theme === 'dark'" :size="19" /><Moon v-else :size="19" />
        </button>
        <button class="top-icon" aria-label="Notifications" @click="router.push('/notifications')">
          <Bell :size="19" />
          <Transition name="pop"><b v-if="unreadCount" class="notification-badge">{{ unreadCount > 99 ? "99+" : unreadCount }}</b></Transition>
        </button>
        <button class="top-user" @click="openProfile()">
          <span class="avatar-chip">{{ userInitials }}</span>
          <span class="top-user-text"><b class="ellipsis">{{ currentUser?.name || "Account" }}</b><small>{{ isAdmin ? "Administrator" : "Staff" }}</small></span>
        </button>
      </header>

      <div class="content-wrap">
        <Transition name="page" mode="out-in">
          <div :key="route.path" class="page-wrap">
            <!-- ============================== DASHBOARD ============================== -->
            <section v-if="route.path === '/'" class="page-view dash-view">
              <div class="metric-grid">
                <article class="metric-card rise" :style="stagger(0)">
                  <span class="metric-icon blue"><Package :size="22" /></span>
                  <div><small>Total products</small><strong><CountUp :value="dashboard.total_products" /></strong><em>{{ categories.filter((item) => item.is_active).length }} categories</em></div>
                </article>
                <article class="metric-card rise clickable" :style="stagger(1)" @click="openInventory('Low Stock')">
                  <span class="metric-icon yellow"><AlertTriangle :size="22" /></span>
                  <div><small>Low stock</small><strong><CountUp :value="dashboard.low_stock || 0" /></strong><em>Tap to review</em></div>
                </article>
                <article class="metric-card rise clickable" :style="stagger(2)" @click="openInventory('Out of Stock')">
                  <span class="metric-icon red"><X :size="23" /></span>
                  <div><small>Out of stock</small><strong><CountUp :value="dashboard.out_of_stock || 0" /></strong><em>Tap to review</em></div>
                </article>
                <article class="metric-card rise" :style="stagger(3)">
                  <span class="metric-icon green"><CircleDollarSign :size="22" /></span>
                  <div><small>Today's sales</small><strong><CountUp :value="dashboard.todays_sales" money /></strong><em>{{ dashboard.transaction_count || 0 }} transactions</em></div>
                </article>
              </div>

              <div class="dashboard-grid three-up fill-row">
                <section class="white-panel chart-panel panel-fill rise" :style="stagger(4)">
                  <div class="panel-title">
                    <div><h2>Sales overview</h2><small class="panel-sub">Last 7 days · {{ money(weekTotal) }}</small></div>
                    <TrendingUp :size="18" class="muted-icon" />
                  </div>
                  <div class="bar-chart">
                    <span v-for="day in dashboardChart" :key="day.key" class="bar" :style="{ height: `${day.height}%` }" :data-tip="`${day.label}: ${money(day.total)}`"></span>
                  </div>
                  <div class="chart-labels"><span v-for="day in dashboardChart" :key="`${day.key}-label`">{{ day.label }}</span></div>
                </section>

                <section class="white-panel panel-fill rise" :style="stagger(5)">
                  <div class="panel-title">
                    <h2>Recent transactions</h2>
                    <button class="text-button" @click="router.push('/sales')">View all</button>
                  </div>
                  <div class="mini-table">
                    <div class="mini-table-head"><span>Date</span><span>Transaction #</span><span>Total</span></div>
                    <div class="scroll-area">
                      <button v-for="transaction in transactions.slice(0, 15)" :key="transaction.id" class="mini-table-row" @click="viewSale(transaction)">
                        <span>{{ transaction.shortDate }}</span><span class="ellipsis">{{ transaction.id }}</span><b>{{ money(transaction.total) }}</b>
                      </button>
                      <div v-if="!transactions.length" class="empty-state compact">
                        <span class="empty-state-icon"><ShoppingCart :size="18" /></span><b>No sales yet</b><small>Completed sales show up here.</small>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="white-panel panel-fill rise" :style="stagger(6)">
                  <div class="panel-title">
                    <div><h2>Top sellers</h2><small class="panel-sub">Last 30 days</small></div>
                    <Trophy :size="18" class="muted-icon" />
                  </div>
                  <ol class="top-list scroll-area">
                    <li v-for="(item, index) in dashboard.top_products" :key="item.id" @click="openQuickView(item.id)">
                      <span class="rank">{{ index + 1 }}</span>
                      <span class="product-thumb"><img v-if="item.image_data" :src="item.image_data" :alt="item.name" /><Package v-else :size="16" /></span>
                      <span class="ellipsis"><b>{{ item.name }}</b><small>{{ money(item.revenue) }}</small></span>
                      <strong>{{ item.units }} sold</strong>
                    </li>
                  </ol>
                  <div v-if="!dashboard.top_products?.length" class="empty-state compact">
                    <span class="empty-state-icon"><Trophy :size="18" /></span><b>No best sellers yet</b><small>Sell a few items to see rankings.</small>
                  </div>
                </section>
              </div>

              <div v-if="stockIssues" class="alert-strip rise" :style="stagger(7)">
                <AlertTriangle :size="22" />
                <div><b>Stock alert</b><span>{{ dashboard.out_of_stock || 0 }} out of stock · {{ dashboard.low_stock || 0 }} running low</span></div>
                <button class="text-button" @click="openInventory('All status')">Review stock</button>
              </div>
              <div v-else class="alert-strip healthy rise" :style="stagger(7)">
                <CircleCheck :size="22" />
                <div><b>All stock levels are healthy</b><span>Nothing is low or out of stock right now.</span></div>
              </div>
            </section>

            <!-- ============================== PRODUCTS & INVENTORY ============================== -->
            <section v-else-if="route.path === '/products' || route.path === '/inventory'" class="page-view">
              <div class="white-panel table-panel panel-fill rise">
                <div class="toolbar">
                  <label class="search-field"><Search :size="18" /><input v-model="search" placeholder="Search name, SKU, brand…" /></label>
                  <select v-model="selectedCategory">
                    <option>All categories</option>
                    <option v-for="category in categories" :key="category.id">{{ category.name }}</option>
                  </select>
                  <select v-model="selectedStatus">
                    <option>All status</option>
                    <option>In Stock</option>
                    <option>Low Stock</option>
                    <option>Out of Stock</option>
                  </select>
                  <Transition name="fade">
                    <button v-if="productFiltersActive" class="text-button clear-filters" @click="search = ''; selectedCategory = 'All categories'; selectedStatus = 'All status'">
                      <FilterX :size="14" /> Clear
                    </button>
                  </Transition>
                </div>
                <div class="data-table" :class="{ 'no-actions': route.path === '/inventory' && !isAdmin }">
                  <div class="data-head">
                    <span>Product</span>
                    <SortHead :table="productTable" field="name">Name</SortHead>
                    <SortHead :table="productTable" field="category">Category</SortHead>
                    <SortHead :table="productTable" field="price">Price</SortHead>
                    <SortHead :table="productTable" field="quantity">Stock</SortHead>
                    <span>Status</span>
                    <span v-if="route.path === '/products' || isAdmin">Actions</span>
                  </div>
                  <div v-for="(product, index) in productTable.rows" :key="product.id" class="data-row rise" role="button" tabindex="0" :style="stagger(index)" @click="openQuickView(product.id)" @keydown.enter="openQuickView(product.id)">
                    <span class="product-thumb"><img v-if="product.image_data" :src="product.image_data" :alt="product.name" /><Package v-else :size="22" /></span>
                    <span class="ellipsis"><b>{{ product.name }}</b><em>{{ product.brand }} · {{ product.sku }}</em></span>
                    <span>{{ product.category }}</span>
                    <span>{{ money(product.price) }}</span>
                    <span>{{ product.quantity }}</span>
                    <span><strong class="status-pill" :class="statusTone(product)">{{ statusFor(product) }}</strong></span>
                    <span v-if="route.path === '/products'" class="row-actions" @click.stop>
                      <button type="button" title="Edit product" aria-label="Edit" @click="editProduct(product)"><Pencil :size="17" /></button>
                      <button type="button" title="Archive product" aria-label="Archive" class="danger" @click="archiveProduct(product)"><Trash2 :size="17" /></button>
                    </span>
                    <span v-else-if="isAdmin" class="row-actions" @click.stop>
                      <button v-if="statusFor(product) !== 'In Stock'" type="button" class="chip-button" title="Add stock for this product" @click="restock(product)"><PackagePlus :size="15" /> Restock</button>
                    </span>
                  </div>
                  <div v-if="!productTable.total" class="empty-state">
                    <span class="empty-state-icon"><Search :size="20" /></span>
                    <b>{{ products.length ? "No products match your filters" : "No products yet" }}</b>
                    <small>{{ products.length ? "Try a different search or clear the filters." : "Add your first product to get started." }}</small>
                  </div>
                </div>
                <Pager :table="productTable" />
              </div>
            </section>

            <!-- ============================== POINT OF SALE ============================== -->
            <section v-else-if="route.path === '/pos'" class="page-view pos-view">
              <div class="pos-products white-panel panel-fill rise">
                <label class="search-field">
                  <ScanLine :size="18" />
                  <input v-model="search" placeholder="Search or scan SKU / barcode, then press Enter" @keydown.enter.prevent="scanAdd" />
                </label>
                <div class="category-tabs segmented">
                  <button :class="{ selected: selectedCategory === 'All categories' }" @click="selectedCategory = 'All categories'">All</button>
                  <button v-for="category in activeCategories" :key="category.id" :class="{ selected: selectedCategory === category.name }" @click="selectedCategory = category.name">{{ category.name }}</button>
                </div>
                <div class="pos-grid scroll-area">
                  <button v-for="(product, index) in filteredProducts" :key="product.id" class="pos-card rise" :style="stagger(index)" :disabled="!product.quantity" @click="addToCart(product)">
                    <span class="product-thumb large"><img v-if="product.image_data" :src="product.image_data" :alt="product.name" /><Package v-else :size="30" /></span>
                    <b class="ellipsis">{{ product.name }}</b>
                    <small>{{ money(product.price) }}</small>
                    <em :class="{ sold: !product.quantity, low: product.quantity && product.quantity <= product.reorder_level }">{{ product.quantity ? `${product.quantity} in stock` : "Out of stock" }}</em>
                    <span v-if="cart.find((item) => item.id === product.id)" class="in-cart-badge">{{ cart.find((item) => item.id === product.id).cartQuantity }}</span>
                  </button>
                  <div v-if="!filteredProducts.length" class="empty-state">
                    <span class="empty-state-icon"><Search :size="20" /></span><b>No products found</b><small>Try another name, SKU, or category.</small>
                  </div>
                </div>
              </div>

              <!-- Phones/tablets only: the cart sits below the products, so show a shortcut to it -->
              <Transition name="toast">
                <button v-if="cart.length" class="cart-jump" @click="scrollToCart">
                  <ShoppingCart :size="18" /><span>{{ cartUnits }} item{{ cartUnits === 1 ? "" : "s" }}</span><b>{{ money(cartTotal) }}</b><ChevronRight :size="16" />
                </button>
              </Transition>
              <aside id="cart" class="cart-panel white-panel rise" :style="stagger(1)">
                <div class="panel-title">
                  <h2>Current sale</h2>
                  <span class="count-pill">{{ cartUnits }} item{{ cartUnits === 1 ? "" : "s" }}</span>
                </div>
                <TransitionGroup name="list" tag="div" class="cart-list">
                  <div v-for="item in cart" :key="item.id" class="cart-item">
                    <span class="product-thumb"><img v-if="item.image_data" :src="item.image_data" :alt="item.name" /><Package v-else :size="20" /></span>
                    <div class="cart-info">
                      <b>{{ item.name }}</b>
                      <div class="stepper">
                        <button aria-label="Decrease" @click="changeCartQuantity(item, -1)">−</button>
                        <span>{{ item.cartQuantity }}</span>
                        <button aria-label="Increase" @click="changeCartQuantity(item, 1)">+</button>
                        <small>× {{ money(item.price) }}</small>
                      </div>
                    </div>
                    <div class="cart-line-end">
                      <strong>{{ money(item.cartQuantity * item.price) }}</strong>
                      <button class="icon-danger" aria-label="Remove item" @click="removeFromCart(item)"><Trash2 :size="15" /></button>
                    </div>
                  </div>
                </TransitionGroup>
                <div v-if="!cart.length" class="empty-state cart-empty">
                  <span class="empty-state-icon"><ShoppingCart :size="20" /></span><b>Cart is empty</b><small>Tap a product or scan a code to add it.</small>
                </div>
                <div class="cart-bottom">
                  <div class="cart-total"><b>Total</b><strong>{{ money(cartTotal) }}</strong></div>
                  <label class="cash-field">Cash received<input v-model.number="cashReceived" type="number" min="0" step="0.01" :disabled="!cart.length" /></label>
                  <div class="quick-cash">
                    <button :disabled="!cart.length" @click="addCash('exact')">Exact</button>
                    <button :disabled="!cart.length" @click="addCash(100)">+100</button>
                    <button :disabled="!cart.length" @click="addCash(500)">+500</button>
                    <button :disabled="!cart.length" @click="addCash(1000)">+1000</button>
                  </div>
                  <p v-if="cart.length" class="change-line" :class="{ short: changeDue < 0 }">
                    <span>{{ changeDue < 0 ? "Short by" : "Change" }}</span><b>{{ money(Math.abs(changeDue)) }}</b>
                  </p>
                  <div class="cart-actions">
                    <button class="button outline" :disabled="!cart.length" @click="clearCart">Clear</button>
                    <button class="button primary" :disabled="!canCheckout" @click="completeSale">
                      <RefreshCw v-if="checkoutBusy" :size="16" class="spinning" /><Banknote v-else :size="17" /> Checkout
                    </button>
                  </div>
                </div>
              </aside>
            </section>

            <!-- ============================== SALES ============================== -->
            <section v-else-if="route.path === '/sales'" class="page-view">
              <div class="white-panel table-panel panel-fill rise">
                <div class="toolbar">
                  <label class="date-field">
                    <CalendarDays :size="17" /><input v-model="salesFrom" type="date" aria-label="From date" /><span>–</span><input v-model="salesTo" type="date" aria-label="To date" />
                  </label>
                  <label class="search-field"><Search :size="18" /><input v-model="salesSearch" placeholder="Search transaction…" /></label>
                  <Transition name="fade">
                    <button v-if="salesFiltersActive" class="text-button clear-filters" @click="salesSearch = ''; salesFrom = ''; salesTo = ''"><FilterX :size="14" /> Clear</button>
                  </Transition>
                  <span class="toolbar-note push-right">{{ filteredTransactions.length }} sales · {{ money(filteredTransactions.reduce((sum, sale) => sum + sale.total, 0)) }}</span>
                </div>
                <div class="data-table transaction-table">
                  <div class="data-head">
                    <SortHead :table="salesTable" field="sold_at">Date</SortHead>
                    <SortHead :table="salesTable" field="id">Transaction #</SortHead>
                    <SortHead :table="salesTable" field="items">Items</SortHead>
                    <SortHead :table="salesTable" field="total">Total</SortHead>
                    <span>Cashier</span>
                  </div>
                  <button v-for="(transaction, index) in salesTable.rows" :key="transaction.id" class="data-row rise" :style="stagger(index)" @click="viewSale(transaction)">
                    <span class="ellipsis"><b>{{ transaction.date }}</b><em>{{ transaction.time }}</em></span>
                    <span class="link-text">{{ transaction.id }}</span>
                    <span>{{ transaction.items }}</span>
                    <b>{{ money(transaction.total) }}</b>
                    <span class="ellipsis">{{ transaction.cashier?.name || "—" }}</span>
                  </button>
                  <div v-if="!salesTable.total" class="empty-state">
                    <span class="empty-state-icon"><CircleDollarSign :size="20" /></span>
                    <b>{{ transactions.length ? "No sales match your filters" : "No sales yet" }}</b>
                    <small>{{ transactions.length ? "Try other dates or clear the filters." : "Completed sales from the POS appear here." }}</small>
                  </div>
                </div>
                <Pager :table="salesTable" />
              </div>
            </section>

            <!-- ============================== REPORTS ============================== -->
            <section v-else-if="route.path === '/reports'" class="page-view reports-view">
              <div class="report-filters white-panel rise">
                <div class="segmented">
                  <button v-for="option in [['overview', 'Overview'], ['sales', 'Sales'], ['inventory', 'Inventory'], ['movements', 'Movements']]" :key="option[0]" :class="{ selected: reportCategory === option[0] }" @click="reportCategory = option[0]">{{ option[1] }}</button>
                </div>
                <div class="report-range">
                  <label>From<input v-model="reportFrom" type="date" @change="reportPreset = null" /></label>
                  <label>To<input v-model="reportTo" type="date" @change="reportPreset = null" /></label>
                  <div class="segmented small">
                    <button v-for="days in [7, 30, 90]" :key="days" :class="{ selected: reportPreset === days }" @click="setReportRange(days)">{{ days }}d</button>
                    <button :class="{ selected: !reportFrom && !reportTo }" @click="clearReportRange">All</button>
                  </div>
                  <button class="button primary" :disabled="reportLoading" @click="reportPreset = null; loadReport()">Apply</button>
                </div>
              </div>

              <div v-if="reportCategory === 'overview'" class="metric-grid report-metrics">
                <article class="metric-card rise" :style="stagger(1)"><span class="metric-icon blue"><CircleDollarSign :size="21" /></span><div><small>Sales revenue</small><strong><CountUp :value="report.summary.total_sales" money /></strong><em>{{ report.summary.transaction_count || 0 }} transactions</em></div></article>
                <article class="metric-card rise" :style="stagger(2)"><span class="metric-icon green"><TrendingUp :size="21" /></span><div><small>Gross profit</small><strong><CountUp :value="report.summary.gross_profit" money /></strong><em title="Uses each product's current cost price">At current cost prices</em></div></article>
                <article class="metric-card rise" :style="stagger(3)"><span class="metric-icon blue"><ClipboardList :size="21" /></span><div><small>Units in stock</small><strong><CountUp :value="report.summary.inventory_units" /></strong><em>{{ report.summary.products_tracked || 0 }} products</em></div></article>
                <article class="metric-card rise" :style="stagger(4)"><span class="metric-icon yellow"><AlertTriangle :size="21" /></span><div><small>Stock alerts</small><strong><CountUp :value="(report.summary.low_stock_count || 0) + (report.summary.out_of_stock_count || 0)" /></strong><em>{{ report.summary.out_of_stock_count || 0 }} out of stock</em></div></article>
                <article class="metric-card rise" :style="stagger(5)"><span class="metric-icon blue"><ArrowDownToLine :size="21" /></span><div><small>Stock movements</small><strong><CountUp :value="(report.summary.stock_in_count || 0) + (report.summary.stock_out_count || 0)" /></strong><em>{{ report.summary.stock_in_count || 0 }} in · {{ report.summary.stock_out_count || 0 }} out</em></div></article>
              </div>

              <!-- One layout per tab, each fills the remaining height -->
              <div class="report-body fill-row" :class="`tab-${reportCategory}`">
                <section v-if="reportCategory !== 'movements'" v-show="reportCategory !== 'inventory'" class="white-panel chart-panel panel-fill area-chart rise" :style="stagger(6)">
                  <div class="panel-title">
                    <div><h2>Sales performance</h2><small class="panel-sub">{{ report.daily_sales.length }} active days · {{ money(report.summary.total_sales) }}</small></div>
                    <span class="date-chip">{{ reportFrom ? formatReportDate(reportFrom) : "All time" }}{{ reportTo ? ` – ${formatReportDate(reportTo)}` : "" }}</span>
                  </div>
                  <template v-if="report.daily_sales.length">
                    <div class="bar-chart data-bars">
                      <span v-for="item in report.daily_sales" :key="item.date" class="bar" :style="{ height: `${Math.max((Number(item.total) / reportChartMax) * 100, 4)}%` }" :data-tip="`${formatReportDate(item.date)}: ${money(item.total)}`"></span>
                    </div>
                    <div class="chart-labels"><span v-for="item in report.daily_sales" :key="item.date">{{ formatReportDate(item.date) }}</span></div>
                  </template>
                  <div v-else class="empty-state"><span class="empty-state-icon"><CircleDollarSign :size="20" /></span><b>No sales in this period</b><small>Try a wider date range.</small></div>
                </section>

                <section v-if="reportCategory === 'overview' || reportCategory === 'inventory'" class="white-panel inventory-status panel-fill area-health rise" :style="stagger(7)">
                  <div class="panel-title"><div><h2>Inventory health</h2><small class="panel-sub">Current stock status</small></div><Warehouse :size="20" class="muted-icon" /></div>
                  <div class="health-body">
                    <div class="donut data-donut" :style="donutStyle"><span class="donut-center"><b>{{ report.inventory.length }}</b><small>products</small></span></div>
                    <div class="legend">
                      <span><i class="green-dot"></i>Healthy <b>{{ reportInventoryStatus.healthy }}</b></span>
                      <span><i class="yellow-dot"></i>Low stock <b>{{ reportInventoryStatus.low }}</b></span>
                      <span><i class="red-dot"></i>Out of stock <b>{{ reportInventoryStatus.out }}</b></span>
                    </div>
                  </div>
                </section>

                <section v-if="reportCategory === 'overview' || reportCategory === 'inventory'" class="white-panel report-table-panel panel-fill area-low rise" :style="stagger(8)">
                  <div class="panel-title"><h2>Low-stock alerts</h2><span class="status-pill warn">{{ report.low_stock.length }} items</span></div>
                  <div v-if="report.low_stock.length" class="report-list scroll-area">
                    <div v-for="item in report.low_stock" :key="item.id" class="clickable" @click="openQuickView(item.id)">
                      <span class="product-thumb"><img v-if="item.image_data" :src="item.image_data" :alt="item.name" /><Package v-else :size="18" /></span>
                      <div class="ellipsis"><b>{{ item.name }}</b><small>{{ item.stock_on_hand }} left · reorder at {{ item.reorder_level }}</small></div>
                      <button class="chip-button" @click.stop="restock(item)"><PackagePlus :size="14" /> Restock</button>
                    </div>
                  </div>
                  <div v-else class="empty-state"><span class="empty-state-icon"><CircleCheck :size="20" /></span><b>Inventory is healthy</b><small>No items need attention.</small></div>
                </section>

                <section v-if="reportCategory === 'overview'" class="white-panel report-table-panel panel-fill area-activity rise" :style="stagger(9)">
                  <div class="panel-title"><h2>Recent stock activity</h2><button class="text-button" @click="reportCategory = 'movements'">See all {{ report.movements.length }}</button></div>
                  <div class="report-list scroll-area">
                    <div v-for="movement in report.movements.slice(0, 20)" :key="movement.id">
                      <span class="movement-type" :class="movement.type"><ArrowUpFromLine v-if="movement.type === 'stock_in'" :size="16" /><ArrowDownToLine v-else :size="16" /></span>
                      <div class="ellipsis"><b>{{ movement.product?.name }}</b><small>{{ movementLabel(movement.type) }} · {{ movement.quantity }} units</small></div>
                      <span>{{ timeAgo(movement.created_at) }}</span>
                    </div>
                    <div v-if="!report.movements.length" class="empty-state"><span class="empty-state-icon"><Box :size="20" /></span><b>No movement records</b><small>Stock activity will appear here.</small></div>
                  </div>
                </section>

                <section v-if="reportCategory === 'sales'" class="white-panel table-panel panel-fill area-table rise" :style="stagger(7)">
                  <div class="panel-title"><div><h2>Transactions</h2><small class="panel-sub">{{ report.sales.length }} in this range</small></div></div>
                  <div class="data-table transaction-table">
                    <div class="data-head"><span>Date</span><span>Transaction #</span><span>Items</span><span>Total</span><span>Cashier</span></div>
                    <button v-for="sale in report.sales" :key="sale.id" class="data-row" @click="viewSale(sale)">
                      <span>{{ formatDateTime(sale.sold_at) }}</span>
                      <span class="link-text">{{ sale.transaction_number }}</span>
                      <span>{{ sale.items?.reduce((sum, item) => sum + item.quantity, 0) || 0 }}</span>
                      <b>{{ money(sale.total_amount) }}</b>
                      <span class="ellipsis">{{ sale.cashier?.name || "—" }}</span>
                    </button>
                    <div v-if="!report.sales.length" class="empty-state"><b>No transactions found</b><small>Sales in the selected dates appear here.</small></div>
                  </div>
                </section>

                <section v-if="reportCategory === 'movements'" class="white-panel table-panel panel-fill area-table rise" :style="stagger(6)">
                  <div class="panel-title"><div><h2>Stock movements</h2><small class="panel-sub">{{ report.movements.length }} records (latest 200)</small></div></div>
                  <div class="data-table movement-table">
                    <div class="data-head"><span>Date</span><span>Product</span><span>Type</span><span>Qty</span><span>After</span><span>By</span><span>Notes</span></div>
                    <div v-for="movement in report.movements" :key="movement.id" class="data-row">
                      <span>{{ formatDateTime(movement.created_at) }}</span>
                      <span class="ellipsis"><b>{{ movement.product?.name || "—" }}</b></span>
                      <span><strong class="status-pill" :class="movement.type === 'stock_in' ? 'good' : movement.type === 'sale' ? '' : 'bad'">{{ movementLabel(movement.type) }}</strong></span>
                      <b :class="movement.type === 'stock_in' ? 'plus' : 'minus'">{{ movement.type === "stock_in" ? "+" : "−" }}{{ movement.quantity }}</b>
                      <span>{{ movement.quantity_after }}</span>
                      <span class="ellipsis">{{ movement.user?.name || "—" }}</span>
                      <span class="ellipsis" :title="movement.notes">{{ movement.notes || "—" }}</span>
                    </div>
                    <div v-if="!report.movements.length" class="empty-state"><b>No movement records</b><small>Stock activity in this range appears here.</small></div>
                  </div>
                </section>
              </div>
            </section>

            <!-- ============================== STAFF ============================== -->
            <section v-else-if="route.path === '/users'" class="page-view admin-page">
              <div class="admin-stats">
                <article class="admin-stat rise" :style="stagger(0)"><span class="metric-icon blue"><Users :size="19" /></span><div><small>Team members</small><strong><CountUp :value="staffStats.total" /></strong></div></article>
                <article class="admin-stat rise" :style="stagger(1)"><span class="metric-icon green"><UserCheck :size="19" /></span><div><small>Active accounts</small><strong><CountUp :value="staffStats.active" /></strong></div></article>
                <article class="admin-stat rise" :style="stagger(2)"><span class="metric-icon yellow"><KeyRound :size="19" /></span><div><small>Administrators</small><strong><CountUp :value="staffStats.admins" /></strong></div></article>
              </div>
              <div class="white-panel table-panel panel-fill rise" :style="stagger(3)">
                <div class="toolbar">
                  <label class="search-field"><Search :size="18" /><input v-model="staffSearch" placeholder="Search staff…" /></label>
                </div>
                <div class="data-table staff-table">
                  <div class="data-head">
                    <SortHead :table="staffTable" field="name">Name</SortHead>
                    <SortHead :table="staffTable" field="email">Email</SortHead>
                    <SortHead :table="staffTable" field="role">Role</SortHead>
                    <SortHead :table="staffTable" field="status">Status</SortHead>
                    <span>Actions</span>
                  </div>
                  <div v-for="(person, index) in staffTable.rows" :key="person.id" class="data-row rise" role="button" tabindex="0" :style="stagger(index)" @click="openProfile(person)" @keydown.enter="openProfile(person)">
                    <span class="person-cell"><span class="avatar-chip">{{ initials(person.name) }}</span><b class="ellipsis">{{ person.name }}<em v-if="person.id === currentUser?.id" class="you-tag">You</em></b></span>
                    <span class="ellipsis">{{ person.email }}</span>
                    <span>{{ person.role }}</span>
                    <span><strong class="status-pill" :class="person.status === 'Active' ? 'good' : 'bad'">{{ person.status }}</strong></span>
                    <span class="row-actions" @click.stop>
                      <button type="button" title="View profile" aria-label="View profile" @click="openProfile(person)"><Eye :size="17" /></button>
                      <template v-if="person.id !== currentUser?.id">
                        <button type="button" :title="person.status === 'Active' ? 'Deactivate account' : 'Activate account'" :aria-label="person.status === 'Active' ? 'Deactivate' : 'Activate'" :class="person.status === 'Active' ? 'warn' : 'good'" @click="toggleStaff(person)"><Power :size="17" /></button>
                        <button type="button" title="Delete account" aria-label="Delete" class="danger" @click="deleteStaff(person)"><Trash2 :size="17" /></button>
                      </template>
                    </span>
                  </div>
                  <div v-if="!staffTable.total" class="empty-state"><span class="empty-state-icon"><Users :size="20" /></span><b>No staff found</b><small>Try a different name or email.</small></div>
                </div>
                <Pager :table="staffTable" />
              </div>
            </section>

            <!-- ============================== CATALOG ============================== -->
            <section v-else-if="route.path === '/catalog'" class="page-view">
              <div class="white-panel table-panel panel-fill rise">
                <div class="toolbar">
                  <div class="segmented">
                    <button :class="{ selected: catalogTab === 'categories' }" @click="catalogTab = 'categories'"><Tags :size="15" /> Categories <span class="seg-count">{{ categories.length }}</span></button>
                    <button :class="{ selected: catalogTab === 'suppliers' }" @click="catalogTab = 'suppliers'"><Truck :size="15" /> Suppliers <span class="seg-count">{{ suppliers.length }}</span></button>
                  </div>
                  <label class="search-field push-right"><Search :size="18" /><input v-model="catalogSearch" :placeholder="`Search ${catalogTab}…`" /></label>
                </div>
                <TransitionGroup name="list" tag="div" class="catalog-grid scroll-area">
                  <button key="add" class="add-card" @click="openCatalogForm()">
                    <Plus :size="22" /><b>Add {{ catalogTab === "categories" ? "category" : "supplier" }}</b>
                  </button>
                  <article v-for="item in catalogItems" :key="`${catalogTab}-${item.id}`" class="catalog-card" :class="{ inactive: !item.is_active }">
                    <div class="catalog-card-top">
                      <span class="metric-icon" :class="item.is_active ? 'blue' : 'muted'"><Tags v-if="catalogTab === 'categories'" :size="18" /><Truck v-else :size="18" /></span>
                      <strong class="status-pill" :class="item.is_active ? 'good' : 'bad'">{{ item.is_active ? "Active" : "Inactive" }}</strong>
                    </div>
                    <b class="ellipsis">{{ item.name }}</b>
                    <small v-if="catalogTab === 'categories'" class="ellipsis">{{ item.description || "No description" }}</small>
                    <small v-else class="ellipsis">{{ [item.contact_person, item.phone].filter(Boolean).join(" · ") || "No contact details" }}</small>
                    <div class="catalog-card-foot">
                      <span v-if="catalogTab === 'categories'">{{ productCountByCategory[item.id] || 0 }} products</span>
                      <span v-else class="ellipsis">{{ item.email || "No email" }}</span>
                      <span class="row-actions">
                        <button title="Edit" aria-label="Edit" @click="openCatalogForm(item)"><Pencil :size="16" /></button>
                        <button :title="item.is_active ? 'Deactivate' : 'Activate'" :aria-label="item.is_active ? 'Deactivate' : 'Activate'" :class="item.is_active ? 'warn' : 'good'" @click="toggleCatalogItem(item)"><Power :size="16" /></button>
                      </span>
                    </div>
                  </article>
                </TransitionGroup>
              </div>
            </section>

            <!-- ============================== STOCK IN / ADJUST ============================== -->
            <section v-else-if="route.path === '/stock-in' || route.path === '/adjust-stock'" class="page-view">
              <div class="white-panel form-panel panel-fill rise">
                <form class="form-fields scroll-area" @submit.prevent="submitStockMovement">
                  <div class="form-heading">
                    <span class="form-heading-icon"><ArrowUpFromLine v-if="isStockIn" :size="20" /><SlidersHorizontal v-else :size="20" /></span>
                    <div>
                      <span class="eyebrow">{{ isStockIn ? "Inventory receiving" : "Inventory control" }}</span>
                      <h2>{{ isStockIn ? "Add stock to inventory" : "Record a stock adjustment" }}</h2>
                      <p>{{ isStockIn ? "Log incoming parts so stock stays accurate." : "Remove damaged, lost, or miscounted units." }}</p>
                    </div>
                  </div>
                  <label>Product*
                    <ProductPicker v-model="stockForm.product_id" :products="products" />
                  </label>
                  <div class="form-row">
                    <label v-if="isStockIn">
                      <span class="label-row">Supplier*<button type="button" class="text-button" @click="router.push({ path: '/catalog', query: { tab: 'suppliers' } })">Manage</button></span>
                      <OptionPicker v-model="stockForm.supplier_id" placeholder="Select supplier…" :options="activeSuppliers.map((s) => ({ value: s.id, label: s.name }))" />
                    </label>
                    <label v-else>Adjustment type*
                      <OptionPicker v-model="adjustType" :options="['Damage / Loss', 'Stock correction', 'Returned to supplier']" />
                    </label>
                    <label>Quantity*<input v-model.number="stockForm.quantity" type="number" min="1" step="1" /></label>
                  </div>
                  <Transition name="fade">
                    <div v-if="selectedStockProduct" class="selected-product">
                      <span class="product-thumb"><img v-if="selectedStockProduct.image_data" :src="selectedStockProduct.image_data" :alt="selectedStockProduct.name" /><Package v-else :size="20" /></span>
                      <div class="ellipsis"><b>{{ selectedStockProduct.name }}</b><small>{{ selectedStockProduct.sku }} · {{ selectedStockProduct.quantity }} now</small></div>
                      <span class="after-save" :class="{ bad: stockAfterSave < 0 }">→ {{ stockAfterSave }}</span>
                    </div>
                  </Transition>
                  <label v-if="isStockIn">Reference<input v-model="stockForm.reference" placeholder="Supplier invoice or delivery number" /></label>
                  <label>{{ isStockIn ? "Notes" : "Reason*" }}<textarea v-model="stockForm.reason" :placeholder="isStockIn ? 'Optional notes…' : 'e.g. Box crushed during delivery'"></textarea></label>
                  <div class="form-actions">
                    <button type="button" class="button outline" @click="stockForm = emptyStockForm()">Reset</button>
                    <button class="button primary" :disabled="stockSaving"><RefreshCw v-if="stockSaving" :size="16" class="spinning" />Save {{ isStockIn ? "stock in" : "adjustment" }}</button>
                  </div>
                </form>
                <div class="white-panel helper-panel">
                  <div class="helper-heading"><span class="helper-icon"><ClipboardList :size="18" /></span><span class="eyebrow">Activity log</span></div>
                  <h2>{{ isStockIn ? "Recent stock in" : "Adjustment history" }}</h2>
                  <p>The latest {{ isStockIn ? "deliveries" : "adjustments" }}, newest first.</p>
                  <TransitionGroup name="list" tag="div" class="movement-list scroll-area">
                    <div v-for="movement in pageMovements" :key="movement.id">
                      <span class="movement-product-thumb product-thumb"><img v-if="imageFor(movement.product_id)" :src="imageFor(movement.product_id)" :alt="movement.product?.name" /><Package v-else :size="16" /></span>
                      <b class="ellipsis">{{ movement.product?.name }}</b>
                      <span class="movement-meta ellipsis"><em :class="isStockIn ? 'plus' : 'minus'">{{ isStockIn ? "+" : "−" }}{{ movement.quantity }}</em> · {{ timeAgo(movement.created_at) }}<template v-if="movement.notes"> · {{ movement.notes }}</template></span>
                    </div>
                    <div v-if="!pageMovements.length" key="empty" class="empty-state">
                      <span class="empty-state-icon"><Box :size="20" /></span><b>No activity yet</b><small>Saved {{ isStockIn ? "stock-ins" : "adjustments" }} appear here.</small>
                    </div>
                  </TransitionGroup>
                </div>
              </div>
            </section>

            <!-- ============================== PROFILE ============================== -->
            <section v-else-if="route.path.includes('/profile')" class="page-view profile-view">
              <div class="profile-layout">
                <section class="white-panel profile-card rise">
                  <span class="profile-avatar">{{ initials(viewedProfile?.name || currentUser?.name) }}</span>
                  <h2>{{ viewedProfile?.name || currentUser?.name }}</h2>
                  <strong class="profile-role">{{ (viewedProfile || currentUser)?.role === "admin" ? "Administrator" : "Staff member" }}</strong>
                  <p>{{ viewedProfile?.email || currentUser?.email }}</p>
                  <strong class="status-pill" :class="(viewedProfile || currentUser)?.is_active === false ? 'bad' : 'good'">{{ (viewedProfile || currentUser)?.is_active === false ? "Inactive" : "Active" }}</strong>
                </section>
                <section class="white-panel profile-details rise" :style="stagger(1)">
                  <div class="panel-title">
                    <h2>Account details</h2>
                    <div class="title-actions">
                      <button v-if="route.name === 'user-profile'" class="button outline" @click="router.push('/users')"><ChevronLeft :size="16" /> Team</button>
                      <button v-if="(viewedProfile?.id || currentUser?.id) === currentUser?.id" class="button outline" @click="beginProfileEdit"><Pencil :size="15" /> Edit profile</button>
                      <button v-else-if="isAdmin" class="button outline" @click="openResetPassword"><KeyRound :size="15" /> Reset password</button>
                    </div>
                  </div>
                  <dl>
                    <div><dt>Full name</dt><dd>{{ viewedProfile?.name || currentUser?.name }}</dd></div>
                    <div><dt>Email address</dt><dd>{{ viewedProfile?.email || currentUser?.email }}</dd></div>
                    <div><dt>Role</dt><dd>{{ (viewedProfile || currentUser)?.role === "admin" ? "Administrator" : "Staff" }}</dd></div>
                    <div><dt>Account created</dt><dd>{{ (viewedProfile || currentUser)?.created_at ? parseApiDate((viewedProfile || currentUser).created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—" }}</dd></div>
                  </dl>
                </section>
              </div>
            </section>

            <!-- ============================== NOTIFICATIONS ============================== -->
            <section v-else-if="route.path === '/notifications'" class="page-view">
              <div class="white-panel notification-panel panel-fill rise">
                <div class="notification-tabs">
                  <div class="segmented">
                    <button :class="{ selected: notificationTab === 'alerts' }" @click="notificationTab = 'alerts'">
                      Alerts <span v-if="alertNotifications.filter((item) => !item.is_read).length" class="seg-count">{{ alertNotifications.filter((item) => !item.is_read).length }}</span>
                    </button>
                    <button :class="{ selected: notificationTab === 'announcements' }" @click="notificationTab = 'announcements'">
                      Announcements <span v-if="announcementNotifications.filter((item) => !item.is_read).length" class="seg-count">{{ announcementNotifications.filter((item) => !item.is_read).length }}</span>
                    </button>
                  </div>
                  <div class="title-actions push-right">
                    <button class="text-button" :disabled="!unreadCount" @click="markAllNotificationsRead">Mark all as read</button>
                    <button v-if="isAdmin" class="button primary" @click="openAnnouncement"><Megaphone :size="16" /> Announce</button>
                  </div>
                </div>
                <TransitionGroup name="list" tag="div" class="scroll-area">
                  <div v-for="notification in visibleNotifications" :key="notification.id" class="notification-row" :class="{ unread: !notification.is_read }" @click="markNotificationRead(notification)">
                    <span class="metric-icon" :class="notificationTone(notification)"><component :is="notificationIcon(notification)" :size="18" /></span>
                    <div class="notification-text"><b>{{ notification.title }}</b><small>{{ notification.message }}</small></div>
                    <span class="notification-time" :title="formatDateTime(notification.created_at)">{{ timeAgo(notification.created_at) }}</span>
                    <button v-if="notification.type !== 'announcement' || isAdmin" class="notification-delete" title="Delete notification" aria-label="Delete notification" @click.stop="deleteNotification(notification)"><Trash2 :size="15" /></button>
                    <span v-else></span>
                  </div>
                  <div v-if="!visibleNotifications.length" key="empty" class="empty-state">
                    <span class="empty-state-icon"><Megaphone v-if="notificationTab === 'announcements'" :size="20" /><Bell v-else :size="20" /></span>
                    <b>{{ notificationTab === "alerts" ? "No alerts" : "No announcements" }}</b>
                    <small>{{ notificationTab === "alerts" ? "Stock and system alerts appear here." : isAdmin ? "Post one to inform the whole team." : "News from your admin appears here." }}</small>
                  </div>
                </TransitionGroup>
              </div>
            </section>
          </div>
        </Transition>
      </div>
    </main>
  </div>

  <!-- ============================== DIALOGS ============================== -->
  <Transition name="modal">
    <div v-if="showProductModal" class="modal-backdrop" @click.self="showProductModal = false">
      <form class="modal wide product-modal" @submit.prevent="submitProduct">
        <button type="button" class="modal-close" aria-label="Close" @click="showProductModal = false"><X :size="18" /></button>
        <h2>{{ editingProductId ? "Edit product" : "Add product" }}</h2>
        <div class="image-upload">
          <span class="product-preview product-thumb large"><img v-if="newProduct.image_data" :src="newProduct.image_data" alt="Selected product" /><Package v-else :size="32" /></span>
          <div>
            <b>Product picture</b><small>JPG, PNG, WEBP, or GIF · max 5 MB</small>
            <div class="upload-row">
              <label class="upload-button"><Upload :size="16" /> Choose image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="uploadProductImage" /></label>
              <button v-if="newProduct.image_data" type="button" class="text-button danger-text" @click="newProduct.image_data = ''">Remove</button>
            </div>
          </div>
        </div>
        <div class="modal-grid">
          <label class="span-2">Product name*<input v-model="newProduct.name" placeholder="e.g. Clutch cable" /></label>
          <label>SKU*<input v-model="newProduct.sku" placeholder="e.g. CLT-001" /></label>
          <label>Barcode<input v-model="newProduct.barcode" placeholder="Scan or type" /></label>
          <label>Brand<input v-model="newProduct.brand" placeholder="e.g. Honda" /></label>
          <label>Category*
            <select v-model="newProduct.category_id">
              <option value="" disabled>Select category…</option>
              <option v-for="category in activeCategories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
          </label>
          <label>Selling price*<input v-model.number="newProduct.price" type="number" min="0" step="0.01" /></label>
          <label>Cost price<input v-model.number="newProduct.cost_price" type="number" min="0" step="0.01" /></label>
          <label>{{ editingProductId ? "Stock (use Stock In)" : "Opening stock" }}<input v-model.number="newProduct.quantity" type="number" min="0" :disabled="Boolean(editingProductId)" /></label>
          <label>Reorder level<input v-model.number="newProduct.reorder_level" type="number" min="0" /></label>
        </div>
        <p v-if="newProduct.price && newProduct.cost_price" class="hint">Margin per unit: <b>{{ money(newProduct.price - newProduct.cost_price) }}</b></p>
        <Transition name="fade"><p v-if="modalError" class="auth-error"><CircleX :size="15" /> {{ modalError }}</p></Transition>
        <button class="button primary wide">{{ editingProductId ? "Update product" : "Save product" }}</button>
      </form>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showStaffModal" class="modal-backdrop" @click.self="showStaffModal = false">
      <form class="modal staff-modal" @submit.prevent="submitStaff">
        <button type="button" class="modal-close" aria-label="Close" @click="showStaffModal = false"><X :size="18" /></button>
        <h2>Add staff</h2>
        <label>Full name<input v-model="newStaff.name" /></label>
        <label>Email<input v-model="newStaff.email" type="email" /></label>
        <label>Password
          <span class="password-field">
            <input v-model="newStaff.password" :type="revealPasswords ? 'text' : 'password'" placeholder="At least 8 characters" autocomplete="new-password" />
            <button type="button" class="eye-button" :aria-label="revealPasswords ? 'Hide password' : 'Show password'" @click="revealPasswords = !revealPasswords"><EyeOff v-if="revealPasswords" :size="17" /><Eye v-else :size="17" /></button>
          </span>
        </label>
        <div class="segmented full">
          <button type="button" :class="{ selected: newStaff.role === 'staff' }" @click="newStaff.role = 'staff'">Staff</button>
          <button type="button" :class="{ selected: newStaff.role === 'admin' }" @click="newStaff.role = 'admin'">Admin</button>
        </div>
        <Transition name="fade"><p v-if="modalError" class="auth-error"><CircleX :size="15" /> {{ modalError }}</p></Transition>
        <button class="button primary wide">Create account</button>
      </form>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showProfileEdit" class="modal-backdrop" @click.self="showProfileEdit = false">
      <form class="modal" @submit.prevent="saveProfile">
        <button type="button" class="modal-close" aria-label="Close" @click="showProfileEdit = false"><X :size="18" /></button>
        <h2>Edit profile</h2>
        <label>Full name<input v-model="profileForm.name" required /></label>
        <label>Email<input v-model="profileForm.email" type="email" required /></label>
        <label>New password (optional)
          <span class="password-field">
            <input v-model="profileForm.password" :type="revealPasswords ? 'text' : 'password'" placeholder="Leave blank to keep" autocomplete="new-password" />
            <button type="button" class="eye-button" :aria-label="revealPasswords ? 'Hide password' : 'Show password'" @click="revealPasswords = !revealPasswords"><EyeOff v-if="revealPasswords" :size="17" /><Eye v-else :size="17" /></button>
          </span>
        </label>
        <Transition name="fade"><p v-if="modalError" class="auth-error"><CircleX :size="15" /> {{ modalError }}</p></Transition>
        <button class="button primary wide">Save changes</button>
      </form>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showResetPassword" class="modal-backdrop" @click.self="showResetPassword = false">
      <form class="modal" @submit.prevent="submitResetPassword">
        <button type="button" class="modal-close" aria-label="Close" @click="showResetPassword = false"><X :size="18" /></button>
        <h2>Reset password</h2>
        <p class="modal-text">Set a new password for <b>{{ viewedProfile?.name }}</b>, then share it with them privately.</p>
        <label>New password
          <span class="password-field">
            <input v-model="resetPasswordValue" :type="revealPasswords ? 'text' : 'password'" placeholder="At least 8 characters" autocomplete="new-password" />
            <button type="button" class="eye-button" :aria-label="revealPasswords ? 'Hide password' : 'Show password'" @click="revealPasswords = !revealPasswords"><EyeOff v-if="revealPasswords" :size="17" /><Eye v-else :size="17" /></button>
          </span>
        </label>
        <Transition name="fade"><p v-if="modalError" class="auth-error"><CircleX :size="15" /> {{ modalError }}</p></Transition>
        <button class="button primary wide">Reset password</button>
      </form>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="catalogForm" class="modal-backdrop" @click.self="catalogForm = null">
      <form class="modal catalog-modal" @submit.prevent="saveCatalogItem">
        <button type="button" class="modal-close" aria-label="Close" @click="catalogForm = null"><X :size="18" /></button>
        <h2>{{ catalogForm.id ? "Edit" : "Add" }} {{ catalogForm.kind === "categories" ? "category" : "supplier" }}</h2>
        <label>Name*<input v-model="catalogForm.name" :placeholder="catalogForm.kind === 'categories' ? 'e.g. Brakes' : 'e.g. Moto Supply Co.'" /></label>
        <template v-if="catalogForm.kind === 'categories'">
          <label>Description<input v-model="catalogForm.description" placeholder="Optional" /></label>
        </template>
        <template v-else>
          <div class="modal-grid">
            <label>Contact person<input v-model="catalogForm.contact_person" /></label>
            <label>Phone<input v-model="catalogForm.phone" /></label>
          </div>
          <label>Email<input v-model="catalogForm.email" type="email" /></label>
          <label>Address<input v-model="catalogForm.address" /></label>
        </template>
        <Transition name="fade"><p v-if="modalError" class="auth-error"><CircleX :size="15" /> {{ modalError }}</p></Transition>
        <button class="button primary wide">Save</button>
      </form>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="announcementForm" class="modal-backdrop" @click.self="announcementForm = null">
      <form class="modal" @submit.prevent="postAnnouncement">
        <button type="button" class="modal-close" aria-label="Close" @click="announcementForm = null"><X :size="18" /></button>
        <h2>Post announcement</h2>
        <p class="modal-text">Everyone on the team will see this in Notifications.</p>
        <label>Title<input v-model="announcementForm.title" maxlength="150" placeholder="e.g. Inventory count on Saturday" /></label>
        <label>Message<textarea v-model="announcementForm.message" maxlength="500" rows="4" placeholder="Write the details…"></textarea></label>
        <Transition name="fade"><p v-if="modalError" class="auth-error"><CircleX :size="15" /> {{ modalError }}</p></Transition>
        <button class="button primary wide"><Send :size="16" /> Post</button>
      </form>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showForgot" class="modal-backdrop" @click.self="showForgot = false">
      <div class="modal">
        <button class="modal-close" aria-label="Close" @click="showForgot = false"><X :size="18" /></button>
        <span class="metric-icon blue"><KeyRound :size="20" /></span>
        <h2>Forgot your password?</h2>
        <p class="modal-text">Ask a store administrator to reset it from <b>Manage Staff → View profile → Reset password</b>. Then sign in with the new password.</p>
        <button class="button primary wide" @click="showForgot = false">Got it</button>
      </div>
    </div>
  </Transition>

  <!-- Product quick view (click any product row) -->
  <Transition name="modal">
    <div v-if="quickView" class="modal-backdrop" @click.self="quickViewId = null">
      <div class="modal wide quick-view">
        <button class="modal-close" aria-label="Close" @click="quickViewId = null"><X :size="18" /></button>
        <div class="qv-top">
          <span class="product-thumb qv-image"><img v-if="quickView.image_data" :src="quickView.image_data" :alt="quickView.name" /><Package v-else :size="48" /></span>
          <div class="qv-info">
            <span class="eyebrow">{{ quickView.category }}</span>
            <h2>{{ quickView.name }}</h2>
            <small>{{ quickView.brand }} · SKU {{ quickView.sku }}<template v-if="quickView.barcode"> · {{ quickView.barcode }}</template></small>
            <strong class="status-pill" :class="statusTone(quickView)">{{ statusFor(quickView) }}</strong>
            <dl class="qv-prices">
              <div><dt>Price</dt><dd>{{ money(quickView.price) }}</dd></div>
              <div><dt>Cost</dt><dd>{{ money(quickView.cost_price) }}</dd></div>
              <div><dt>Margin</dt><dd>{{ money(quickView.price - quickView.cost_price) }}</dd></div>
            </dl>
          </div>
        </div>
        <div class="qv-stock">
          <div class="label-row"><b>{{ quickView.quantity }} in stock</b><small>Reorder at {{ quickView.reorder_level }}</small></div>
          <div class="stock-bar" :class="statusTone(quickView)"><span :style="{ width: `${Math.min((quickView.quantity / Math.max(quickView.reorder_level * 3, 1)) * 100, 100)}%` }"></span></div>
        </div>
        <div>
          <h3 class="qv-heading">Recent movements</h3>
          <div class="qv-movements">
            <div v-for="movement in quickViewMovements" :key="movement.id">
              <span class="movement-type" :class="movement.type"><ArrowUpFromLine v-if="movement.type === 'stock_in'" :size="14" /><ArrowDownToLine v-else :size="14" /></span>
              <span>{{ movementLabel(movement.type) }}</span>
              <b :class="movement.type === 'stock_in' ? 'plus' : 'minus'">{{ movement.type === "stock_in" ? "+" : "−" }}{{ movement.quantity }}</b>
              <small>{{ timeAgo(movement.created_at) }}</small>
            </div>
            <p v-if="!quickViewMovements.length" class="hint">No movements recorded yet.</p>
          </div>
        </div>
        <div v-if="isAdmin" class="receipt-actions">
          <button class="button outline" @click="editProduct(quickView); quickViewId = null"><Pencil :size="15" /> Edit</button>
          <button class="button primary" @click="restock(quickView); quickViewId = null"><PackagePlus :size="16" /> Restock</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Receipt (after checkout, or when opening a past sale) -->
  <Transition name="modal">
    <div v-if="receipt" class="modal-backdrop" @click.self="receipt = null">
      <div class="modal receipt-modal">
        <button class="modal-close no-print" aria-label="Close" @click="receipt = null"><X :size="18" /></button>
        <div v-if="receipt.fresh" class="receipt-success no-print"><CircleCheck :size="22" /> Sale completed</div>
        <div class="print-area">
          <div class="receipt-head">
            <img :src="bszLogo" alt="" />
            <b>BSZ Motorcycle Parts &amp; Accessories</b>
            <small>{{ receipt.sale.transaction_number }} · {{ formatDateTime(receipt.sale.sold_at) }}</small>
            <small v-if="receipt.sale.cashier">Cashier: {{ receipt.sale.cashier.name }}</small>
          </div>
          <table class="receipt-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
            <tbody>
              <tr v-for="item in receipt.sale.items" :key="item.id">
                <td>{{ item.product?.name || "Item" }}<small>{{ money(item.unit_price) }} each</small></td>
                <td>{{ item.quantity }}</td>
                <td>{{ money(item.line_total) }}</td>
              </tr>
            </tbody>
          </table>
          <dl class="receipt-totals">
            <div class="grand"><dt>Total</dt><dd>{{ money(receipt.sale.total_amount) }}</dd></div>
            <div><dt>Cash</dt><dd>{{ money(receipt.sale.payment_amount) }}</dd></div>
            <div><dt>Change</dt><dd>{{ money(receipt.sale.change_amount) }}</dd></div>
          </dl>
          <p class="receipt-thanks">Thank you for your purchase!</p>
        </div>
        <div class="receipt-actions no-print">
          <button class="button outline" @click="printReceipt"><Printer :size="16" /> Print</button>
          <button v-if="receipt.fresh" class="button primary" @click="receipt = null"><Plus :size="16" /> New sale</button>
          <button v-else class="button primary" @click="receipt = null">Done</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Confirm dialog (replaces the browser's confirm popup) -->
  <Transition name="modal">
    <div v-if="confirmDialog" class="modal-backdrop confirm-layer" @click.self="closeConfirm(false)">
      <div class="modal confirm-modal" role="alertdialog" aria-modal="true">
        <span class="metric-icon" :class="confirmDialog.danger ? 'red' : 'blue'"><AlertTriangle v-if="confirmDialog.danger" :size="20" /><Info v-else :size="20" /></span>
        <h2>{{ confirmDialog.title }}</h2>
        <p class="modal-text">{{ confirmDialog.message }}</p>
        <div class="confirm-actions">
          <button class="button outline" @click="closeConfirm(false)">Cancel</button>
          <button class="button" :class="confirmDialog.danger ? 'danger' : 'primary'" @click="closeConfirm(true)">{{ confirmDialog.confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Toasts -->
  <TransitionGroup name="toast" tag="div" class="toast-stack" aria-live="polite">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
      <CircleCheck v-if="toast.type === 'success'" :size="18" /><CircleX v-else-if="toast.type === 'error'" :size="18" /><Info v-else :size="18" />
      <span>{{ toast.message }}</span>
      <button aria-label="Dismiss" @click="dismissToast(toast.id)"><X :size="14" /></button>
    </div>
  </TransitionGroup>
</template>
