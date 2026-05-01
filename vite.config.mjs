import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  optimizeDeps: {
    include: ["lucide-vue-next", "pinia", "vue", "vue-router"]
  },
  build: {
    target: "es2020",
    cssTarget: "chrome87",
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lucide-vue-next")) return "vendor-icons";
          if (id.includes("vue") || id.includes("pinia")) return "vendor-vue";
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5171,
    allowedHosts: ["studio.hiapis.cloud"],
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/uploads": "http://127.0.0.1:3000"
    }
  }
});
