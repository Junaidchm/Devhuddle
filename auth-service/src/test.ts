import { FollowsRepository } from "./repositories/impliments/follows.repository";
import { FollowsService } from "./services/impliments/follows.service";


const repo = new FollowsRepository();
const service = new FollowsService(repo);

service.follow('756888a8-e2eb-4055-bc15-c4d52f581e3e', '098aac76-85df-4200-89ff-240778d1ecc6'); 