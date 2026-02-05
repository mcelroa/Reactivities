import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

// https://vite.dev/config/
export default defineConfig({
   server: {
      port: 3000,
   },
   plugins: [
      mkcert(),
      react({
         babel: {
            plugins: [["babel-plugin-react-compiler"]],
         },
      }),
   ],
});
