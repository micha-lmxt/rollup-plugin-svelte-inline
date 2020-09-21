"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var estree_walker_1 = require("estree-walker");
var createComponent_1 = require("./createComponent");
var core_1 = require("@babel/core");
//var walk = require('estree-walker').walk;
exports.processSvelte = function (code, addReplacer, id) {
    var s1 = code.split("<script");
    if (s1.length !== 2 && s1.length !== 1) {
        return;
    }
    var _a = s1.length === 1 ? ["", ""] : s1[1].split(">").slice(1).join(">").split("</script>"), script = _a[0], rest = _a[1];
    var noscript = s1[0] + rest;
    var walkRes = walkScript(script);
    var s2 = noscript.split("<style");
    if (s2.length !== 2 && s2.length !== 1) {
        return;
    }
    var _b = s2.length === 1 ? [">", ""] : s2[1].split("</style>"), style = _b[0], html = _b[1];
    style = "<style" + style + "</style>";
    html = s2[0] + html;
    html = replaceSvelteLogic(html);
    var walkRes2 = walkNonScript(html, walkRes.components.length);
    var rebuiltScript = "<script" + s1[1].split(">")[0] + ">\n" +
        (walkRes2.hasInlineComponent ? "import SV__InlineGeneralComponent from 'rollup-plugin-svelte-inline/InlineComponent.svelte';\n" : "") +
        walkRes.components.concat(walkRes2.components).map(function (v) { return "import " + v.name + " from '" + makeNewComponentPath(id, v.name) + "';"; }).join("\n") + "\n" +
        walkRes.script +
        "</script>";
    var resHtml = replaceSvelteLogic(walkRes2.script, true);
    createComponent_1.createSvelteComponents(walkRes.components.concat(walkRes2.components)).forEach(function (v) { return addReplacer(makeNewComponentPath(id, v.name), v.code); });
    return rebuiltScript + "\n" + style + "\n" + resHtml;
};
var makeNewComponentPath = function (id, name) {
    // id - .svelte
    var rid = id.slice(0, id.length - 7);
    return rid + name + ".svelte";
};
var isJSX = function (node) { return (node.type === 'CallExpression' && node.callee && node.callee.object && node.callee.object.name === "React"); };
/** checks a node, if it is a jsx component. */
var checkJSX = function (node, script, offset, level, top, componentnum) {
    if (level === void 0) { level = 0; }
    if (top === void 0) { top = false; }
    if (componentnum === void 0) { componentnum = 0; }
    var newoffset = offset;
    var newlevel = level;
    var props = {};
    var newscript = script;
    var foundSomething = false;
    if (isJSX(node)) {
        // JSX element definition
        for (var i = 1; i < node.arguments.length; i++) {
            // walk through the arguments
            var res = checkJSX(node.arguments[i], newscript, newoffset, newlevel + 1);
            newlevel = res.level;
            newscript = res.script;
            newoffset = res.offset;
            props = Object.assign({}, props, res.props);
        }
        if (top) {
            var newComponentName = "IC___" + componentnum;
            var exchange = "{component:" + newComponentName + ",props:{" + Object.keys(props).map(function (v) { return v + ":" + props[v]; }).join(",") + "}}";
            var start = node.start + offset;
            var end = node.end + newoffset;
            var code = newscript.slice(start, end);
            foundSomething = { name: newComponentName, props: Object.keys(props), code: code };
            newscript = exchange;
            newoffset = offset + exchange.length - end + start;
        }
    }
    else if ((!top) && node.type === "ObjectExpression" && node.properties) {
        for (var i = 0; i < node.properties.length; i++) {
            var property = node.properties[i];
            if (property.value.type === "StringLiteral" || (property.value.type === "BooleanLiteral" && property.value.start > -1)) {
                // todo: transition, in, out import may be needed
                continue;
            }
            var newProp = "__z_" + level + "_" + i;
            var exchange = newProp;
            var startEnd = property.value;
            var inProp = property.key.type === "StringLiteral" ? property.key.value : (property.key.name || property.key.value);
            var inPropSplit = inProp.split(":");
            var inPropName = inPropSplit[inPropSplit.length > 1 ? 1 : 0].split("|")[0];
            var whereinput = property.end;
            if (property.value.type === "BooleanLiteral") {
                // empty assignment, eg. "bind:value"
                exchange = "={" + newProp + "}";
                startEnd = { start: whereinput, end: whereinput };
                //todo: handle event forwarding
            }
            var _a = exchangeNodeBy(startEnd, exchange, newscript, newoffset), repl = _a.replace, s1 = _a.script, o1 = _a.offset;
            props[newProp] = repl || inPropName, newscript = s1, newoffset = o1;
            if (inPropSplit.length > 1 && inPropSplit[0].toLowerCase() === "bind") {
                props["_b" + newProp] = "v=>{" + (repl || inPropName) + "=v}";
            }
        }
    }
    else if ((!top) && node.type !== "StringLiteral" && node.type !== "NullLiteral" && node.start && node.end) {
        var newProp = "__y_" + level;
        var _b = exchangeNodeBy(node, newProp, newscript, newoffset), repl = _b.replace, s1 = _b.script, o1 = _b.offset;
        props[newProp] = repl, newscript = s1, newoffset = o1;
    }
    return { script: newscript, offset: newoffset, props: props, level: newlevel, change: foundSomething };
};
var checkOuterJSX = function (node, script, offset, componentnum) {
    if (componentnum === void 0) { componentnum = 0; }
    var newoffset = offset;
    var newscript = script;
    var foundSomething = [];
    var hasInlineGeneralComponent = false;
    if (isJSX(node)) {
        if (node.arguments && node.arguments.length > 0) {
            var ar = node.arguments[0];
            console.log(ar.name);
        }
        // JSX element definition
        for (var i = 1; i < node.arguments.length; i++) {
            // walk through the arguments
            var res = checkOuterJSX(node.arguments[i], newscript, newoffset, componentnum + foundSomething.length);
            newscript = res.script;
            newoffset = res.offset;
            if (res.hasInlineGeneralComponent) {
                hasInlineGeneralComponent = true;
            }
            foundSomething.push.apply(foundSomething, res.change);
        }
    }
    else if (node.type === "ObjectExpression" && node.properties) {
        //nothing here
    }
    else if (node.type !== "StringLiteral" && node.type !== "NullLiteral" && node.start && node.end) {
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
        var oldscript = newscript.slice(node.start + newoffset, node.end + newoffset);
        // remove surrounding mustache bracket {}
        var before = newscript.slice(0, node.start + newoffset);
        var between = before.slice(before.lastIndexOf("{") + 1);
        if (!between.includes("/*logicreplace-")) {
            var after = newscript.slice(node.end + newoffset);
            var beforelen = newscript.length;
            // check for logicexchange
            var subwalk = walkScript("let a = " + oldscript, 8, componentnum + foundSomething.length);
            newscript = before.slice(0, before.lastIndexOf("{")) + "<SV__InlineGeneralComponent z={" + subwalk.script + "}/>" + after.slice(after.indexOf("}") + 1);
            hasInlineGeneralComponent = true;
            foundSomething.push.apply(foundSomething, subwalk.components);
            newoffset += newscript.length - beforelen;
        }
    }
    return { script: newscript, offset: newoffset, change: foundSomething, hasInlineGeneralComponent: hasInlineGeneralComponent };
};
var exchangeNodeBy = function (node, by, script, offset) {
    var start = offset + node.start;
    var end = offset + node.end;
    var replace = script.slice(start, end);
    return {
        replace: replace,
        script: script.slice(0, start) + by + script.slice(end),
        offset: offset + by.length - node.end + node.start
    };
};
var getAST = function (script, type) {
    if (type === void 0) { type = "tsx"; }
    var res = core_1.transform(script, {
        filename: "component." + type,
        ast: true,
        presets: ["@babel/preset-typescript"],
        plugins: [["@babel/plugin-transform-react-jsx", { throwIfNamespace: false }]],
    });
    if (res === undefined) {
        throw ("Babel result undefined");
    }
    return res.ast;
};
var walkScript = function (script, base_script_offset, componentNum) {
    if (base_script_offset === void 0) { base_script_offset = 0; }
    if (componentNum === void 0) { componentNum = 0; }
    var script_offset = 0;
    var ast = getAST(script);
    var skipto = base_script_offset;
    var outerSkip = base_script_offset;
    var newComponents = [];
    if (!ast) {
        return { script: script, components: newComponents };
    }
    var definedVars = [];
    estree_walker_1.walk(ast, {
        enter: function (nod /*, parent, prop, index*/) {
            var node = nod;
            if (node.start === undefined || node.start < skipto) {
                return;
            }
            var checkres = checkJSX(node, script, script_offset, 0, true, componentNum + newComponents.length);
            if (checkres.change) {
                var subwalk = walkScript("let a = " + checkres.script, 8, componentNum + newComponents.length + 1);
                var ex = exchangeNodeBy(node, subwalk.script, script, script_offset);
                script_offset = ex.offset;
                script = ex.script;
                newComponents.push.apply(newComponents, __spreadArrays([checkres.change], subwalk.components));
                // skip all sub walking
                if (node.end) {
                    skipto = node.end;
                }
            }
            // check code for assignments
            if (node.start >= outerSkip && node.type === 'Program') {
                var nob = node;
                var start = node.start;
                var j = 0;
                var bl = nob.body ? nob.body.length : 0;
                while (start < node.end) {
                    var bodyElNode = undefined;
                    // parse body elements or skip to node end
                    var hasMoreBody = (j < bl);
                    var end = 0;
                    if (!hasMoreBody) {
                        end = nob.end;
                    }
                    else {
                        var bodyEl = nob.body[j];
                        if (start < bodyEl.start) {
                            end = bodyEl.start;
                        }
                        else {
                            end = bodyEl.end;
                            bodyElNode = bodyEl;
                            j++;
                        }
                    }
                    var code = script.slice(start + script_offset, end + script_offset);
                    start = end;
                    if (code.trim().length == 0 || (bodyElNode && bodyElNode.type === "EmptyStatement")) {
                        continue;
                    }
                    console.log("-----------------code-------------------");
                    console.log(code);
                    if (bodyElNode) {
                        //
                        var hasdec = false;
                        if (bodyElNode.declaration) {
                            if (bodyElNode.declaration.declarations) {
                                if (bodyElNode.declaration.declarations) {
                                    bodyElNode.declaration.declarations.forEach(function (v) { definedVars.push({ var: v.id.name, isSvelte: false }); });
                                    hasdec = true;
                                }
                            }
                            hasdec = true;
                        }
                        if (bodyElNode.declarations) {
                            bodyElNode.declarations.forEach(function (v) { definedVars.push({ var: v.id.name, isSvelte: false }); });
                            hasdec = true;
                        }
                        if (!hasdec) {
                            if (bodyElNode.type === 'ImportDeclaration') {
                                console.log(bodyElNode.source.extra);
                                var fromSvelte = bodyElNode.source.extra.rawValue.endsWith(".svelte");
                                console.log(bodyElNode.source.extra.rawValue + " -> " + fromSvelte);
                                bodyElNode.specifiers.forEach(function (v) { return console.log(v.local.name); });
                            }
                            else {
                                console.log(bodyElNode);
                            }
                        }
                    }
                    else {
                        // handle imports
                        var imp = code.split("import ").slice(1);
                        for (var i = 0; i < imp.length; i++) {
                            var im = imp[i];
                            if (im.trim().startsWith("type")) {
                                continue;
                            }
                            var fr = im.split("from");
                            if (fr.length !== 2) {
                                continue;
                            }
                            var fromSvelte = fr[1].replace(/[;`'"\n]/g, "").trim().endsWith(".svelte");
                            var fb = fr[0].indexOf("{");
                            if (fb < 0) {
                                // only default
                                definedVars.push({ var: fr[0].trim(), isSvelte: fromSvelte });
                            }
                            else {
                                var lb = fr[0].lastIndexOf("}");
                                var nondefault = fr[0].slice(fb, lb).split(/[{,}]/g).filter(function (v) { return v.length > 0; });
                                for (var _i = 0, nondefault_1 = nondefault; _i < nondefault_1.length; _i++) {
                                    var nd = nondefault_1[_i];
                                    var v = (nd.includes(" as ") ? nd.split(" as ")[1] : nd).trim();
                                    definedVars.push({ var: v, isSvelte: false });
                                }
                                var defaultEx = fr[0].slice(0, fb) + fr[0].slice(lb + 1).replace(",", "").trim();
                                if (defaultEx.length > 0) {
                                    definedVars.push({ var: defaultEx, isSvelte: fromSvelte });
                                }
                            }
                        }
                    }
                    if (code.trim().length > 0) {
                        console.log("-----------------end code-------------------");
                    }
                }
                outerSkip = node.end;
            }
        },
    });
    console.log(definedVars);
    return { script: script.slice(base_script_offset), components: newComponents, definedVars: definedVars };
};
var walkNonScript = function (nonscript, nComponents) {
    var scriptSp = nonscript.split("<!--");
    var script = scriptSp[0] + scriptSp.slice(1).map(function (v) { return v.split("-->")[1]; }).join("");
    var ast = getAST("let _= <>" + script + "</>");
    //let script = nonscript;
    var script_offset = -9;
    var newComponents = [];
    var skipto = 7;
    var hasInlineComponent = false;
    estree_walker_1.walk(ast, {
        enter: function (nod, parent, prop, index) {
            var node = nod;
            if (node.start === undefined || node.start < skipto || isNaN(parseInt(index))) {
                return;
            }
            var checkres = checkOuterJSX(node, script, script_offset, nComponents + newComponents.length);
            if (checkres.hasInlineGeneralComponent) {
                hasInlineComponent = true;
            }
            script = checkres.script;
            script_offset = checkres.offset;
            if (checkres.change.length > 0) {
                newComponents.push.apply(newComponents, checkres.change);
            }
            if (node.end) {
                skipto = node.end;
            }
        },
    });
    return { script: script, components: newComponents, hasInlineComponent: hasInlineComponent };
};
var replaceSvelteLogic = function (code, back) {
    if (back === void 0) { back = false; }
    var replace = [
        { i: /#if/g, o: "#if" },
        { i: /\/if/g, o: "/if" },
        { i: /:else if/g, o: ":else if" },
        { i: /:else/g, o: ":else" },
        { i: /#each/g, o: "#each" },
        { i: /#await/g, o: "#await" },
        { i: /:then/g, o: ":then" },
        { i: /:catch/g, o: ":catch" },
        { i: /\/await/g, o: "/await" }
    ];
    if (back) {
        replace.forEach(function (v) {
            code = code.replace(RegExp("/\\*logicreplace-" + v.o + "-\\*/", "g"), v.o);
        });
    }
    else {
        replace.forEach(function (v) {
            code = code.replace(v.i, "/*logicreplace-" + v.o + "-*/");
        });
    }
    return code;
};
