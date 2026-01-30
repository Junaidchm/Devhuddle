export class AddExperienceDto {
  title!: string;
  company!: string;
  location?: string;
  startDate!: string; // ISO date string
  endDate?: string;  // ISO date string
  current!: boolean;
  description?: string;
}

export class AddEducationDto {
  school!: string;
  degree!: string;
  fieldOfStudy!: string;
  startDate!: string; // ISO date string
  endDate?: string;  // ISO date string
  grade?: string;
  activities?: string;
  description?: string;
}

export class UpdateSkillsDto {
  skills!: string[];
}
