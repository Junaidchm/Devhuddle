import { Router } from "express";
import { MediaController } from "../controllers/impliments/media.controller";
import { validateDto } from "../middlewares/validation.middleware";
import { CreateUploadSessionDto, ValidateMediaDto, LinkMediaToPostDto } from "../dtos/media.dto";

export const setupMediaRoutes = (mediaController: MediaController): Router => {
  const router = Router();

  // Upload session - create presigned URL
  router.post("/upload-session", validateDto(CreateUploadSessionDto), (req, res) => 
    mediaController.createUploadSession(req, res)
  );

  // Complete upload - verify and finalize
  router.post("/:mediaId/complete", (req, res) => 
    mediaController.completeUpload(req, res)
  );

  // Get media by ID
  router.get("/:mediaId", (req, res) => 
    mediaController.getMediaById(req, res)
  );

  // Delete media
  router.delete("/:mediaId", (req, res) => 
    mediaController.deleteMedia(req, res)
  );

  // Get user's media
  router.get("/user/media", (req, res) => 
    mediaController.getUserMedia(req, res)
  );

  // Validate media ownership (called by Post Service)
  router.post("/validate", validateDto(ValidateMediaDto), (req, res) => 
    mediaController.validateMediaOwnership(req, res)
  );

  // Link media to post (called by Post Service)
  router.post("/link-to-post", validateDto(LinkMediaToPostDto), (req, res) => 
    mediaController.linkMediaToPost(req, res)
  );

  return router;
};

