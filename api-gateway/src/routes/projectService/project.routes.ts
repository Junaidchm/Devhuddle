// import { Router, urlencoded, json, Request, Response } from "express";
// import compression from "compression";
// import cookieParser from "cookie-parser";
// import jwtMiddleware from "../../middleware/jwt.middleware";
// import {
//   createProject,
//   updateProject,
//   getProject,
//   listProjects,
//   deleteProject,
//   publishProject,
//   getTrendingProjects,
//   getTopProjects,
//   searchProjects,
//   likeProject,
//   unlikeProject,
//   shareProject,
//   reportProject,
//   trackProjectView,
// } from "../../controllers/project/main.project";

// const router = Router();

// router.use(compression());
// router.use(json());
// router.use(urlencoded({ extended: true }));
// router.use(cookieParser());

// // Project CRUD routes
// router
//   .post("/", jwtMiddleware, createProject)
//   .get("/", jwtMiddleware, listProjects)
//   .get("/trending", jwtMiddleware, getTrendingProjects)
//   .get("/top", jwtMiddleware, getTopProjects)
//   .get("/search", jwtMiddleware, searchProjects)
//   .get("/:projectId", jwtMiddleware, getProject)
//   .put("/:projectId", jwtMiddleware, updateProject)
//   .delete("/:projectId", jwtMiddleware, deleteProject)
//   .post("/:projectId/publish", jwtMiddleware, publishProject)
//   .post("/:projectId/view", jwtMiddleware, trackProjectView);

// // Engagement routes
// router
//   .post("/:projectId/like", jwtMiddleware, likeProject)
//   .delete("/:projectId/like", jwtMiddleware, unlikeProject)
//   .post("/:projectId/share", jwtMiddleware, shareProject)
//   .post("/:projectId/report", jwtMiddleware, reportProject);

// export default router;

