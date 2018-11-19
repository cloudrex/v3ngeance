import fs from "fs";
import {Client} from "discord.js";

type Snowflake = string;

export enum AttackMode {
    Random = "random",
    Scoped = "scoped",
    RandomPings = "random-pings",
    DMs = "dms"
}

export enum MessagesMode {
    Random = "random",
    Sequence = "sequence"
}

export type IAppOptions = {
    TARGET_GUILD_ID: Snowflake;
    TARGET_GUILD_INVITE_CODE: string;
    TARGET_GUILD_CHANNEL: Snowflake;
    
    TOKENS_SOURCE_PATH: string;
    PREPARE_NODE_AMOUNT: number | "all";
    PREPARE_JOIN_INTERVAL: number;
    PREPARE_CHANGE_NAMES: boolean;
    PREPARE_NAMES_RANDOM: boolean;
    PREPARE_NAMES_RANDOM_LENGTH: number;
    PREPARE_WAIT_VERIFIED: boolean;
    
    MODE: AttackMode;
    MODE_AVOID_STAFF: boolean;
    MODE_RANDOM_PINGS_GHOST_PINGS: boolean;
    MODE_RANDOM_PINGS_OFFLINES_FIRST: boolean;
    MODE_SCOPED_CHANNEL_ID: Snowflake;
    MODE_SCOPED_SPREAD: boolean;

    MESSAGES_SOURCE_PATH: string;
    MESSAGES_MODE: MessagesMode;
    MESSAGES_SEND_INTERVAL: number;
}

export default class App {
    private readonly options: IAppOptions;
    private readonly verbose: boolean;

    private messages: string[];
    private tokens: string[];
    private nodes: Client[];

    public constructor(options: IAppOptions, verbose: boolean = true) {
        this.verbose = verbose;
        this.options = options;
        this.messages = [];
        this.tokens = [];
        this.nodes = [];
    }

    public init(): this {
        this.syncTokens();
        this.syncMessages();

        return this;
    }

    public syncMessages(): this {
        if (!fs.existsSync(this.options.MESSAGES_SOURCE_PATH)) {
            throw new Error("[App.syncMessages] Messages source path does not exist");
        }

        this.messages = JSON.parse(fs.readFileSync(this.options.MESSAGES_SOURCE_PATH).toString());

        if (!Array.isArray(this.messages)) {
            throw new Error("[App.syncMessages] Expecting messages to be an array");
        }

        return this;
    }

    public syncTokens(): this {
        if (!fs.existsSync(this.options.TOKENS_SOURCE_PATH)) {
            throw new Error("[App.syncTokens] Tokens source path does not exist");
        }

        this.tokens = JSON.parse(fs.readFileSync(this.options.TOKENS_SOURCE_PATH).toString());

        if (!Array.isArray(this.tokens)) {
            throw new Error("[App.syncTokens] Expecting tokens to be an array");
        }

        return this;
    }

    public async attack(): Promise<boolean> {
        if (!this.isPopulated()) {
            return false;
        }

        this.log(`Loading ${this.tokens.length} node(s) ...`);

        const loaded: number = await this.loadNodes();

        if (loaded === 0) {
            this.log("No nodes could be loaded");

            return false;
        }

        this.log(`Loaded ${loaded}/${this.tokens.length} node(s)`);
        
        return true;
    }

    private async loadNodes(): Promise<number> {
        this.nodes = [];

        let loaded: number = 0;

        // TODO: Check for successful node creation
        for (let i: number = 0; i < this.tokens.length; i++) {
            this.nodes.push(await this.createNode(this.tokens[i]));
            loaded++;
        }

        return loaded;
    }

    // TODO: Catch login errors (invalid tokens)
    private async createNode(token: string): Promise<Client> {
        const node: Client = new Client();

        return new Promise((resolve) => {
            node.on("ready", () => {
                resolve();
            });

            node.login(token);
        });
    }

    public isPopulated(): boolean {
        return this.messages.length > 0 && this.tokens.length > 0;
    }

    private log(msg: string): this {
        if (this.verbose) {
            console.log(msg);
        }

        return this;
    }
}

const options: IAppOptions = process.env as any;

export const app: App = new App(options);

async function init(): Promise<void> {
    await app.init().attack();
}

init();