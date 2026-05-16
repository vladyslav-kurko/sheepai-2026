import { inject } from "inversify";
import { ApplyMiddleware, Body, Controller, HttpStatusCode, Post } from "@inversifyjs/http-core";
import { OasRequestBody, OasResponse, OasTag, ToSchemaFunction } from "@inversifyjs/http-open-api";

import { AppTypes } from "../../container/AppTypes";
import { ApiErrorHandler } from "../../middleware/ErrorHandler";
import { ApiError, ApiErrorBuilder, ErrorCode } from "../../errors";
import { GeocodeService } from "../../services/GeocodeService";
import { GeocodeRequestDTO, GeocodeResponseDTO } from "./MapController.dto";

@ApplyMiddleware(ApiErrorHandler)
@Controller("/maps")
export class MapController {
    constructor(
        @inject(AppTypes.GeocodeService)
        private readonly geocodeService: GeocodeService,
    ) {}

    @OasTag("Maps")
    @Post("/geocode")
    @OasResponse(HttpStatusCode.OK, (toSchema: ToSchemaFunction) => ({
        description: "Geocoded coordinates for the given address",
        content: { "application/json": { schema: toSchema(GeocodeResponseDTO) } },
    }))
    @OasResponse(HttpStatusCode.NOT_FOUND, (toSchema: ToSchemaFunction) => ({
        description: "Address not found",
        content: { "application/json": { schema: toSchema(ApiError) } },
    }))
    @OasRequestBody((toSchema: ToSchemaFunction) => ({
        required: true,
        content: { "application/json": { schema: toSchema(GeocodeRequestDTO) } },
    }))
    public async geocode(
        @Body() body: GeocodeRequestDTO,
    ): Promise<GeocodeResponseDTO> {
        const result = await this.geocodeService.geocode(body.address);
        if (!result) {
            throw new ApiErrorBuilder().error(ErrorCode.NotFoundError, `Address not found: ${body.address}`);
        }
        return result;
    }
}
