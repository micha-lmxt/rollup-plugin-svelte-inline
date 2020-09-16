
const PREFIX = ``;
import path from 'path';
import {processSvelte} from './processSvelte';



export const inlineSvelte = () => {
    const replacer = {}
    const resolvedIds = new Map();
    const addReplacer = (name, code) => {
        replacer[name] = code;
        resolvedIds.set(path.resolve(name), replacer[name]);
    }


    return {
        name: "rollup-plugin-inline-svelte",

        transform(code, id) {
            console.log("transform: " + id);

            if (id.endsWith(".svelte")) {
                processSvelte(code,addReplacer,id);
            }

        },
        resolveId(id, importer) {
            if (id in replacer) return PREFIX + id;

            if (importer) {
                // eslint-disable-next-line no-param-reassign
                if (importer.startsWith(PREFIX)) importer = importer.slice(PREFIX.length);
                const resolved = path.resolve(path.dirname(importer), id);
                if (resolvedIds.has(resolved)) return PREFIX + resolved;
            }
        },

        load(id) {
            if (id.startsWith(PREFIX)) {
                // eslint-disable-next-line no-param-reassign
                id = id.slice(PREFIX.length);

                return id in replacer ? replacer[id] : resolvedIds.get(id);
            }
        }
    }
}
export default inlineSvelte;

