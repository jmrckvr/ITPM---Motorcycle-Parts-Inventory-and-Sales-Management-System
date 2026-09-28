<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Users,
  Warehouse,
} from "@lucide/vue";
import api from "./services/api";

const route = useRoute();
const router = useRouter();
const mobileMenuOpen = ref(false);
const authForm = ref({
  email: "admin@motoparts.test",
  password: "password123",
});
const authError = ref("");
const authLoading = ref(false);

const currentUser = computed(() => {
  try {
    return JSON.parse(sessionStorage.getItem("auth_user") || "null") || {};
  } catch {
    return {};
  }
});

const isAuthenticated = computed(() =>
  Boolean(sessionStorage.getItem("auth_token")),
);

const userInitials = computed(() => {
  const name = currentUser.value?.name || "Alex Dela Cruz";

  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
});

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Products", to: "/products", icon: Package },
  { label: "Inventory", to: "/inventory", icon: Warehouse },
  { label: "Point of sale", to: "/pos", icon: ShoppingCart },
  { label: "Sales history", to: "/sales", icon: ClipboardList },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Users", to: "/users", icon: Users, adminOnly: true },
];

const activeSection = computed(() => route.path.split("/")[1] || "dashboard");
const pageTitle = computed(
  () =>
    navigation.find((item) => item.to.includes(activeSection.value))?.label ||
    "Dashboard",
);

const stats = [
  {
    label: "Today's sales",
    value: "₱24,680",
    detail: "+12.4% from yesterday",
    tone: "teal",
    icon: CircleDollarSign,
  },
  {
    label: "Items in stock",
    value: "1,284",
    detail: "Across 8 categories",
    tone: "blue",
    icon: Package,
  },
  {
    label: "Low stock items",
    value: "18",
    detail: "Needs replenishment",
    tone: "amber",
    icon: AlertTriangle,
  },
];

const lowStock = [
  {
    sku: "BRK-014",
    name: "Ceramic brake pads",
    category: "Braking",
    stock: 3,
    reorder: 10,
  },
  {
    sku: "OIL-008",
    name: "10W-40 engine oil",
    category: "Lubricants",
    stock: 5,
    reorder: 12,
  },
  {
    sku: "CHN-022",
    name: "428H drive chain",
    category: "Drivetrain",
    stock: 6,
    reorder: 8,
  },
];

const recentSales = [
  {
    id: "#TX-1048",
    time: "10:42 AM",
    cashier: "Maria Santos",
    amount: "₱2,450",
  },
  { id: "#TX-1047", time: "10:18 AM", cashier: "Joel Ramos", amount: "₱1,280" },
  { id: "#TX-1046", time: "09:56 AM", cashier: "Maria Santos", amount: "₱860" },
];

const syncAuthRoute = () => {
  const hasToken = Boolean(sessionStorage.getItem("auth_token"));

  if (!hasToken && route.path !== "/login") {
    router.replace("/login");
  }

  if (hasToken && route.path === "/login") {
    router.replace("/");
  }
};

onMounted(() => {
  syncAuthRoute();
});

router.beforeEach((to, _from, next) => {
  const hasToken = Boolean(sessionStorage.getItem("auth_token"));

  if (!hasToken && to.path !== "/login") {
    next("/login");
    return;
  }

  if (hasToken && to.path === "/login") {
    next("/");
    return;
  }

  next();
});

async function submitLogin() {
  authLoading.value = true;
  authError.value = "";

  try {
    const { data } = await api.post("/auth/login", authForm.value);
    sessionStorage.setItem("auth_token", data.token);
    sessionStorage.setItem("auth_user", JSON.stringify(data.user));
    await router.push("/");
  } catch (error) {
    authError.value =
      error.response?.data?.message ||
      error.response?.data?.errors?.email?.[0] ||
      "Unable to sign in. Please check your email and password.";
  } finally {
    authLoading.value = false;
  }
}

async function logout() {
  try {
    if (sessionStorage.getItem("auth_token")) {
      await api.post("/auth/logout");
    }
  } catch (error) {
    console.warn("Logout request failed", error);
  } finally {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("auth_user");
    await router.push("/login");
  }
}
</script>

