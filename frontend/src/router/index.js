import { createRouter, createWebHistory } from "vue-router";
const routeComponent = { render: () => null };
const publicRoute = { component: routeComponent };
const routes = [
  { path: "/login", name: "login", ...publicRoute, meta: { guest: true } },
  { path: "/", name: "dashboard", ...publicRoute },
  ...["products", "inventory", "stock-in", "adjust-stock", "pos", "sales", "notifications"].map((name) => ({ path: `/${name}`, name, ...publicRoute })),
  { path: "/reports", name: "reports", ...publicRoute, meta: { admin: true } },
  { path: "/users", name: "users", ...publicRoute, meta: { admin: true } },
  { path: "/profile", name: "profile", ...publicRoute },
  { path: "/users/:id/profile", name: "user-profile", ...publicRoute, meta: { admin: true } },
];
const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach((to) => {
  const token = sessionStorage.getItem("auth_token");
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("auth_user") || "null"); } catch { /* invalid session */ }
  if (!token && !to.meta.guest) return { name: "login" };
  if (token && to.meta.guest) return { name: "dashboard" };
  if (to.meta.admin && user?.role !== "admin") return { name: "dashboard" };
  return true;
});
export default router;
