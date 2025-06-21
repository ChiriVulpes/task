declare namespace Hash {
    function file(filepath: string): Promise<string>;
    function fileChanged(filepath: string): Promise<boolean>;
}
export default Hash;
