import { createRouter, createWebHistory } from "vue-router";

const routeComponent = { render: () => null };

const routes = [
  { path: "/login", name: "login", component: routeComponent },
  { path: "/", name: "dashboard", component: routeComponent },
  { path: "/products", name: "products", component: routeComponent },
  { path: "/inventory", name: "inventory", component: routeComponent },
  { path: "/pos", name: "pos", component: routeComponent },
  { path: "/sales", name: "sales", component: routeComponent },
  { path: "/reports", name: "reports", component: routeComponent },
  { path: "/users", name: "users", component: routeComponent },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
