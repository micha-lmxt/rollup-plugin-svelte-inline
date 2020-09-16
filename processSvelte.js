
var walk = require('estree-walker').walk;


export const processSvelte = (code, addReplacer, id) => {

    const s1 = code.split("<script ");
    if (s1.length !== 2) {
        return;
    }
    let [script, rest] = s1[1].split(">").slice(1).join(">").split("</script>");

    const noscript = s1[0] + rest;
    console.log(noscript)
    console.log(script)

    const walkRes = walkScript(script);

    const walkRes2 = walkNonScript(noscript);

    const newSveltes = createSvelteComponents(
        walkRes.components.concat(walkRes2.components)
    );
    /*
    console.log(code);
    if (code.includes("const qq = <div>xyz</div>;")) {
        addReplacer('src/myTest.svelte',
        `<div>xyz</div>`);
        return code.replace("const qq = <div>xyz</div>;", "import XXX from './myTest.svelte';")
    }
    return code.replace(/texty/g, "huhu");
    */
    console.log("Script: ")
    console.log(walkRes.script)
    console.log("Components: ")
    console.log(walkRes.components)
}

const checkJSX = (node, script, offset, level = 0, top = false, componentnum = 0) => {

    let newoffset = offset;
    let newlevel = level;
    let props = {};
    let newscript = script;
    let foundSomething = false;

    if (node.type === 'CallExpression' && node.callee && node.callee.object && node.callee.object.name === "React") {

        // JSX element definition

        for (let i = 0; i < node.arguments.length; i++) {
            // walk through the arguments

            const res = checkJSX(node.arguments[i], newscript, newoffset, newlevel + 1);
            newlevel = res.level;
            newscript = res.script;
            newoffset = res.offset;
            props = Object.assign({}, props, res.props);
        }
        if (top) {
            const newComponentName = "__ic_" + componentnum;
            const exchange = "{component:" + newComponentName + ",props:{" + Object.keys(props).map(v => v + ":" + props[v]).join(",") + "}}";
            const start = node.start + offset;
            const end = node.end + newoffset;
            const code = newscript.slice(start, end);

            foundSomething = { name: newComponentName, props: Object.keys(props), code: code };
            newscript = exchange;
            newoffset = offset + exchange.length - end + start;

        }

    } else if ((!top) && node.type === "ObjectExpression" && node.properties) {

        for (let i = 0; i < node.properties.length; i++) {

            const property = node.properties[i];
            console.log("key: ")
            console.log(property.key)
            if (property.value) {
                console.log("value: ")
                console.log(property.value.type)
                console.log("start: " + property.value.start + ", end: " + property.value.end)
            } else { console.log("no value") }
            if (property.value.type === "StringLiteral" || (property.value.type === "BooleanLiteral" && property.value.start > -1)) {
                // todo: transition, in, out import may be needed
                continue;
            }

            const newProp = "__z_" + level + "_" + i;
            let exchange = newProp;
            let startEnd = property.value;

            const inProp = property.key.type === "StringLiteral" ? property.key.value : (property.key.name || property.key.value);

            const inPropSplit = inProp.split(":");
            let inPropName = inPropSplit[inPropSplit.length > 1 ? 1 : 0].split("|")[0];
            if (property.value.type === "BooleanLiteral") {

                // empty assignment, eg. "bind:value"
                exchange = "={" + newProp + "}";
                startEnd = { start: property.key.end, end: property.key.end };

                //todo: handle event forwarding
            }

            let { replace: repl, script: s1, offset: o1 } = exchangeNodeBy(startEnd, exchange, newscript, newoffset);
            props[newProp] = repl || inPropName, newscript = s1, newoffset = o1;


            if (inPropSplit.length === "" && inPropSplit[0].toLowerCase() === "bind") {
                props["_b" + newProp] = "v=>{" + newProp + "=v}";
            }

        }


    } else if ((!top) && node.type !== "StringLiteral" && node.type !== "NullLiteral" && node.start && node.end) {

        const newProp = "__y_" + level;
        let { replace: repl, script: s1, offset: o1 } = exchangeNodeBy(node, newProp, newscript, newoffset);
        props[newProp] = repl, newscript = s1, newoffset = o1;
    }
    return { script: newscript, offset: newoffset, props: props, level: newlevel, change: foundSomething }
}

const exchangeNodeBy = (node, by, script, offset) => {

    const start = offset + node.start;
    const end = offset + node.end;
    const replace = script.slice(start, end);

    return {
        replace,
        script: script.slice(0, start) + by + script.slice(end),
        offset: offset + by.length - node.end + node.start
    };

}

const getAST = (script, type = "tsx") => {
    const res = require("@babel/core").transform(script, {
        filename: "component." + type,
        ast: true,
        presets: ["@babel/preset-typescript"],
        plugins: [["@babel/plugin-transform-react-jsx", { throwIfNamespace: false }]],

    })
    return res.ast;
}

const walkScript = (script) => {
    console.log("walk:" + script)
    let ast = getAST(script);
    let script_offset = 0;
    let skipto = -1;
    const newComponents = []

    walk(ast, {
        enter: function (node, parent, prop, index) {
            if (node.start === undefined || node.start < skipto) {
                return;
            }
            const checkres = checkJSX(node, script, script_offset, 0, true, newComponents.length);
            if (checkres.change) {

                const subwalk = walkScript("let a = " + checkres.script);

                const ex = exchangeNodeBy(node, subwalk.script, script, script_offset);

                script_offset = ex.offset;
                script = ex.script;

                newComponents.push(checkres.change, ...subwalk.components);

                // skip all sub walking
                skipto = node.end;
            }

        },
        /*
        leave: function (node, parent, prop, index) {
            // some code happens
        }
        */
    });
    return { script, components: newComponents }
}

const walkNonScript = (nonscript) => {
    console.log("walk:" + nonscript)
    let ast = getAST(script, "html");

    const newComponents = [];

    walk(ast, {
        enter: function (node, parent, prop, index) {
            console.log(node)
        },
        /*
        leave: function (node, parent, prop, index) {
            // some code happens
        }
        */
    });
    return { script, components: newComponents }
}