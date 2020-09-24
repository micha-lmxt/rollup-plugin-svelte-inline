"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var createComponent_1 = require("./createComponent");
var parser_1 = require("@babel/parser");
var traverse_1 = __importDefault(require("@babel/traverse"));
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
    var walkRes2 = walkNonScript(html, walkRes.components.length, walkRes.definedVars);
    var rebuiltScript = "<script" + s1[1].split(">")[0] + ">\n" +
        (walkRes2.hasInlineComponent ? "import SV__InlineGeneralComponent from 'rollup-plugin-svelte-inline/InlineComponent.svelte';\n" : "") +
        walkRes.components.concat(walkRes2.components).map(function (v) { return "import " + v.name + " from '" + makeNewComponentPath(id, v.name) + "';"; }).join("\n") + "\n" +
        walkRes.script +
        "</script>";
    var resHtml = replaceSvelteLogic(walkRes2.script, true);
    createComponent_1.createSvelteComponents(walkRes.components.concat(walkRes2.components), walkRes.imports).forEach(function (v) { return addReplacer(makeNewComponentPath(id, v.name), v.code); });
    console.log(rebuiltScript + "\n" + style + "\n" + resHtml);
    return rebuiltScript + "\n" + style + "\n" + resHtml;
};
var makeNewComponentPath = function (id, name) {
    var rid = id.slice(0, id.length - 7);
    return rid + name + ".svelte";
};
var isJSX = function (node) { return node.type === "JSXElement"; };
var trivialElement = function (x) { return (x && x.type === 'StringLiteral' ||
    (x.type === "JSXExpressionContainer" && x.expression.type.endsWith("Literal"))); };
