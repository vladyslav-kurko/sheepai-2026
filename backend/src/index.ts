import "reflect-metadata";

import { Config } from "./config";
import { adapter, container } from "./container";

import { AppTypes } from "./container/AppTypes";
import { MongoDBClient } from "./repository/client";
import { UserRepository } from "./repository/UserRepository";

import { swaggerConfig } from "./openapi";

swaggerConfig.provide(container);

adapter.build().then(async (application) => {
    const config = container.get<Config>(AppTypes.Config);
    const database = container.get<MongoDBClient>(AppTypes.MongoDBClient);
    
    await database.init();

    const userRepository = container.get<UserRepository>(AppTypes.UserRepository);
    await userRepository.init();

    application.listen({
        port: config.port,
        host: config.host,
    }, (err, adapter) => {
        if (err) {
            console.error("Error starting server:", err);
            process.exit(1);
        }
        console.log(`Server is running at http://${config.host}:${config.port}`);
    });
});