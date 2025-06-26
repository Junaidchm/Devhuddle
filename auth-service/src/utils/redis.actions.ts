import redisClient from "./redis.util";
import jwt from "jsonwebtoken"

export const generateTTL = (tokenExp: number) => {
  const currentTime = Math.floor(Date.now() / 1000);

  const secondsToExpire = tokenExp - currentTime;

  return secondsToExpire > 0 ? secondsToExpire : 0;
};


// export const generateRedisKey = (userId: string) => {
//   return "user-" + userId;
// };


// export const setCache = async (key: string, data: string, EX: number) => {
//   try {
//     await redisClient.set(key, data, { EX });
//     console.log("Redis: SET-Cache", key, "Value: ", data);
//   } catch (error) {
//     console.log(
//       "Error while setting redis data: ",
//       "Key: ",
//       key,
//       "value",
//       data,
//       "Error:",
//       error
//     );
//     throw error;
//   }
// };

// export const getCache = async (key: string) => {
//   try {
//     const value = await redisClient.get(key);
//     console.log("Redis: GET-Cache", key, "Value: ", value);
//     return value;
//   } catch (error) {
//     console.log(
//       "Error while getting redis data: ",
//       "Key: ",
//       key,
//       "Error:",
//       error
//     );
//     throw error;
//   }
// };


