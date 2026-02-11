export interface INotificationHandler {
  type: string;
  handle(payload: any): Promise<void>;
}
