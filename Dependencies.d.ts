declare namespace Dependencies {
    function get(dependency: string): Promise<string>;
}
export default Dependencies;
