import { createRouter, createWebHistory } from "vue-router";

const routeComponent = { render: () => null };

const routes = [
  "login",
  "dashboard",
  "products",
  "inventory",
  "pos",
  "sales",
  "reports",
  "users",
].map((section) => ({
  path: section === "dashboard" ? "/" : `/${section}`,
  name: section,
  component: routeComponent,
}));

export default createRouter({
  history: createWebHistory(),
  routes,
});
