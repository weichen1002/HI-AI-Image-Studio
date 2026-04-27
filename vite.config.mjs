import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5171,
    allowedHosts: ["studio.hiapis.cloud"],
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  }
});
