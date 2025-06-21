declare namespace JSON5 {
    function readFile<T = any>(path: string): Promise<T>;
    function convertToJSON(text: string): string;
    function parse<T = any>(text: string): T;
}
export default JSON5;
