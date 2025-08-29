import { z } from "zod";

export const CreateGeneratePresignedUrlSchema = z.object({
  userId: z.string(),
  operation: z.enum(["PUT", "GET"]),
  fileName: z.string().optional(),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm']).optional(),
  key: z.string().optional(),
});

export type CreatePresignedUrl = z.infer<typeof CreateGeneratePresignedUrlSchema>
