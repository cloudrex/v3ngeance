import axios, {AxiosResponse} from "axios";
import {IAppOptions} from "./app";
import {GuildMember, PermissionResolvable} from "discord.js";

const moderationPowers: PermissionResolvable[] = [
    "MANAGE_CHANNELS",
    "MANAGE_GUILD",
    "BAN_MEMBERS",
    "MANAGE_MESSAGES",
    "MANAGE_ROLES",
    "MANAGE_EMOJIS"
];

export default abstract class Utils {
    public static getRandomInt(min: number, max: number): number {
        // TODO

        return 0;
    }

    public static hasModerationPowers(member: GuildMember): boolean {
        return member.hasPermission(moderationPowers as any, false, true, true);
    }

    public static getOptions(): IAppOptions {
        const options: IAppOptions = process.env as any;
    
        if (options.PREPARE_NODE_AMOUNT !== "all") {
            options.PREPARE_NODE_AMOUNT = parseInt(options.PREPARE_NODE_AMOUNT as any);
        }

        if (options.TARGET_GUILD_CHANNELS_AVOID !== undefined) {
            options.TARGET_GUILD_CHANNELS_AVOID = (options.TARGET_GUILD_CHANNELS_AVOID as any).split(",");
        }
        else {
            options.TARGET_GUILD_CHANNELS_AVOID = [];
        }

        if (!options.TARGET_GUILD_INVITE_CODE) {
            // TODO: Also assure/match the invite to the guild
            throw new Error("[Utils.getOptions] No guild invite code was specified");
        }

        options.MODE_AVOID_STAFF = (options.MODE_AVOID_STAFF as any) == "true";
    
        return options;
    }

    public static async join(invite: string, token: string): Promise<boolean> {
        const response: AxiosResponse = await axios.post(`https://discordapp.com/api/v6/invite/${invite}`, undefined, {
            headers: {
                authorization: token
            }
        });

        return response.status === 200;
    }
}