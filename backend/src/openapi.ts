import { SwaggerUiProvider } from "@inversifyjs/http-open-api";

export const swaggerConfig: SwaggerUiProvider = new SwaggerUiProvider({
    api: {
        openApiObject: {
            info: {
                title: 'The GoOver API',
                version: '1.0.0',
            },
            openapi: '3.1.1',
        },
        path: '/docs',
    },
    ui: {
        title: 'The GoOver API docs',
    },
});