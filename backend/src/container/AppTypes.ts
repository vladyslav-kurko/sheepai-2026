export const AppTypes = {
    Config: Symbol.for("Config"),
    Logger: Symbol.for("Logger"),
    MongoDBClient: Symbol.for("MongoDBClient"),
    UserRepository: Symbol.for("UserRepository"),
    ConversationRepository: Symbol.for("ConversationRepository"),
    TokenService: Symbol.for("TokenService"),
    ScraperService: Symbol.for("ScraperService"),
    ConversationPipelineService: Symbol.for("ConversationPipelineService"),
    GeocodeService: Symbol.for("GeocodeService"),
}