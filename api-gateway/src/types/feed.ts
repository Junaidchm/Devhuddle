export type PresignedUrlClientData = {
    operation:"PUT" | "GET",
    fileName?:string,
    fileType?:'image/jpeg' | 'image/png' | 'image/gif' | 'video/mp4' |  'video/webm',
    key?:string
}