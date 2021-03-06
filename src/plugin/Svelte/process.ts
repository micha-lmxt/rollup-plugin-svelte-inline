
import { createSvelteComponents, ComponentReceipt } from './createComponent';
import { parse } from '@babel/parser';
import traverse from "@babel/traverse";


interface DefinedVar { var: string, isSvelte: boolean, imported: boolean }

export const processSvelte = (code: string, addReplacer: (name: string, code: string) => void, id: string) => {

    const s1 = code.split("<script");
    if (s1.length !== 2 && s1.length !== 1) {
        return;
    }
    let [script, rest] = s1.length === 1 ? ["", ""] : s1[1].split(">").slice(1).join(">").split("</script>");

    const noscript = s1[0] + rest;

    const walkRes = walkScript(script);

    const s2 = noscript.split("<style");

    if (s2.length !== 2 && s2.length !== 1) {
        return;
    }

    let [style, html] = s2.length === 1 ? [">", ""] : s2[1].split("</style>");
    style = "<style" + style + "</style>";



    html = s2[0] + html;

    html = replaceSvelteLogic(html);


    const walkRes2 = walkNonScript(html, walkRes.components.length, walkRes.definedVars);

    const rebuiltScript = "<script" + s1[1].split(">")[0] + ">\n" +
        (walkRes2.hasInlineComponent ? "import SV__InlineGeneralComponent from 'rollup-plugin-svelte-inline/InlineComponent.svelte';\n" : "") +
        walkRes.components.concat(walkRes2.components).map(v => "import " + v.name + " from '" + makeNewComponentPath(id, v.name) + "';").join("\n") + "\n" +
        walkRes.script +
        "</script>";


    const resHtml = replaceSvelteLogic(walkRes2.script, true);

    createSvelteComponents(walkRes.components.concat(walkRes2.components), walkRes.imports).forEach(v => addReplacer(makeNewComponentPath(id, v.name), v.code));

    console.log(rebuiltScript + "\n" + style + "\n" + resHtml);
    return rebuiltScript + "\n" + style + "\n" + resHtml;
}

const makeNewComponentPath = (id: string, name: string): string => {

    const rid = id.slice(0, id.length - 7);
    return rid + name + ".svelte";

}

const isJSX = (node: any) => node.type === "JSXElement";

const trivialElement = (x: any) => (x && x.type === 'StringLiteral' ||
    (x.type === "JSXExpressionContainer" && x.expression.type.endsWith("Literal")));

/** checks a node, if it is a jsx component. */
const readJSXAttributes = (attrs: any[], level: number, script: string, offset: number) => {
    let newscript = script;
    let newoffset = offset;
    const props: { [key: string]: string } = {};
    for (let i = 0; i < attrs.length; i++) {

        const property = attrs[i];

        // has eg. bind:... or on:.. 
        const hasNameSpace = property.name.type === 'JSXNamespacedName';
        const wantBind = hasNameSpace && property.name.namespace.name === "bind";
        const wantClass = hasNameSpace && property.name.namespace.name === "class";
        if ((property.value === null && !wantClass && !wantBind) ||
            (trivialElement(property.value))) {
            continue;
        }

        const newProp = "__z_" + level + "_" + i;
        let exchange = newProp;
        let startEnd = property.value;

        const inProp = hasNameSpace ? property.name.name.name : property.name.name;


        // handle empty class or bind assignments

        let whereinput = property.end;
        if (property.value === null && (wantBind || wantClass)) {

            // empty assignment, eg. "bind:value"
            exchange = "={" + newProp + "}";

            startEnd = { start: whereinput, end: whereinput };

            //todo: handle event forwarding
        } else {
            startEnd = { start: startEnd.start + 1, end: startEnd.end - 1 }
        }

        let { replace: repl, script: s1, offset: o1 } = exchangeNodeBy(startEnd, exchange, newscript, newoffset);
        props[newProp] = repl || inProp, newscript = s1, newoffset = o1;
        if (wantBind) {
            props["_b" + newProp] = "v=>{" + (repl || inProp) + "=v}";

        }

    }
    return { newscript, newoffset, newprops: props }
}

