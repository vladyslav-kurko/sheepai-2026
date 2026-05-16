import { InversifyFastifyHttpAdapter } from "@inversifyjs/http-fastify";
import { Container } from "inversify";

import { AppTypes } from "./AppTypes";
import { Config } from "../config";
import { Logger } from "../utils";
import { ChatController } from "../controllers";
import { AuthController } from "../controllers/Auth/AuthController";
import { AnthropicChatService } from "../services/Anthropic/AnthropicChatService/AnthropicChatService";
import { AuthService } from "../services/AuthService";
import { TokenService } from "../services/TokenService";
import { ApiErrorHandler } from "../middleware/ErrorHandler";
import { AuthMiddleware, OptionalAuthMiddleware } from "../middleware/AuthMiddleware";
import { MongoDBClient } from "../repository/client";
import { UserRepository } from "../repository/UserRepository";
import { ConversationController } from "../controllers/Conversation/ConversationController";
import { ConversationRepository } from "../repository/ConversationRepository";
import { ScraperService } from "../services/ScraperService";
import { ConversationPipelineService } from "../services/ConversationPipelineService";

const container: Container = new Container();

container.bind<Config>(AppTypes.Config).to(Config).inSingletonScope();
container.bind<Logger>(AppTypes.Logger).to(Logger).inSingletonScope();
container.bind<MongoDBClient>(AppTypes.MongoDBClient).to(MongoDBClient).inSingletonScope();

container.bind<UserRepository>(AppTypes.UserRepository).to(UserRepository).inSingletonScope();
container.bind<TokenService>(AppTypes.TokenService).to(TokenService).inSingletonScope();
container.bind<AuthService>(AuthService).toSelf().inSingletonScope();

container.bind<ChatController>(ChatController).toSelf().inSingletonScope();
container.bind<AuthController>(AuthController).toSelf().inSingletonScope();
container.bind<ConversationController>(ConversationController).toSelf().inSingletonScope();

container.bind<ScraperService>(AppTypes.ScraperService).to(ScraperService).inSingletonScope();
container.bind<AnthropicChatService>(AnthropicChatService).toSelf().inSingletonScope();
container.bind<ConversationPipelineService>(AppTypes.ConversationPipelineService).to(ConversationPipelineService).inSingletonScope();
container.bind<ApiErrorHandler>(ApiErrorHandler).toSelf();
container.bind<AuthMiddleware>(AuthMiddleware).toSelf();
container.bind<OptionalAuthMiddleware>(OptionalAuthMiddleware).toSelf();

container.bind<ConversationRepository>(AppTypes.ConversationRepository).to(ConversationRepository).inSingletonScope();

const adapter: InversifyFastifyHttpAdapter = new InversifyFastifyHttpAdapter(
  container,
  { useCookies: true },
);

export { container, adapter };
