import express, { Express, NextFunction, Request, Response } from "express";

const app:Express  = express();

app.listen(4001,()=> {
  console.log('notification server is running ................')
})