// used in the walk procedure. 
const checkJSX = (node: any, definedVars: DefinedVar[], script: string, offset: number, level = 0, top = false, componentnum = 0) => {

    let newoffset = offset;
    let newlevel = level;
    let props: { [key: string]: string } = {};
    let newscript = script;
    let foundSomething: boolean | ComponentReceipt = false;


    if (isJSX(node)) {
        
        const elementName = node.openingElement?.name?.name;
        if (elementName.slice(0, 1) !== elementName.slice(0, 1).toLowerCase()) {
            const defined = definedVars.find(v => elementName === v.var);
            if (!defined) {
                console.log("Warning, did not find Component: " + elementName);
            } else {
                if (!defined.isSvelte) {

                }
            }
        }

        // JSX element definition
        const attrRes = readJSXAttributes(node.openingElement?.attributes || [], newlevel, newscript, newoffset);
        props = Object.assign(props, attrRes.newprops);
        newscript = attrRes.newscript;
        newoffset = attrRes.newoffset;


        const children = node.children || [];

        for (let i = 0; i < children.length; i++) {
            // walk through the arguments

            const res = checkJSX(children[i], definedVars, newscript, newoffset, newlevel + 1);

            newlevel = res.level;
            newscript = res.script;
            newoffset = res.offset;
            props = Object.assign({}, props, res.props);
        }
        if (top) {
            const newComponentName = "IC___" + componentnum;
            const exchange = "{component:" + newComponentName + ",props:{" + Object.keys(props).map(v => v + ":" + props[v]).join(",") + "}}";
            const start = node.start + offset;
            const end = node.end + newoffset;
            const code = newscript.slice(start, end);

            foundSomething = { name: newComponentName, props: Object.keys(props), code: code };
            newscript = exchange;
            newoffset = offset + exchange.length - end + start;


        }

    } else if ((!top) && node.type === "JSXExpressionContainer" && !trivialElement(node) && node.start && node.end) {

        const newProp = "__y_" + level;
        let { replace: repl, script: s1, offset: o1 } = exchangeNodeBy(node, "{" + newProp + "}", newscript, newoffset);
        props[newProp] = repl.slice(1, repl.length - 1), newscript = s1, newoffset = o1;
        console.log(props)

    }
    return { script: newscript, offset: newoffset, props: props, level: newlevel, change: foundSomething }
}

// check the non-script part of the svelte document
const checkOuterJSX = (node: any, script: string, offset: number, defindeVars: DefinedVar[], componentnum = 0) => {

    let newoffset = offset;
    let newscript = script;
    let foundSomething: ComponentReceipt[] = [];
    let hasInlineGeneralComponent = false;

    if (isJSX(node)) {
        // JSX element definition

        // check children
        const children = node.children||[];
        for (let i = 0; i < children.length; i++) {
            
            const res = checkOuterJSX(node.children[i], newscript, newoffset, defindeVars, componentnum + foundSomething.length);
            newscript = res.script;
            newoffset = res.offset;
            if (res.hasInlineGeneralComponent) {
                hasInlineGeneralComponent = true;
            }
            foundSomething.push(...res.change);
        }


    } else if (node.type !== "JSXText" && !trivialElement(node) && node.start && node.end && node.expression) {

        /** todo: handle conditional expression via svelte if stuff 
        if (node.type === 'ConditionalExpression'){
            const test = node.test
            
            const res1 = checkOuterJSX(node.consequent, newscript, newoffset,componentnum + foundSomething.length);
            newscript = res1.script;
            newoffset = res1.offset;
            foundSomething.push(...res1.change);
            
            const res2 = checkOuterJSX(node.alternate, newscript, newoffset,componentnum + foundSomething.length);
            newscript = res2.script;
            newoffset = res2.offset;
            foundSomething.push(...res2.change);
            
        }
        */
        // todo: transform this case to svelte like if else.
        /*
        if (node.type === 'LogicalExpression'){

        }
        */
        const expr = node.expression;
        
        
        const oldscript = newscript.slice(expr.start + newoffset, expr.end + newoffset);
        // remove surrounding mustache bracket {}
        const before = newscript.slice(0, expr.start + newoffset);
        const between = before.slice(before.lastIndexOf("{") + 1);

        
        if (!between.includes("/*logicreplace-") && !oldscript.includes("/*logicreplace-")) {

            const after = newscript.slice(expr.end + newoffset);
            const beforelen = newscript.length;


            // check for logicexchange


            const subwalk = walkScript("let a = " + oldscript, 8, componentnum + foundSomething.length);

            console.log(subwalk.script)
            newscript = before.slice(0, before.lastIndexOf("{")) + "<SV__InlineGeneralComponent __z={" + subwalk.script + "}/>" + after.slice(after.indexOf("}") + 1);
            hasInlineGeneralComponent = true;
            foundSomething.push(...subwalk.components);
            newoffset += newscript.length - beforelen;
        }else{
            console.log("skipped")
        }
    }
    return { script: newscript, offset: newoffset, change: foundSomething, hasInlineGeneralComponent: hasInlineGeneralComponent }
}

