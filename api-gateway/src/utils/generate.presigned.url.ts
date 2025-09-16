import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { logger } from "./logger"; // Assume logger is configured
import { CustomError } from "./error.util";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { s3Client } from "../config/s3.config";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Request, Response } from "express";

interface generatePresignedUrlValuse {
  folderPath: string;
  operation: "PUT" | "GET";
  fileName?: string;
  fileType?: string;
  key?: string;
}

export async function generatePresignedUrl(req: Request, res: Response) {
  const { folderPath, operation, fileName, fileType, key } =
    req.body as generatePresignedUrlValuse;

  try {
    const EXPIRES_IN_SECONDS = Number(process.env.EXPIRES_IN_SECONDS) || 3600;
    if (operation === "PUT") {
      if (!fileName || !fileType) {
        throw new CustomError(
          Status.INVALID_ARGUMENT,
          "fileName and fileType are required for PUT operation"
        );
      }

      console.log(
        " this is the file type  ...................................:",
        fileType,
        fileName
      );

      // Define allowed MIME types for images and videos
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "video/mp4",
        "video/webm",
      ];

      if (!allowedTypes.includes(fileType)) {
        throw new CustomError(
          Status.INVALID_ARGUMENT,
          "Invalid file type. Only JPG, PNG, GIF, MP4, or WebM allowed"
        );
      }

      // Validate file extension matches MIME type
      //   const extension = fileName.split('.').pop()?.toLowerCase();
      //   const mimeType = fileType.split('/')[1].toLowerCase();

      //   const equivalent = (ext: string, type: string) => {
      //     if (ext === 'jpg' && type === 'jpeg') return true;
      //     if (ext === 'jpeg' && type === 'jpg') return true;
      //     return ext === type;
      //   };

      //   if (!extension || !equivalent(extension, mimeType)) {
      //     throw new CustomError(
      //       Status.INVALID_ARGUMENT,
      //       'File extension does not match content type'
      //     );
      //   }

      // Set file size limits (10MB for images, 50MB for videos)
      const maxSize = fileType.startsWith("video/")
        ? 50 * 1024 * 1024
        : 10 * 1024 * 1024;
      // Note: Actual size validation requires file content, typically done in frontend or via metadata

      // Organize S3 key by media type
      const mediaType = fileType.startsWith("video/") ? "videos" : "images";
      const newKey = `${folderPath}/${mediaType}-${Date.now()}${path.extname(
        fileName
      )}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: newKey,
        ContentType: fileType,
      });

      const url = await getSignedUrl(s3Client, command, {
        expiresIn: EXPIRES_IN_SECONDS,
      });

      console.log("this is the presigned url ................... : ", url);

      res.status(200).json( {
        url,
        key: newKey,
        expiresAt: Date.now() + EXPIRES_IN_SECONDS * 1000,
      })
    } else if (operation === "GET") {
      if (!key) {
        throw new CustomError(
          Status.INVALID_ARGUMENT,
          "key is required for GET operation"
        );
      }

      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET || "devhuddle-bucket-junaid",
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, {
        expiresIn: EXPIRES_IN_SECONDS,
      });

      res.status(200).json({
        url,
        presignedKey: key,
        expiresAt: Date.now() + EXPIRES_IN_SECONDS * 1000,
      });
    } else {
      throw new CustomError(
        Status.INVALID_ARGUMENT,
        "Invalid operation. Use PUT or GET"
      );
    }
  } catch (error: any) {
    logger.error("Failed to generate presigned URL", {
      error: error.message,
      stack: error.stack,
    });
    throw error instanceof CustomError
      ? error
      : new CustomError(Status.INTERNAL, "Failed to generate presigned URL");
  }
}
