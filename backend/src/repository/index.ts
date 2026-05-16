import { inject, injectable } from "inversify";

import { AppTypes } from "../container/AppTypes";
import { UserRepository } from "./UserRepository";
import { ConversationRepository } from "./ConversationRepository";

@injectable()
export class Repository {
    constructor(
        @inject(AppTypes.ConversationRepository)
        private readonly conversationRepository: ConversationRepository,
        @inject(AppTypes.UserRepository)
        private readonly userRepository: UserRepository,
    ) {}

    /**
     * Initialize the repository, e.g., create necessary indexes, set up connections, etc.
     */
    public async init(): Promise<void> {
        await this.conversationRepository.init();
        await this.userRepository.init();
    }
}