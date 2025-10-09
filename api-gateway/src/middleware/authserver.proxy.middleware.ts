
import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware";

export const authServiceProxy = createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL!,
  changeOrigin: true,
  pathRewrite: { "^/auth": "" },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] Forwarding ${req.method} ${req.originalUrl} to ${process.env.AUTH_SERVICE_URL}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    if (proxyRes.headers["content-type"]?.includes("image")) {
      proxyRes.headers["access-control-allow-origin"] = process.env.frontend_URL || "http://localhost:3000";
      proxyRes.headers["access-control-allow-methods"] = "GET";
      proxyRes.headers["access-control-allow-headers"] = "Content-Type";
      proxyRes.headers["access-control-allow-credentials"] = "true";
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


createProxyMiddleware({
  target: app_config.authServiceUrl, // User Service URL
  changeOrigin: true,
  pathRewrite: { '^/users': '/users' }, // Keep path
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Gateway proxy failed' });
  },
})