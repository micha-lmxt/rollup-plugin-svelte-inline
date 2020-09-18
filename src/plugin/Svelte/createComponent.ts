export interface ComponentReceipt {
    name: string,
    props: string[],
    code: string
}

export const createSvelteComponents = (components: ComponentReceipt[]) => {

    return components.map(v => createComponent(v));
}
const createComponent = (rec: ComponentReceipt) => {
    console.log("-------------------------------------------")
    console.log(rec.code)


    const { name, props } = rec;
    const code = `<script>` +
        props.map(v => {
            if (v.startsWith("_b")) {
                return `export let ` + v + `;\n$: ` + v + `(` + v.slice(2) + `);\n`;
            }
            return `export let ` + v;
        }).join(`;`) +
        `</script>` +
        rec.code;
    console.log(code);
    console.log("-------------------------------------------")
    return { name: name, code: code };
}