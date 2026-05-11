import { createApp } from "vue";
import { createPinia } from "pinia";
import router, { reloadOnDynamicImportError } from "./router";
import App from "./App.vue";
import "./styles.css";

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (reloadOnDynamicImportError(event.reason)) {
      event.preventDefault();
    }
  });
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
