import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: { host: "0.0.0.0", port: 5173 },
    build: {
        chunkSizeWarningLimit: 1350,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("pdfjs-dist"))
                        return "pdf-engine";
                    if (id.includes("@supabase"))
                        return "supabase";
                    if (id.includes("node_modules/react"))
                        return "react-vendor";
                },
            },
        },
    },
});
