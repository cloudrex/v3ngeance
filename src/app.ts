// Load environment variables
require("dotenv").config();

import path from "path";
import fs from "fs";
import {Snowflake,} from "discord.js";
import Utils from "./utils";
import Worker from "./worker";

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
    TARGET_GUILD_CHANNELS_AVOID: Snowflake[];
    
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
    public readonly options: IAppOptions;

    private readonly verbose: boolean;
    private readonly worker: Worker;

    public messages: string[];
    public tokens: string[];

    public constructor(options: IAppOptions, verbose: boolean = true) {
        this.verbose = verbose;
        this.options = options;
        this.messages = [];
        this.tokens = [];
        this.worker = new Worker(this);
    }

    public init(): this {
        this.syncTokens();
        this.syncMessages();

        return this;
    }

    public syncMessages(): this {
        const location: string = this.to(this.options.MESSAGES_SOURCE_PATH);

        if (!fs.existsSync(location)) {
            throw new Error("[App.syncMessages] Messages source path does not exist");
        }

        this.messages = JSON.parse(fs.readFileSync(location).toString());

        if (!Array.isArray(this.messages)) {
            throw new Error("[App.syncMessages] Expecting messages to be an array");
        }

        return this;
    }

    public syncTokens(): this {
        const location: string = this.to(this.options.TOKENS_SOURCE_PATH);

        if (!fs.existsSync(location)) {
            throw new Error("[App.syncTokens] Tokens source path does not exist");
        }

        this.tokens = JSON.parse(fs.readFileSync(location).toString());

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

        const loaded: number = await this.worker.loadNodes();

        if (loaded === 0) {
            this.log("No nodes could be loaded");

            return false;
        }

        this.log(`Loaded ${loaded}/${this.tokens.length} node(s)`);
        await this.worker.prepare();
        this.log(`Launching attack ...`);

        const sent: number = await this.worker.start();

        this.log(`Attack completed | ${sent} message(s) sent`);
        
        return true;
    }

    public isPopulated(): boolean {
        return this.messages.length > 0 && this.tokens.length > 0;
    }

    public log(msg: string): this {
        if (this.verbose) {
            console.log(msg);
        }

        return this;
    }

    private to(location: string): string {
        return path.join(__dirname, "..", location);
    }
}

export const app: App = new App(Utils.getOptions());

async function init(): Promise<void> {
    await app.init().attack();
}

init();