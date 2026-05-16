import { InversifyFastifyHttpAdapter } from "@inversifyjs/http-fastify";
import { Container } from "inversify";

import { AppTypes } from "./AppTypes";
import { Config } from "../config";
import { Logger } from "../utils";
import { ChatController } from "../controllers";
import { AnthropicChatService } from "../services/Anthropic/AnthropicChatService/AnthropicChatService";
import { ApiErrorHandler } from "../middleware/ErrorHandler";

const container: Container = new Container();

container.bind<Config>(AppTypes.Config).to(Config).inSingletonScope();
container.bind<Logger>(AppTypes.Logger).to(Logger).inSingletonScope();
container.bind(ChatController).toSelf().inSingletonScope()
container.bind<AnthropicChatService>(AnthropicChatService).toSelf();
container.bind<ApiErrorHandler>(ApiErrorHandler).toSelf();

const adapter: InversifyFastifyHttpAdapter = new InversifyFastifyHttpAdapter(
  container,
);

export { container, adapter };