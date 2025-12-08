import express, { Express } from "express";
import logger from "./logger.util";

export const app: Express = express();

export const startServer = async (): Promise<void> => {
  const PORT = process.env.PORT || 5003;
  
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      logger.info(`Media Service running on port ${PORT}`);
      resolve();
    });
  });
};

