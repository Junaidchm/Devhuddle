import express, { Express, NextFunction, Request, Response } from "express";
import { startFollowConsumer } from "./consumers/follow.consumer";
import { connectRedis } from "./config/redis.config";


const app:Express  = express();
app.use(express.json());

app.listen(4001,async ()=> {
  await connectRedis()
  await startFollowConsumer()
  console.log('notification server is running ................')
})