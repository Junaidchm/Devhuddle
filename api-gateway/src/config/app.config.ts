import dotenv from "dotenv";
dotenv.config();

export interface Iconfig {
  port: number;
  authServiceUrl: string;
  companyServiceUrl: string;
  jwtSecret: string
  frontend_URL : string;
  ticketServiceUrl : string;
  communicationServiceUrl : string;
  subscription_service : string;
  frontend_production_url : string;
  FRONTEND_PRODUCTION_URL2 : string;
}

export const app_config: Iconfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 8080,
  authServiceUrl: process.env.AUTH_SERVICE_URL as string,
  companyServiceUrl: process.env.COMPANY_SERVICE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  frontend_URL: process.env.frontend_URL as string,
  ticketServiceUrl : process.env.TICKET_SERVICE_URL as string,
  communicationServiceUrl : process.env.COMMUNICATION_SERVICE_URL as string,
  subscription_service : process.env.SUBSCRIPTION_SERVICE_URL as string,
  frontend_production_url : process.env.FRONTEND_PRODUCTION_URL as string,
  FRONTEND_PRODUCTION_URL2 : process.env.FRONTEND_PRODUCTION_URL2 as string
};