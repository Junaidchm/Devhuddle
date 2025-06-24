import { createProxyMiddleware } from "http-proxy-middleware";

export const authServiceProxy = createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { "^/auth": "" },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${process.env.AUTH_SERVICE_URL}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Set CORS headers on the real response for images
    if (proxyRes.headers["content-type"]?.includes("image")) {
      // @ts-ignore
      res.setHeader("Access-Control-Allow-Origin", process.env.frontend_URL || "http://localhost:3000");
      // @ts-ignore
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      // @ts-ignore
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      // @ts-ignore
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  },
  onError: (err, req, res) => {
    console.error("Proxy error:", err.message);
    if (typeof res.status === "function") {
      res.status(500).json({ error: "Proxy failed" });
    } else {
      res.end('Proxy failed');
    }
  },
});