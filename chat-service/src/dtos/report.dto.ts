import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export enum ReportReason {
  SPAM = "SPAM",
  INAPPROPRIATE = "INAPPROPRIATE",
  HARASSMENT = "HARASSMENT",
  HATE_SPEECH = "HATE_SPEECH",
  VIOLENCE = "VIOLENCE",
  SELF_HARM = "SELF_HARM",
  FALSE_INFORMATION = "FALSE_INFORMATION",
  COPYRIGHT_VIOLATION = "COPYRIGHT_VIOLATION",
  OTHER = "OTHER"
}

export enum ReportTargetType {
  USER = "USER",
  CONVERSATION = "CONVERSATION"
}

export class CreateReportDto {
  @IsNotEmpty()
  @IsString()
  conversationId!: string;

  @IsNotEmpty()
  @IsString()
  targetId!: string;

  @IsNotEmpty()
  @IsEnum(ReportTargetType)
  targetType!: ReportTargetType;

  @IsNotEmpty()
  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  metadata?: any;
}
