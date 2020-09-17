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
    var s1 = code.split("<script ");
    if (s1.length !== 2) {
        return;
    }
    var _a = s1[1].split(">").slice(1).join(">").split("</script>"), script = _a[0], rest = _a[1];
    var noscript = s1[0] + rest;
    console.log(noscript);
    console.log(script);
    var walkRes = walkScript(script);
    console.log("Walk noscript");
    var walkRes2 = walkNonScript(noscript);
    var newSveltes = createComponent_1.createSvelteComponents(walkRes.components.concat(walkRes2.components));
    /*
    console.log(code);
    if (code.includes("const qq = <div>xyz</div>;")) {
        addReplacer('src/myTest.svelte',
        `<div>xyz</div>`);
        return code.replace("const qq = <div>xyz</div>;", "import XXX from './myTest.svelte';")
    }
    return code.replace(/texty/g, "huhu");
    */
    console.log("Script: ");
    console.log(walkRes.script);
    console.log("Components: ");
    console.log(walkRes.components);
};
var checkJSX = function (node, script, offset, level, top, componentnum) {
    if (level === void 0) { level = 0; }
    if (top === void 0) { top = false; }
    if (componentnum === void 0) { componentnum = 0; }
    var newoffset = offset;
    var newlevel = level;
    var props = {};
    var newscript = script;
    var foundSomething = false;
    if (node.type === 'CallExpression' && node.callee && node.callee.object && node.callee.object.name === "React") {
        // JSX element definition
        for (var i = 0; i < node.arguments.length; i++) {
            // walk through the arguments
            var res = checkJSX(node.arguments[i], newscript, newoffset, newlevel + 1);
            newlevel = res.level;
            newscript = res.script;
            newoffset = res.offset;
            props = Object.assign({}, props, res.props);
        }
        if (top) {
            var newComponentName = "__ic_" + componentnum;
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
            console.log("key: ");
            console.log(property.key);
            if (property.value) {
                console.log("value: ");
                console.log(property.value.type);
                console.log("start: " + property.value.start + ", end: " + property.value.end);
            }
            else {
                console.log("no value");
            }
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
            if (property.value.type === "BooleanLiteral") {
                // empty assignment, eg. "bind:value"
                exchange = "={" + newProp + "}";
                startEnd = { start: property.key.end, end: property.key.end };
                //todo: handle event forwarding
            }
            var _a = exchangeNodeBy(startEnd, exchange, newscript, newoffset), repl = _a.replace, s1 = _a.script, o1 = _a.offset;
            props[newProp] = repl || inPropName, newscript = s1, newoffset = o1;
            if (inPropSplit.length === "" && inPropSplit[0].toLowerCase() === "bind") {
                props["_b" + newProp] = "v=>{" + newProp + "=v}";
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
        exclude: [/script/g, /<style>/g]
    });
    if (res === undefined) {
        throw ("Babel result undefined");
    }
    return res.ast;
};
var walkScript = function (script) {
    console.log("walk:" + script);
    var ast = getAST(script);
    var script_offset = 0;
    var skipto = -1;
    var newComponents = [];
    if (!ast) {
        return { script: script, components: newComponents };
    }
    estree_walker_1.walk(ast, {
        enter: function (nod /*, parent, prop, index*/) {
            var node = nod;
            if (node.start === undefined || node.start < skipto) {
                return;
            }
            var checkres = checkJSX(node, script, script_offset, 0, true, newComponents.length);
            if (checkres.change) {
                var subwalk = walkScript("let a = " + checkres.script);
                var ex = exchangeNodeBy(node, subwalk.script, script, script_offset);
                script_offset = ex.offset;
                script = ex.script;
                newComponents.push.apply(newComponents, __spreadArrays([checkres.change], subwalk.components));
                // skip all sub walking
                if (node.end) {
                    skipto = node.end;
                }
            }
        },
    });
    return { script: script, components: newComponents };
};
var walkNonScript = function (nonscript) {
    console.log("walk:" + nonscript);
    var ast = getAST("let _= <>" + nonscript + "</>");
    var script = nonscript;
    var script_offset = 9;
    var newComponents = [];
    estree_walker_1.walk(ast, {
        enter: function (node, parent, prop, index) {
            console.log(node);
        },
    });
    return { script: script, components: newComponents };
};
