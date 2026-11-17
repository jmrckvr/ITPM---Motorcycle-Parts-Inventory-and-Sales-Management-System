import { createApp } from "vue";
import "./style.css";
import "./polish.css"; // final polish: animations, dark mode, new components
import App from "./App.vue";
import router from "./router";

createApp(App).use(router).mount("#app");
