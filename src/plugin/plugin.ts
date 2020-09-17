
const PREFIX = ``;
import path from 'path';
import {processSvelte} from './Svelte/process';


export const inlineSvelte = () => {

    const replacer : {[key: string]: string} = {}
    const resolvedIds = new Map();
    const addReplacer = (name : string, code : string) => {

        replacer[name] = code;
        resolvedIds.set(path.resolve(name), replacer[name]);
        
    }


    return {
        name: "rollup-plugin-inline-svelte",

        transform(code : string, id : string) {
            console.log("transform: " + id);

            if (id.endsWith(".svelte")) {
                processSvelte(code,addReplacer,id);
            }

        },
        resolveId(id : string, importer? :string) {
            if (id in replacer) return PREFIX + id;

            if (importer) {
                // eslint-disable-next-line no-param-reassign
                if (importer.startsWith(PREFIX)) importer = importer.slice(PREFIX.length);
                const resolved = path.resolve(path.dirname(importer), id);
                if (resolvedIds.has(resolved)) return PREFIX + resolved;
            }
        },

        load(id : string) {

            if (id.startsWith(PREFIX)) {

                // eslint-disable-next-line no-param-reassign
                id = id.slice(PREFIX.length);

                return id in replacer ? replacer[id] : resolvedIds.get(id);
            }
        }
    }
}
export default inlineSvelte;

