import { IsString, IsNotEmpty } from 'class-validator';

export class NotificationOwnerDto {
  @IsString()
  @IsNotEmpty({ message: "Recipient ID is required" })
  recipientId!: string;
}