<template>
  <div v-if="!isAuthenticated || route.path === '/login'" class="auth-screen">
    <div class="auth-panel">
      <div class="brand-lockup auth-brand">
        <div class="brand-mark">MP</div>
        <div>
          <p class="brand-name">MotoParts</p>
          <p class="brand-caption">Inventory desk</p>
        </div>
      </div>
      <p class="eyebrow">Staff workspace</p>
      <h1>Welcome back<span class="heading-dot">.</span></h1>
      <p class="heading-copy">
        Sign in to manage parts, stock movements, and cashier transactions.
      </p>
      <form class="login-form" @submit.prevent="submitLogin">
        <label>
          Email address
          <input
            v-model="authForm.email"
            type="email"
            placeholder="you@motoparts.local"
            autocomplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            v-model="authForm.password"
            type="password"
            placeholder="Enter your password"
            autocomplete="current-password"
            required
          />
        </label>
        <p v-if="authError" class="auth-error">{{ authError }}</p>
        <button class="primary-button" type="submit" :disabled="authLoading">
          {{ authLoading ? "Signing in..." : "Continue to workspace" }}
        </button>
      </form>
      <p class="auth-note">
        Demo credentials: admin@motoparts.test / password123
      </p>
    </div>
  </div>
  <div v-else class="app-shell">
    <aside class="sidebar" :class="{ 'sidebar-open': mobileMenuOpen }">
      <div class="brand-lockup">
        <div class="brand-mark">MP</div>
        <div>
          <p class="brand-name">MotoParts</p>
          <p class="brand-caption">Inventory desk</p>
        </div>
      </div>

      <div class="workspace-label">Workspace</div>
      <nav class="nav-list" aria-label="Primary navigation">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: activeSection === item.to.slice(1) }"
          @click="mobileMenuOpen = false"
        >
          <component :is="item.icon" :size="18" stroke-width="1.8" />
          <span>{{ item.label }}</span>
          <span v-if="item.adminOnly" class="admin-tag">Admin</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="support-note">
          <span class="support-dot"></span>
          <div>
            <strong>System online</strong><small>Local workspace</small>
          </div>
        </div>
        <button class="profile-row" type="button" @click="logout">
          <span class="avatar">{{ userInitials }}</span>
          <span class="profile-copy"
            ><strong>{{ currentUser?.name || "Alex Dela Cruz" }}</strong
            ><small>{{ currentUser?.role || "Administrator" }}</small></span
          >
          <ChevronDown :size="16" />
        </button>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <button
          class="icon-button menu-button"
          type="button"
          aria-label="Open navigation"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <Menu :size="20" />
        </button>
        <div class="breadcrumb">
          <span>Workspace</span><span class="crumb-separator">/</span
          ><strong>{{ pageTitle }}</strong>
        </div>
        <div class="topbar-actions">
          <button class="icon-button" type="button" aria-label="Search">
            <Search :size="19" />
          </button>
          <button
            class="icon-button notification-button"
            type="button"
            aria-label="Notifications"
          >
            <Bell :size="19" /><span></span>
          </button>
          <div class="topbar-user" @click="logout">
            <span class="avatar avatar-small">{{ userInitials }}</span
            ><span>{{ currentUser?.name || "Alex Dela Cruz" }}</span
            ><ChevronDown :size="15" />
          </div>
        </div>
      </header>

      <div class="page-content">
        <section class="page-heading">
          <div>
            <p class="eyebrow">Monday, September 28, 2026</p>
            <h1>Good morning, Alex<span class="heading-dot">.</span></h1>
            <p class="heading-copy">
              Here is what is happening with your parts inventory today.
            </p>
          </div>
          <RouterLink class="primary-button" to="/pos"
            ><ShoppingCart :size="17" /> Open point of sale</RouterLink
          >
        </section>

        <section class="stat-grid" aria-label="Key metrics">
          <article v-for="stat in stats" :key="stat.label" class="stat-card">
            <div class="stat-topline">
              <span>{{ stat.label }}</span
              ><span class="stat-icon" :class="`tone-${stat.tone}`"
                ><component :is="stat.icon" :size="18"
              /></span>
            </div>
            <strong class="stat-value">{{ stat.value }}</strong>
            <span
              class="stat-detail"
              :class="{ positive: stat.tone === 'teal' }"
              >{{ stat.detail }}</span
            >
          </article>
        </section>

        <section class="content-grid">
          <article class="panel inventory-panel">
            <div class="panel-heading">
              <div>
                <p class="section-kicker">Attention needed</p>
                <h2>Low stock items</h2>
              </div>
              <RouterLink to="/inventory" class="text-link"
                >View inventory <span>→</span></RouterLink
              >
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Category</th>
                    <th>On hand</th>
                    <th>Reorder at</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in lowStock" :key="item.sku">
                    <td>
                      <strong>{{ item.name }}</strong
                      ><small>{{ item.sku }}</small>
                    </td>
                    <td>{{ item.category }}</td>
                    <td>
                      <span class="stock-badge">{{ item.stock }} left</span>
                    </td>
                    <td>{{ item.reorder }} units</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
          <article class="panel activity-panel">
            <div class="panel-heading">
              <div>
                <p class="section-kicker">Today</p>
                <h2>Recent sales</h2>
              </div>
              <RouterLink to="/sales" class="text-link"
                >See all <span>→</span></RouterLink
              >
            </div>
            <div class="sales-list">
              <div v-for="sale in recentSales" :key="sale.id" class="sale-row">
                <span class="sale-icon"><ShoppingCart :size="16" /></span>
                <div class="sale-copy">
                  <strong>{{ sale.id }}</strong
                  ><small>{{ sale.cashier }} · {{ sale.time }}</small>
                </div>
                <strong class="sale-amount">{{ sale.amount }}</strong>
              </div>
            </div>
            <div class="chart-placeholder">
              <div class="chart-bars">
                <i style="height: 38%"></i><i style="height: 58%"></i
                ><i style="height: 44%"></i><i style="height: 77%"></i
                ><i style="height: 62%"></i><i style="height: 88%"></i
                ><i style="height: 70%"></i>
              </div>
              <span>Sales activity preview</span>
            </div>
          </article>
        </section>
      </div>
    </main>
  </div>
</template>