const exchangeNodeBy = (node: any, by: string, script: string, offset: number) => {

    const start = offset + node.start;
    const end = offset + node.end;
    const replace = script.slice(start, end);

    return {
        replace,
        script: script.slice(0, start) + by + script.slice(end),
        offset: offset + by.length - node.end + node.start
    };

}

const getAST = (script: string, type = "tsx") => {
    /*const res = transform(script, {
        filename: "component." + type,
        ast: true,
        presets: ["@babel/preset-typescript"],
        plugins: [["@babel/plugin-transform-react-jsx", { throwIfNamespace: false }]],


    });
    if (res === undefined) {
        throw ("Babel result undefined");
    }
    return res!.ast;*/
    return parse(script, {
        sourceType: "module",
        plugins: ["jsx", "typescript"]
    })
}


const walkScript = (script: string, base_script_offset = 0, componentNum = 0) => {
    let script_offset = 0;

    let ast = getAST(script);


    let skipto = base_script_offset;
    let outerSkip = base_script_offset;
    const newComponents: ComponentReceipt[] = [];
    const definedVars: DefinedVar[] = [];
    let imports = "";
    if (!ast) {
        return { script, components: newComponents, definedVars, imports }
    }

    traverse(ast, {
        enter: function (path) {
            const node = path.node;
            /*
            if(node.type==="Identifier"){
                console.log(node.name)
                console.log(path.isReferencedIdentifier());
                if (path.isReferencedIdentifier()){
                    console.log(path.scope.hasBinding(node.name));
                }
                
            }*/


            if (node.start === undefined || node.start! < skipto) {
                return;
            }


            const checkres = checkJSX(node, definedVars, script, script_offset, 0, true, componentNum + newComponents.length);
            if (checkres.change) {

                const subwalk = walkScript("let a = " + checkres.script, 8, componentNum + newComponents.length + 1);

                const ex = exchangeNodeBy(node, subwalk.script, script, script_offset);

                script_offset = ex.offset;
                script = ex.script;

                newComponents.push(checkres.change as ComponentReceipt, ...subwalk.components);

                // skip all sub walking
                if (node.end) {
                    skipto = node.end;
                }

            }
            // check code for assignments
            if (node.start! >= outerSkip && node.type === 'Program') {
                const nob = (node as unknown) as { body?: { start: number, end: number }[], start: number, end: number };
                let start = node.start!;
                let j = 0;
                const bl = nob.body ? nob.body.length : 0;

                while (start < node.end!) {


                    let bodyElNode: any | undefined = undefined;
                    // parse body elements or skip to node end
                    const hasMoreBody = (j < bl);
                    let end = 0;
                    if (!hasMoreBody) {
                        end = nob.end;
                    } else {
                        const bodyEl = nob.body![j];
                        if (start < bodyEl.start) {
                            end = bodyEl.start;
                        } else {
                            end = bodyEl.end;
                            bodyElNode = bodyEl;
                            j++;
                        }
                    }

                    const code = script.slice(start + script_offset, end + script_offset);
                    start = end;
                    if (code.trim().length == 0 || (bodyElNode && bodyElNode.type === "EmptyStatement")) {
                        continue;

                    }
                    /*
                    console.log("-----------------code-------------------");
                    console.log(code);
                    */

                    if (bodyElNode) {

                        let hasdec = false;
                        if (bodyElNode.declaration) {
                            if (bodyElNode.declaration.declarations) {
                                if (bodyElNode.declaration.declarations) {
                                    bodyElNode.declaration.declarations.forEach((v: any) => { definedVars.push({ var: v.id.name, isSvelte: false, imported: false }) });
                                    hasdec = true;
                                }
                            }

                            hasdec = true;
                        }
                        if (bodyElNode.declarations) {
                            bodyElNode.declarations.forEach((v: any) => { definedVars.push({ var: v.id.name, isSvelte: false, imported: false }) });
                            hasdec = true;
                        }
                        if (!hasdec) {
                            if (bodyElNode.type === 'ImportDeclaration') {

                                imports += code + ";";
                                const fromSvelte = bodyElNode.source.value.endsWith(".svelte");

                                bodyElNode.specifiers.forEach((v: any) => definedVars.push({ var: v.local.name, isSvelte: fromSvelte && v.type === 'ImportDefaultSpecifier', imported: true }));

                            } else {
                                //console.log(bodyElNode);
                            }
                        }
                    } else {

                        // handle imports
                        const imp = code.split("import ").slice(1);
                        imports += imp.join("import ");
                        for (let i = 0; i < imp.length; i++) {
                            const im = imp[i];
                            if (im.trim().startsWith("type")) {
                                continue;
                            }
                            const fr = im.split("from");
                            if (fr.length !== 2) {
                                continue;
                            }
                            const fromSvelte = fr[1].replace(/[;`'"\n]/g, "").trim().endsWith(".svelte");
                            const fb = fr[0].indexOf("{");

                            if (fb < 0) {
                                // only default
                                definedVars.push({ var: fr[0].trim(), isSvelte: fromSvelte, imported: true });
                            } else {
                                const lb = fr[0].lastIndexOf("}");
                                const nondefault = fr[0].slice(fb, lb).split(/[{,}]/g).filter(v => v.length > 0);
                                for (let nd of nondefault) {
                                    const v = (nd.includes(" as ") ? nd.split(" as ")[1] : nd).trim();
                                    definedVars.push({ var: v, isSvelte: false, imported: true });
                                }

                                const defaultEx = fr[0].slice(0, fb) + fr[0].slice(lb + 1).replace(",", "").trim();
                                if (defaultEx.length > 0) {
                                    definedVars.push({ var: defaultEx, isSvelte: fromSvelte, imported: true });
                                }

                            }

                        }
                    }

                    /*
                    if (code.trim().length>0){
                        console.log("-----------------end code-------------------");
                    }
                    */
                }
                outerSkip = node.end!;

            }

        },
        /*
        leave: function (node, parent, prop, index) {
            // some code happens
        }
        */
    });
    console.log(definedVars);
    return { script: script.slice(base_script_offset), components: newComponents, definedVars, imports }
}

const walkNonScript = (
    nonscript: string,
    nComponents: number,
    definedVars: DefinedVar[]
) => {

    let scriptSp = nonscript.split("<!--");
    let script = scriptSp[0] + scriptSp.slice(1).map(v => v.split("-->")[1]).join("");

    let ast = getAST("let _= <>" + script + "</>");

    //let script = nonscript;
    let script_offset = -9;
    const newComponents: ComponentReceipt[] = [];
    let skipto = 9;
    let hasInlineComponent = false;
    traverse(ast, {
        enter: function (path/*nod, parent: any, prop: any, index?: number | null*/) {
            const node = path.node// nod as (BaseNode & { start: undefined | number, end: undefined | number });
            if (node.start === undefined || node.start! < skipto /*|| isNaN(parseInt(index as any))*/) {
                return;
            }
            
            const checkres = checkOuterJSX(node, script, script_offset, definedVars, nComponents + newComponents.length);
            if (checkres.hasInlineGeneralComponent) {
                hasInlineComponent = true;
            }

            script = checkres.script;
            script_offset = checkres.offset;

            if (checkres.change.length > 0) {
                newComponents.push(...checkres.change);

            }
            if (node.end) {
                skipto = node.end;
            }
        },
        /*
        leave: function (node, parent, prop, index) {
            // some code happens
        }
        */
    });
    return { script, components: newComponents, hasInlineComponent }
}

const replaceSvelteLogic = (code: string, back = false) => {
    const replace = [
        { i: /#if/g, o: "#if" },
        { i: /\/if/g, o: "/if" },
        { i: /:else if/g, o: ":else if" },
        { i: /:else/g, o: ":else" },
        { i: /#each/g, o: "#each" },
        { i: /#await/g, o: "#await" },
        { i: /:then/g, o: ":then" },
        { i: /:catch/g, o: ":catch" },
        { i: /\/await/g, o: "/await" }

    ]
    if (back) {
        replace.forEach(v => {
            code = code.replace(RegExp("/\\*logicreplace-" + v.o + "-\\*/", "g"), v.o)
        })

    } else {
        replace.forEach(v => {
            code = code.replace(v.i, "/*logicreplace-" + v.o + "-*/");
        })
    }
    return code;
}