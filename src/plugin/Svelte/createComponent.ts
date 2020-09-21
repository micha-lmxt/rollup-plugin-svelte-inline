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
        props.filter(v => !v.startsWith("_b")).map(v => `export let ` + v).join(`;`) + ";" +
        props.filter(v => v.startsWith("_b")).map(v => (`export let ` + v + `;\n$: ` + v + `(` + v.slice(2) + `);\n`)).join(";") + ";" +
        `</script>` +
        rec.code;
    console.log(code);
    console.log("-------------------------------------------")
    return { name: name, code: code };
}