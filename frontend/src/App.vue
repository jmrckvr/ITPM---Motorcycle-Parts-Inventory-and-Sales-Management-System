<script setup>
import { computed, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
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

const route = useRoute();
const mobileMenuOpen = ref(false);

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
</script>

<template>
  <div v-if="activeSection === 'login'" class="auth-screen">
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
      <form class="login-form" @submit.prevent>
        <label
          >Email address<input type="email" placeholder="you@motoparts.local"
        /></label>
        <label
          >Password<input type="password" placeholder="Enter your password"
        /></label>
        <button class="primary-button" type="submit">
          Continue to workspace
        </button>
      </form>
      <p class="auth-note">
        Authentication will connect to Laravel Sanctum in Phase 3.
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
        <button class="profile-row" type="button">
          <span class="avatar">AD</span>
          <span class="profile-copy"
            ><strong>Alex Dela Cruz</strong><small>Administrator</small></span
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
          <div class="topbar-user">
            <span class="avatar avatar-small">AD</span
            ><span>Alex Dela Cruz</span><ChevronDown :size="15" />
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
