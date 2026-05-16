import "reflect-metadata";

import cors from "@fastify/cors";
import { Config } from "./config";
import { adapter, container } from "./container";

import { AppTypes } from "./container/AppTypes";
import { MongoDBClient } from "./repository/client";
import { ApiErrorFilter } from "./middleware/ApiErrorFilter";

import { swaggerConfig } from "./openapi";
import { Repository } from "./repository";

swaggerConfig.provide(container);
adapter.useGlobalFilters(ApiErrorFilter);

adapter.build().then(async (application) => {
    const config = container.get<Config>(AppTypes.Config);
    const database = container.get<MongoDBClient>(AppTypes.MongoDBClient);

    await database.init();

    const repositorys = container.get<Repository>(Repository);
    await repositorys.init();

    await application.register(cors, {
        origin: config.corsOrigins,
        credentials: true,
    });

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