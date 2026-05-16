import { OasSchema, OasSchemaProperty } from "@inversifyjs/http-open-api";

@OasSchema()
export class GeocodeRequestDTO {
    @OasSchemaProperty({ type: "string", required: true })
    address!: string;
}

@OasSchema()
export class GeocodeResponseDTO {
    @OasSchemaProperty({ type: "number" })
    lat!: number;

    @OasSchemaProperty({ type: "number" })
    lng!: number;

    @OasSchemaProperty({ type: "string" })
    displayName!: string;
}
