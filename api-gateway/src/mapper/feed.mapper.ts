
import { GeneratePresignedUrlRequest } from "../grpc/generated/post";
import { PresignedUrlClientData } from "types/feed";

export class FeedMapper {
  static generatePresigneUrlRequest(
    data: PresignedUrlClientData,
    userId: string
  ) : GeneratePresignedUrlRequest | undefined{
    if (data.operation === "GET") {
      return {
        generatePresignedUrlRequestForGet: {
          userId: userId,
          operation: data.operation,
          key: data.key as string,
        }
      };
    }

    if (data.operation === "PUT") {
      return {
        generatePresignedUrlRequestForPut: {
          userId: userId,
          operation: data.operation,
          fileName: data.fileName as string,
          fileType: data.fileType as string,
        }
      };
    }
  }
}
