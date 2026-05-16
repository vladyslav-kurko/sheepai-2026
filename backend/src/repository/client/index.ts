import { CreateIndexesOptions, Db, IndexSpecification, MongoClient } from "mongodb";

import { Config } from "../../config";
import { ApiErrorBuilder, ErrorCode } from "../../errors";
import { Logger } from "../../utils";
import { inject } from "inversify";
import { AppTypes } from "../../container/AppTypes";

/**
 * MongoDBClient is responsible for managing the connection to the MongoDB database.
 * It establishes a connection and provides methods to access the database.
 */
export class MongoDBClient {
    private connection: Db | null = null;
    private client: MongoClient;

    /**
     * Establishes a connection to the MongoDB database using the provided database name.
     *
     * @param {string} databaseName The name of the database to connect to.
     * @return {Promise<boolean>} A promise that resolves to true if the connection is successful.
     */
    private async connect(databaseName: string) {
        const db = await this.client.connect();

        if (!db) {
            this.logger.error("[ MongoDBClient ] Failed to connect to MongoDB.");
            process.exit(1);
        }

        this.connection = db.db(databaseName);

        return true;
    }

    /**
     * Initializes the MongoDB client and establishes a connection to the specified database.
     *
     * @param {Config} config The configuration object containing MongoDB connection details.
     */
    constructor(
        @inject(AppTypes.Config)
        private readonly config: Config,
        @inject(AppTypes.Logger)
        private readonly logger: Logger
    ) {
        this.client = new MongoClient(config.mongoURL);
    }

    /**
     * Initializes the MongoDB client by connecting to the database.
     * If the connection fails, it logs the error and exits the process.
     *
     * @return {Promise<void>} A promise that resolves when the initialization is complete.
     */
    public async init(): Promise<void> {
        try {
            await this.connect(this.config.databaseName);
            this.logger.info("[ MongoDBClient ] MongoDB client initialized successfully.");
        } catch (error: Error | unknown) {
            this.logger.error("[ MongoDBClient ] Error initializing MongoDB client:", error);
            process.exit(1);
        }
    }

    /**
     * Returns the MongoDB database connection.
     * If the connection is not established, it throws an ApiError.
     *
     * @return {Db} The MongoDB database connection.
     */
    public getConnection(): Db {
        if (!this.connection) {
            throw new ApiErrorBuilder().error(
                ErrorCode.InternalServerError,
                "[ MongoDBClient ] MongoDB connection is not established yet."
            );
        }
        return this.connection;
    }

    /**
     * Checks if an index with the specified name exists on the given collection.
     *
     * @param {string} collectionName - The name of the collection to check.
     * @param {string} indexName - The name of the index to check.
     * @return {Promise<boolean>} A promise that resolves to true if the index exists, false otherwise.
     */
    public async isIndexExists(collectionName: string, indexName: string): Promise<boolean> {
        const collection = this.getConnection().collection(collectionName);
        const indexes = await collection.indexes();
        return indexes.some((index) => index.name === indexName);
    }

    /**
     * Safely creates an index on the specified collection if it does not already exist.
     *
     * @param {string} collectionName - The name of the collection on which to create the index.
     * @param {IndexSpecification} indexSpec - The specification of the index to create.
     * @param {CreateIndexesOptions} [options] - Optional settings for index creation.
     */
    public async safeCreateIndex(
        collectionName: string,
        indexSpec: IndexSpecification,
        options?: CreateIndexesOptions
    ): Promise<void> {
        const collection = this.getConnection().collection(collectionName);
        const indexName = options?.name || Object.keys(indexSpec).join("_");
        const indexExists = await this.isIndexExists(collectionName, indexName);
        if (!indexExists) {
            await collection.createIndex(indexSpec, options);
        }
    }

    /**
     * Checks if a collection with the specified name exists in the database.
     *
     * @param {string} collectionName - The name of the collection to check.
     * @return {Promise<boolean>} A promise that resolves to true if the collection exists, false otherwise.
     */
    public async isCollectionExists(collectionName: string): Promise<boolean> {
        const collections = await this.getConnection().listCollections({ name: collectionName }).toArray();
        return collections.length > 0;
    }

    /**
     * Safely creates a collection if it does not already exist.
     * This method checks for the existence of the collection
     * before attempting to create it.
     *
     * @param {string} collectionName - The name of the collection to create.
     */
    public async safeCreateCollection(collectionName: string): Promise<void> {
        const collectionExists = await this.isCollectionExists(collectionName);
        if (!collectionExists) {
            await this.getConnection().createCollection(collectionName);
        }
    }
}
