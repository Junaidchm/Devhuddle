import { Request, Response } from "express";
import { IGroupService } from "../../services/interfaces/IGroupService";

export class GroupController {
    constructor(private _groupService: IGroupService) {}

    createGroup = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = JSON.parse(req.headers["x-user-data"] as string).id;
            const { name, participantIds, icon, onlyAdminsCanPost, onlyAdminsCanEditInfo, topics } = req.body;
            
            const group = await this._groupService.createGroup(
                userId, 
                name, 
                participantIds, 
                icon,
                onlyAdminsCanPost,
                onlyAdminsCanEditInfo,
                topics
            );
            res.status(201).json(group);
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
        }
    }

    getAllGroups = async (req: Request, res: Response): Promise<void> => {
        try {
            const { query, topics, limit, offset } = req.query;
            
            const parsedLimit = limit ? parseInt(limit as string) : 20;
            const parsedOffset = offset ? parseInt(offset as string) : 0;
            const parsedTopics = topics ? (Array.isArray(topics) ? topics as string[] : [topics as string]) : undefined;

            const groups = await this._groupService.getAllGroups(
                query as string,
                parsedTopics,
                parsedLimit,
                parsedOffset
            );
            res.status(200).json(groups);
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
        }
    }

    getGroupDetails = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = req.params.id as string;
            const group = await this._groupService.getGroupDetails(id);
            res.status(200).json(group);
        } catch (error) {
            res.status(404).json({ error: (error as Error).message });
        }
    }

    addParticipants = async (req: Request, res: Response): Promise<void> => {
        try {
            const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
            const id = req.params.id as string;
            const { userIds } = req.body;

            await this._groupService.addParticipants(id, adminId, userIds);
            res.status(200).json({ message: "Participants added successfully" });
        } catch (error) {
            res.status(403).json({ error: (error as Error).message });
        }
    }

    removeParticipant = async (req: Request, res: Response): Promise<void> => {
        try {
            const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
            const id = req.params.id as string;
            const userId = req.params.userId as string;

            await this._groupService.removeParticipant(id, adminId, userId);
            res.status(200).json({ message: "Participant removed successfully" });
        } catch (error) {
            res.status(403).json({ error: (error as Error).message });
        }
    }

    promoteToAdmin = async (req: Request, res: Response): Promise<void> => {
        try {
            const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
            const id = req.params.id as string;
            const userId = req.params.userId as string;

            await this._groupService.promoteToAdmin(id, adminId, userId);
            res.status(200).json({ message: "User promoted to admin" });
        } catch (error) {
            res.status(403).json({ error: (error as Error).message });
        }
    }

    demoteToMember = async (req: Request, res: Response): Promise<void> => {
        try {
            const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
            const id = req.params.id as string;
            const userId = req.params.userId as string;

            await this._groupService.demoteToMember(id, adminId, userId);
            res.status(200).json({ message: "User demoted to member" });
        } catch (error) {
            res.status(403).json({ error: (error as Error).message });
        }
    }

    updateGroupInfo = async (req: Request, res: Response): Promise<void> => {
        try {
            const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
            const id = req.params.id as string;
            const data = req.body;

            const updatedGroup = await this._groupService.updateGroupInfo(id, adminId, data);
            res.status(200).json(updatedGroup);
        } catch (error) {
            res.status(403).json({ error: (error as Error).message });
        }
    }

    leaveGroup = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = JSON.parse(req.headers["x-user-data"] as string).id;
            const id = req.params.id as string;

            await this._groupService.leaveGroup(id, userId);
            res.status(200).json({ message: "Left group successfully" });
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
        }
    }

    joinGroup = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = JSON.parse(req.headers["x-user-data"] as string).id;
            const id = req.params.id as string;

            await this._groupService.joinGroup(id, userId);
            res.status(200).json({ message: "Joined group successfully" });
        } catch (error) {
            res.status(400).json({ error: (error as Error).message });
        }
    }
}
