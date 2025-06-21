import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
var Hash;
(function (Hash) {
    async function file(filepath) {
        const stream = fs.createReadStream(filepath);
        const hash = crypto.createHash('sha1');
        hash.setEncoding('hex');
        return new Promise(resolve => {
            stream.on('end', function () {
                hash.end();
                resolve(hash.read());
            });
            stream.pipe(hash);
        });
    }
    Hash.file = file;
    const hashes = {};
    async function fileChanged(filepath) {
        const resolvedPath = path.resolve(filepath);
        const hash = await file(resolvedPath);
        if (hash === hashes[resolvedPath])
            return false;
        hashes[resolvedPath] = hash;
        return true;
    }
    Hash.fileChanged = fileChanged;
})(Hash || (Hash = {}));
export default Hash;