/** checks a node, if it is a jsx component. */
var readJSXAttributes = function (attrs, level, script, offset) {
    var newscript = script;
    var newoffset = offset;
    var props = {};
    for (var i = 0; i < attrs.length; i++) {
        var property = attrs[i];
        // has eg. bind:... or on:.. 
        var hasNameSpace = property.name.type === 'JSXNamespacedName';
        var wantBind = hasNameSpace && property.name.namespace.name === "bind";
        var wantClass = hasNameSpace && property.name.namespace.name === "class";
        if ((property.value === null && !wantClass && !wantBind) ||
            (trivialElement(property.value))) {
            continue;
        }
        var newProp = "__z_" + level + "_" + i;
        var exchange = newProp;
        var startEnd = property.value;
        var inProp = hasNameSpace ? property.name.name.name : property.name.name;
        // handle empty class or bind assignments
        var whereinput = property.end;
        if (property.value === null && (wantBind || wantClass)) {
            // empty assignment, eg. "bind:value"
            exchange = "={" + newProp + "}";
            startEnd = { start: whereinput, end: whereinput };
            //todo: handle event forwarding
        }
        else {
            startEnd = { start: startEnd.start + 1, end: startEnd.end - 1 };
        }
        var _a = exchangeNodeBy(startEnd, exchange, newscript, newoffset), repl = _a.replace, s1 = _a.script, o1 = _a.offset;
        props[newProp] = repl || inProp, newscript = s1, newoffset = o1;
        if (wantBind) {
            props["_b" + newProp] = "v=>{" + (repl || inProp) + "=v}";
        }
    }
    return { newscript: newscript, newoffset: newoffset, newprops: props };
};
// used in the walk procedure. 
var checkJSX = function (node, definedVars, script, offset, level, top, componentnum) {
    if (level === void 0) { level = 0; }
    if (top === void 0) { top = false; }
    if (componentnum === void 0) { componentnum = 0; }
    var _a, _b, _c;
    var newoffset = offset;
    var newlevel = level;
    var props = {};
    var newscript = script;
    var foundSomething = false;
    if (isJSX(node)) {
        var elementName_1 = (_b = (_a = node.openingElement) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.name;
        if (elementName_1.slice(0, 1) !== elementName_1.slice(0, 1).toLowerCase()) {
            var defined = definedVars.find(function (v) { return elementName_1 === v.var; });
            if (!defined) {
                console.log("Warning, did not find Component: " + elementName_1);
            }
            else {
                if (!defined.isSvelte) {
                }
            }
        }
        // JSX element definition
        var attrRes = readJSXAttributes(((_c = node.openingElement) === null || _c === void 0 ? void 0 : _c.attributes) || [], newlevel, newscript, newoffset);
        props = Object.assign(props, attrRes.newprops);
        newscript = attrRes.newscript;
        newoffset = attrRes.newoffset;
        var children = node.children || [];
        for (var i = 0; i < children.length; i++) {
            // walk through the arguments
            var res = checkJSX(children[i], definedVars, newscript, newoffset, newlevel + 1);
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
    else if ((!top) && node.type === "JSXExpressionContainer" && !trivialElement(node) && node.start && node.end) {
        var newProp = "__y_" + level;
        var _d = exchangeNodeBy(node, "{" + newProp + "}", newscript, newoffset), repl = _d.replace, s1 = _d.script, o1 = _d.offset;
        props[newProp] = repl.slice(1, repl.length - 1), newscript = s1, newoffset = o1;
        console.log(props);
    }
    return { script: newscript, offset: newoffset, props: props, level: newlevel, change: foundSomething };
};
// check the non-script part of the svelte document
var checkOuterJSX = function (node, script, offset, defindeVars, componentnum) {
    if (componentnum === void 0) { componentnum = 0; }
    var newoffset = offset;
    var newscript = script;
    var foundSomething = [];
    var hasInlineGeneralComponent = false;
    if (isJSX(node)) {
        // JSX element definition
        // check children
        var children = node.children || [];
        for (var i = 0; i < children.length; i++) {
            var res = checkOuterJSX(node.children[i], newscript, newoffset, defindeVars, componentnum + foundSomething.length);
            newscript = res.script;
            newoffset = res.offset;
            if (res.hasInlineGeneralComponent) {
                hasInlineGeneralComponent = true;
            }
            foundSomething.push.apply(foundSomething, res.change);
        }
    }
    else if (node.type !== "JSXText" && !trivialElement(node) && node.start && node.end && node.expression) {
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
        var expr = node.expression;
        var oldscript = newscript.slice(expr.start + newoffset, expr.end + newoffset);
        // remove surrounding mustache bracket {}
        var before = newscript.slice(0, expr.start + newoffset);
        var between = before.slice(before.lastIndexOf("{") + 1);
        if (!between.includes("/*logicreplace-") && !oldscript.includes("/*logicreplace-")) {
            var after = newscript.slice(expr.end + newoffset);
            var beforelen = newscript.length;
            // check for logicexchange
            var subwalk = walkScript("let a = " + oldscript, 8, componentnum + foundSomething.length);
            console.log(subwalk.script);
            newscript = before.slice(0, before.lastIndexOf("{")) + "<SV__InlineGeneralComponent __z={" + subwalk.script + "}/>" + after.slice(after.indexOf("}") + 1);
            hasInlineGeneralComponent = true;
            foundSomething.push.apply(foundSomething, subwalk.components);
            newoffset += newscript.length - beforelen;
        }
        else {
            console.log("skipped");
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
    return parser_1.parse(script, {
        sourceType: "module",
        plugins: ["jsx", "typescript"]
    });
};
var walkScript = function (script, base_script_offset, componentNum) {
    if (base_script_offset === void 0) { base_script_offset = 0; }
    if (componentNum === void 0) { componentNum = 0; }
    var script_offset = 0;
    var ast = getAST(script);
    var skipto = base_script_offset;
    var outerSkip = base_script_offset;
    var newComponents = [];
    var definedVars = [];
    var imports = "";
    if (!ast) {
        return { script: script, components: newComponents, definedVars: definedVars, imports: imports };
    }
    traverse_1.default(ast, {
        enter: function (path) {
            var node = path.node;
            /*
            if(node.type==="Identifier"){
                console.log(node.name)
                console.log(path.isReferencedIdentifier());
                if (path.isReferencedIdentifier()){
                    console.log(path.scope.hasBinding(node.name));
                }
                
            }*/
            if (node.start === undefined || node.start < skipto) {
                return;
            }
            var checkres = checkJSX(node, definedVars, script, script_offset, 0, true, componentNum + newComponents.length);
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
                var _loop_1 = function () {
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
                        return "continue";
                    }
                    /*
                    console.log("-----------------code-------------------");
                    console.log(code);
                    */
                    if (bodyElNode) {
                        var hasdec = false;
                        if (bodyElNode.declaration) {
                            if (bodyElNode.declaration.declarations) {
                                if (bodyElNode.declaration.declarations) {
                                    bodyElNode.declaration.declarations.forEach(function (v) { definedVars.push({ var: v.id.name, isSvelte: false, imported: false }); });
                                    hasdec = true;
                                }
                            }
                            hasdec = true;
                        }
                        if (bodyElNode.declarations) {
                            bodyElNode.declarations.forEach(function (v) { definedVars.push({ var: v.id.name, isSvelte: false, imported: false }); });
                            hasdec = true;
                        }
                        if (!hasdec) {
                            if (bodyElNode.type === 'ImportDeclaration') {
                                imports += code + ";";
                                var fromSvelte_1 = bodyElNode.source.value.endsWith(".svelte");
                                bodyElNode.specifiers.forEach(function (v) { return definedVars.push({ var: v.local.name, isSvelte: fromSvelte_1 && v.type === 'ImportDefaultSpecifier', imported: true }); });
                            }
                            else {
                                //console.log(bodyElNode);
                            }
                        }
                    }
                    else {
                        // handle imports
                        var imp = code.split("import ").slice(1);
                        imports += imp.join("import ");
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
                                definedVars.push({ var: fr[0].trim(), isSvelte: fromSvelte, imported: true });
                            }
                            else {
                                var lb = fr[0].lastIndexOf("}");
                                var nondefault = fr[0].slice(fb, lb).split(/[{,}]/g).filter(function (v) { return v.length > 0; });
                                for (var _i = 0, nondefault_1 = nondefault; _i < nondefault_1.length; _i++) {
                                    var nd = nondefault_1[_i];
                                    var v = (nd.includes(" as ") ? nd.split(" as ")[1] : nd).trim();
                                    definedVars.push({ var: v, isSvelte: false, imported: true });
                                }
                                var defaultEx = fr[0].slice(0, fb) + fr[0].slice(lb + 1).replace(",", "").trim();
                                if (defaultEx.length > 0) {
                                    definedVars.push({ var: defaultEx, isSvelte: fromSvelte, imported: true });
                                }
                            }
                        }
                    }
                };
                while (start < node.end) {
                    _loop_1();
                }
                outerSkip = node.end;
            }
        },
    });
    console.log(definedVars);
    return { script: script.slice(base_script_offset), components: newComponents, definedVars: definedVars, imports: imports };
};
var walkNonScript = function (nonscript, nComponents, definedVars) {
    var scriptSp = nonscript.split("<!--");
    var script = scriptSp[0] + scriptSp.slice(1).map(function (v) { return v.split("-->")[1]; }).join("");
    var ast = getAST("let _= <>" + script + "</>");
    //let script = nonscript;
    var script_offset = -9;
    var newComponents = [];
    var skipto = 9;
    var hasInlineComponent = false;
    traverse_1.default(ast, {
        enter: function (path /*nod, parent: any, prop: any, index?: number | null*/) {
            var node = path.node; // nod as (BaseNode & { start: undefined | number, end: undefined | number });
            if (node.start === undefined || node.start < skipto /*|| isNaN(parseInt(index as any))*/) {
                return;
            }
            var checkres = checkOuterJSX(node, script, script_offset, definedVars, nComponents + newComponents.length);
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
