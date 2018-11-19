import {Client, Guild, TextChannel} from "discord.js";
import App, { AttackMode } from "./app";

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
            throw new Error("[App.populateChannelCache] Expecting guild");
        }

        this.channelCache = this.guild.channels.filter((channel: TextChannel) => {
            // TODO: Also check for SEND_MESSAGES permission
            return channel.type === "text";
        });

        return this;
    }

    private getRandomChannel(): TextChannel {
        if (!this.channelCache) {
            this.populateChannelCache;

            if (!this.channelCache) {
                throw new Error("[App.getRandomChannel] Expecting channel cache to be populated");
            }
        }

        
    }

    public async start(): Promise<number> {
        let sent: number = 0;

        if (this.app.options.MODE !== AttackMode.DMs && (!this.guild || !this.channel)) {
            throw new Error("[App.start] Expecting guild and channel");
        }

        switch (this.app.options.MODE) {
            case AttackMode.Random: {

            }
        }

        return sent;
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