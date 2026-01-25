import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Request DTO for notification owner
 */
export class NotificationOwnerDto {
  @IsString()
  @IsNotEmpty({ message: "Recipient ID is required" })
  recipientId!: string;
}
