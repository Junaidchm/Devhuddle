import express from "express";
import { createServer } from "http";
import { WebSocketService } from "./utils/websocket.util";
const app = express();
const server = createServer(app);
new WebSocketService(server);
server.listen(4004, () => console.log("Server running on 4004"));