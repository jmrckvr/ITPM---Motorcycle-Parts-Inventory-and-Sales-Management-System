import { createRouter, createWebHistory } from "vue-router";

const routeComponent = { render: () => null };

const routes = [
  { path: "/login", name: "login", component: routeComponent },
  { path: "/", name: "dashboard", component: routeComponent },
  { path: "/products", name: "products", component: routeComponent },
  { path: "/inventory", name: "inventory", component: routeComponent },
  { path: "/stock-in", name: "stock-in", component: routeComponent },
  { path: "/adjust-stock", name: "adjust-stock", component: routeComponent },
  { path: "/pos", name: "pos", component: routeComponent },
  { path: "/sales", name: "sales", component: routeComponent },
  { path: "/reports", name: "reports", component: routeComponent },
  { path: "/users", name: "users", component: routeComponent },
  { path: "/notifications", name: "notifications", component: routeComponent },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
