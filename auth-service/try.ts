interface INotification {
    create(data:any) : Promise<void>
}


class createFollowNotification implements INotification {
    async create(data:any) {
        
    }
}

class createLikeNotification implements INotification {
    async create(data:any) {
        
    }
}

const handlers : Record<string, INotification>  = {
    "FOLLOW" : new createFollowNotification(),
    "LIKE" : new createLikeNotification()
}


class NotificationService {
  constructor(private handlers:Record<string, INotification>) {}

  async createNotification(type:string, data:any){
    const handler = this.handlers[type]
    if(!handler){
        throw new Error("Invalid notification type")
    }
    await handler.create(data)
  }
}



