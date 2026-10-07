import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

function hashRouteStaticFallbacks() {
  return {
    name: "rupio-hash-route-static-fallbacks",
    apply: "build",
    closeBundle() {
      const root = process.cwd();
      const outDir = path.join(root, "dist");
      const modulesFile = path.join(root, "src", "config", "modules.js");
      const modulesSource = fs.readFileSync(modulesFile, "utf8");
      const routes = new Set([
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/no-access",
        "/profile",
        "/storage-settings",
        "/master/storage-connection",
      ]);

      const routePattern = /\bp\(\s*["'`]([^"'`]+)["'`]/g;
      let match;
      while ((match = routePattern.exec(modulesSource))) {
        const route = match[1];
        if (route.startsWith("/") && !route.includes(":")) routes.add(route);
      }

      const redirectHtml = `<!doctype html><html><head><meta charset="UTF-8"><meta name="robots" content="noindex"><script>(function(){var p=location.pathname||'/';if(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);location.replace(location.origin+'/#'+p+(location.search||''));})();</script></head><body></body></html>`;

      for (const route of routes) {
        const routeDir = path.join(outDir, route.replace(/^\/+/, ""));
        fs.mkdirSync(routeDir, { recursive: true });
        fs.writeFileSync(path.join(routeDir, "index.html"), redirectHtml);
      }

      fs.writeFileSync(
        path.join(outDir, "404.html"),
        `<!doctype html><html><head><meta charset="UTF-8"><meta name="robots" content="noindex"><script>(function(){var p=location.pathname||'/';location.replace(location.origin+'/#'+p+(location.search||''));})();</script></head><body></body></html>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), hashRouteStaticFallbacks()],
  server: { port: 5173 },
  build: { sourcemap: false },
});
