import {IAppOptions} from "./app";

export default abstract class Utils {
    public static getRandomInt(min: number, max: number): number {
        // TODO

        return 0;
    }

    public static getOptions(): IAppOptions {
        const options: IAppOptions = process.env as any;
    
        if (options.PREPARE_NODE_AMOUNT !== "all") {
            options.PREPARE_NODE_AMOUNT = parseInt(options.PREPARE_NODE_AMOUNT as any);
        }
    
        return options;
    }
}