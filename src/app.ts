import fs from "fs";

export type IAppOptions = {
    targetGuildId: Snowflake;
    targetGuildInviteCode: string;
    targetGuildChannel: Snowflake;
    
    nodesSourcePath: string;
    prepareNodeAmount: number | "all";
    prepareJoinInterval: number;
}

export default class App {
    private messages: string[];
    private tokens: string[];

    public constructor() {
        this.messages = [];
        this.tokens = [];
    }

    public syncMessages(): Promise<this> {
        return fs.readFileSync
    }

    public isPopulated(): boolean {
        return this.messages.length > 0 && this.tokens.length > 0;
    }
}