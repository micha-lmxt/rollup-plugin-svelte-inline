interface BaseComponentReceipt{
    name:string
}
export interface ComponentReceipt extends BaseComponentReceipt {

    props: string[],
    code: string,
    functionName?:undefined
}

export const createSvelteComponents = (components: (ComponentReceipt | FunctionalComponentReceipt)[],imports:string) => {

    return components.map(v => v.functionName !== undefined ? createFunctionalComponent(v,imports) : createComponent(v,imports));
}
const createComponent = (rec: ComponentReceipt,imports:string) => {
    console.log("-------------------------------------------")
    console.log(rec.code)


    const { name, props } = rec;
    const code = `<script>\n` +
        imports + `;`+
        props.filter(v => !v.startsWith("_b")).map(v => `export let ` + v).join(`;`) + ";" +
        props.filter(v => v.startsWith("_b")).map(v => (`export let ` + v + `;\n$: ` + v + `(` + v.slice(2) + `);\n`)).join(";") + ";" +
        `</script>` +
        rec.code;
    console.log(code);
    console.log("-------------------------------------------");
    return { name: name, code: code };
}

interface FunctionalComponentReceipt extends BaseComponentReceipt {
    functionName: string,
    fromFile: string,
    propsobj: { [key: string]: any }
}

const createFunctionalComponent = (rec: FunctionalComponentReceipt,imports:string) => {

    const { functionName, fromFile, propsobj} = rec;
    const code = `<script>` +
        `import {` + functionName + ` as __f} from '` + fromFile + `';\n` +
        imports + ";" +
        Object.keys(propsobj).map(key => `export let ` + propsobj[key]).join(`;\n`) +
        `let __w;\n` +
        `$: __w =__f({` + Object.keys(propsobj).map(key => key + ":" + propsobj[key]).join(`,`) + `});\n` +
        `</script>\n` +
        `<svelte:component this={__w.component}  {...(__w.props||{})}/>`;
    return { name: name, code: code }
}