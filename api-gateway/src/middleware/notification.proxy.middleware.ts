// // api-gateway/src/middleware/notification.proxy.middleware.ts
// import { Request, Response, NextFunction } from "express";
// import proxy from "express-http-proxy";
// import { app_config } from "../config/app.config";
// import { logger } from "../utils/logger";

import { app_config } from "../config/app.config";
import { createProxyMiddleware } from "http-proxy-middleware/dist";

// export const notificationServiceProxy = proxy(
//   app_config.notificationServiceUrl,
//   {
//     parseReqBody: true,
//     proxyReqPathResolver: (req) => {
//       return req.originalUrl;
//     },
//     proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
//       // Add authentication headers
//       if (srcReq.headers.authorization) {
//         proxyReqOpts.headers = {
//           ...proxyReqOpts.headers,
//           Authorization: srcReq.headers.authorization,
//         };
//       }
//       return proxyReqOpts;
//     },
//     userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
//       try {
//         logger.info("Notification service response", {
//           statusCode: proxyRes.statusCode,
//           url: userReq.originalUrl,
//         });
//         return proxyResData;
//       } catch (error: any) {
//         logger.error("Error in notification proxy", { error: error.message });
//         return proxyResData;
//       }
//     },
//   }
// );


console.log('this is the url to notification : -------------------------->', app_config.notificationServiceUrl)

// --- Unified Proxy for Notification Service (with WebSocket support) ---
export const notificationProxy = createProxyMiddleware({
  target: app_config.notificationServiceUrl,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  pathRewrite: { "^/api/notifications": "" }, // This rewrite is causing the 404s
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    let token = req.headers["authorization"];

    // Fallback to checking the query parameter if the header is not present
    if (!token && req.url) {
      const url = new URL(req.url, `ws://${req.headers.host}`);
      const tokenFromQuery = url.searchParams.get('token');
      if (tokenFromQuery) {
        // The downstream service likely expects the "Bearer " prefix
        token = `Bearer ${tokenFromQuery}`;
      }
    }

    if (token) {
      proxyReq.setHeader("Authorization", token);
    }
  },
});