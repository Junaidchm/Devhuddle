export class ExperienceDto {
  id!: string;
  title!: string;
  company!: string;
  location?: string | null;
  startDate!: Date;
  endDate?: Date | null;
  current!: boolean;
  description?: string | null;
}

export class EducationDto {
  id!: string;
  school!: string;
  degree!: string;
  fieldOfStudy!: string;
  startDate!: Date;
  endDate?: Date | null;
  grade?: string | null;
  activities?: string | null;
  description?: string | null;
}
