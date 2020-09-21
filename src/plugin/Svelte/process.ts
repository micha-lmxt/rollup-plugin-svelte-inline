
import { walk } from 'estree-walker';
import { createSvelteComponents, ComponentReceipt } from './createComponent';
import { transform } from '@babel/core';
import { BaseNode } from 'estree';
//var walk = require('estree-walker').walk;


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


    const walkRes2 = walkNonScript(html, walkRes.components.length);

    const rebuiltScript = "<script" + s1[1].split(">")[0] + ">\n" +
        (walkRes2.hasInlineComponent ? "import SV__InlineGeneralComponent from 'rollup-plugin-svelte-inline/InlineComponent.svelte';\n" : "") +
        walkRes.components.concat(walkRes2.components).map(v => "import " + v.name + " from '" + makeNewComponentPath(id, v.name) + "';").join("\n") + "\n" +
        walkRes.script +
        "</script>";


    const resHtml = replaceSvelteLogic(walkRes2.script, true);

    createSvelteComponents(walkRes.components.concat(walkRes2.components)).forEach(v => addReplacer(makeNewComponentPath(id, v.name), v.code));

    return rebuiltScript + "\n" + style + "\n" + resHtml;
}

const makeNewComponentPath = (id: string, name: string): string => {
    // id - .svelte
    const rid = id.slice(0, id.length - 7);
    return rid + name + ".svelte";
}
const isJSX = (node: any) => (node.type === 'CallExpression' && node.callee && node.callee.object && node.callee.object.name === "React")
/** checks a node, if it is a jsx component. */
const checkJSX = (node: any, script: string, offset: number, level = 0, top = false, componentnum = 0) => {

    let newoffset = offset;
    let newlevel = level;
    let props: { [key: string]: string } = {};
    let newscript = script;
    let foundSomething: boolean | ComponentReceipt = false;

    if (isJSX(node)) {

        // JSX element definition

        for (let i = 1; i < node.arguments.length; i++) {
            // walk through the arguments

            const res = checkJSX(node.arguments[i], newscript, newoffset, newlevel + 1);

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

    } else if ((!top) && node.type === "ObjectExpression" && node.properties) {

        for (let i = 0; i < node.properties.length; i++) {

            const property = node.properties[i];

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
            let whereinput = property.end;
            if (property.value.type === "BooleanLiteral") {

                // empty assignment, eg. "bind:value"
                exchange = "={" + newProp + "}";

                startEnd = { start: whereinput, end: whereinput };


                //todo: handle event forwarding
            }

            let { replace: repl, script: s1, offset: o1 } = exchangeNodeBy(startEnd, exchange, newscript, newoffset);
            props[newProp] = repl || inPropName, newscript = s1, newoffset = o1;
            if (inPropSplit.length > 1 && inPropSplit[0].toLowerCase() === "bind") {
                props["_b" + newProp] = "v=>{" + (repl || inPropName) + "=v}";

            }
        }

    } else if ((!top) && node.type !== "StringLiteral" && node.type !== "NullLiteral" && node.start && node.end) {

        const newProp = "__y_" + level;
        let { replace: repl, script: s1, offset: o1 } = exchangeNodeBy(node, newProp, newscript, newoffset);
        props[newProp] = repl, newscript = s1, newoffset = o1;
    }
    return { script: newscript, offset: newoffset, props: props, level: newlevel, change: foundSomething }
}


const checkOuterJSX = (node: any, script: string, offset: number, componentnum = 0) => {


    let newoffset = offset;
    let newscript = script;
    let foundSomething: ComponentReceipt[] = [];
    let hasInlineGeneralComponent = false;

    if (isJSX(node)) {
        if (node.arguments && node.arguments.length > 0) {
            const ar = node.arguments[0]
            console.log(ar.name);


        }

        // JSX element definition

        for (let i = 1; i < node.arguments.length; i++) {
            // walk through the arguments

            const res = checkOuterJSX(node.arguments[i], newscript, newoffset, componentnum + foundSomething.length);
            newscript = res.script;
            newoffset = res.offset;
            if (res.hasInlineGeneralComponent) {
                hasInlineGeneralComponent = true;
            }
            foundSomething.push(...res.change);


        }


    } else if (node.type === "ObjectExpression" && node.properties) {
        //nothing here
    } else if (node.type !== "StringLiteral" && node.type !== "NullLiteral" && node.start && node.end) {

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
        const oldscript = newscript.slice(node.start + newoffset, node.end + newoffset);
        // remove surrounding mustache bracket {}
        const before = newscript.slice(0, node.start + newoffset);
        const between = before.slice(before.lastIndexOf("{") + 1);
        if (!between.includes("/*logicreplace-")) {

            const after = newscript.slice(node.end + newoffset);
            const beforelen = newscript.length;


            // check for logicexchange


            const subwalk = walkScript("let a = " + oldscript, 8, componentnum + foundSomething.length);


            newscript = before.slice(0, before.lastIndexOf("{")) + "<SV__InlineGeneralComponent z={" + subwalk.script + "}/>" + after.slice(after.indexOf("}") + 1);
            hasInlineGeneralComponent = true;
            foundSomething.push(...subwalk.components);
            newoffset += newscript.length - beforelen;
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
    const res = transform(script, {
        filename: "component." + type,
        ast: true,
        presets: ["@babel/preset-typescript"],
        plugins: [["@babel/plugin-transform-react-jsx", { throwIfNamespace: false }]],


    });
    if (res === undefined) {
        throw ("Babel result undefined");
    }
    return res!.ast;
}


const walkScript = (script: string, base_script_offset = 0, componentNum = 0) => {
    let script_offset = 0;

    let ast = getAST(script);

    let skipto = base_script_offset;
    let outerSkip = base_script_offset;
    const newComponents: ComponentReceipt[] = [];
    if (!ast) {
        return { script, components: newComponents }
    }
    const definedVars: {var:string,isSvelte:boolean, imported:boolean}[] = [];
    walk((ast as unknown) as BaseNode, {
        enter: function (nod/*, parent, prop, index*/) {
            const node = nod as (BaseNode & { start: undefined | number, end: undefined | number });
            if (node.start === undefined || node.start! < skipto) {
                return;
            }
            const checkres = checkJSX(node, script, script_offset, 0, true, componentNum + newComponents.length);
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
                let start = node.start;
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
                    if (code.trim().length==0 || (bodyElNode && bodyElNode.type==="EmptyStatement")){
                        continue;
                        
                    }
                    /*
                    console.log("-----------------code-------------------");
                    console.log(code);
                    */

                    if (bodyElNode) {
                        
                        let hasdec = false;
                        if (bodyElNode.declaration){
                            if (bodyElNode.declaration.declarations){
                                if (bodyElNode.declaration.declarations){
                                    bodyElNode.declaration.declarations.forEach((v:any)=>{definedVars.push({var:v.id.name,isSvelte:false, imported:false})});
                                    hasdec = true;
                                }
                            }
                            
                            hasdec=true;
                        }
                        if (bodyElNode.declarations){
                            bodyElNode.declarations.forEach((v:any)=>{definedVars.push({var:v.id.name,isSvelte:false, imported:false})});
                            hasdec = true;
                        }
                        if (!hasdec){
                            if (bodyElNode.type === 'ImportDeclaration'){
                                
                                const fromSvelte = bodyElNode.source.extra.rawValue.endsWith(".svelte");
                                
                                bodyElNode.specifiers.forEach((v:any)=>console.log(v.local.name));
                            }else{
                                //console.log(bodyElNode);
                            }
                        }
                    } else {
                        // handle imports
                        const imp = code.split("import ").slice(1);
                        for (let i = 0; i < imp.length; i++) {
                            const im = imp[i];
                            if (im.trim().startsWith("type")){
                                continue;
                            }
                            const fr = im.split("from");
                            if (fr.length!==2){
                                continue;
                            }
                            const fromSvelte = fr[1].replace(/[;`'"\n]/g,"").trim().endsWith(".svelte");                                                   
                            const fb = fr[0].indexOf("{");
                                                        
                            if (fb < 0){
                                // only default
                                definedVars.push({var:fr[0].trim(),isSvelte:fromSvelte,imported:true});
                            }else{
                                const lb = fr[0].lastIndexOf("}");
                                const nondefault = fr[0].slice(fb,lb).split(/[{,}]/g).filter(v=>v.length>0);
                                for (let nd of nondefault){
                                    const v = (nd.includes(" as ") ? nd.split(" as ")[1] : nd).trim();
                                    definedVars.push({var:v,isSvelte:false,imported:true});
                                }

                                const defaultEx = fr[0].slice(0,fb) + fr[0].slice(lb+1).replace(",","").trim();
                                if (defaultEx.length>0){
                                    definedVars.push({var:defaultEx,isSvelte:fromSvelte, imported:true});
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
    return { script: script.slice(base_script_offset), components: newComponents, definedVars }
}

const walkNonScript = (nonscript: string, nComponents: number) => {
    let scriptSp = nonscript.split("<!--");
    let script = scriptSp[0] + scriptSp.slice(1).map(v => v.split("-->")[1]).join("");

    let ast = getAST("let _= <>" + script + "</>");

    //let script = nonscript;
    let script_offset = -9;
    const newComponents: ComponentReceipt[] = [];
    let skipto = 7;
    let hasInlineComponent = false;
    walk((ast as unknown) as BaseNode, {
        enter: function (nod, parent: any, prop: any, index?: number | null) {
            const node = nod as (BaseNode & { start: undefined | number, end: undefined | number });
            if (node.start === undefined || node.start! < skipto || isNaN(parseInt(index as any))) {
                return;
            }

            const checkres = checkOuterJSX(node, script, script_offset, nComponents + newComponents.length);
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