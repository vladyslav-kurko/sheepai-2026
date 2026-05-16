import { inject, injectable } from "inversify";
import { ObjectId } from "mongodb";
import { AppTypes } from "../../container/AppTypes";
import { MongoDBClient } from "../client";
import { IUser } from "./types";

@injectable()
export class UserRepository {
    private readonly COLLECTION = "users";

    constructor(
        @inject(AppTypes.MongoDBClient) private readonly client: MongoDBClient
    ) {}

    public async init(): Promise<void> {
        await this.client.safeCreateCollection(this.COLLECTION);
        await this.client.safeCreateIndex(this.COLLECTION, { email: 1 }, { unique: true, name: "email_unique" });
    }

    public async createUser(data: Omit<IUser, "_id">): Promise<IUser> {
        const result = await this.client.getConnection().collection(this.COLLECTION).insertOne(data);
        return { ...data, _id: result.insertedId };
    }

    public async findByEmail(email: string): Promise<IUser | null> {
        return this.client.getConnection().collection(this.COLLECTION).findOne({ email }) as Promise<IUser | null>;
    }

    public async findById(id: string): Promise<IUser | null> {
        return this.client.getConnection().collection(this.COLLECTION).findOne({ _id: new ObjectId(id) }) as Promise<IUser | null>;
    }
}
