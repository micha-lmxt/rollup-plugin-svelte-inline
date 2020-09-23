"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSvelteComponents = function (components, imports) {
    return components.map(function (v) { return v.functionName !== undefined ? createFunctionalComponent(v, imports) : createComponent(v, imports); });
};
var createComponent = function (rec, imports) {
    console.log("-------------------------------------------");
    console.log(rec.code);
    var name = rec.name, props = rec.props;
    var code = "<script>\n" +
        imports + ";" +
        props.filter(function (v) { return !v.startsWith("_b"); }).map(function (v) { return "export let " + v; }).join(";") + ";" +
        props.filter(function (v) { return v.startsWith("_b"); }).map(function (v) { return ("export let " + v + ";\n$: " + v + "(" + v.slice(2) + ");\n"); }).join(";") + ";" +
        "</script>" +
        rec.code;
    console.log(code);
    console.log("-------------------------------------------");
    return { name: name, code: code };
};
var createFunctionalComponent = function (rec, imports) {
    var functionName = rec.functionName, fromFile = rec.fromFile, propsobj = rec.propsobj;
    var code = "<script>" +
        "import {" + functionName + " as __f} from '" + fromFile + "';\n" +
        imports + ";" +
        Object.keys(propsobj).map(function (key) { return "export let " + propsobj[key]; }).join(";\n") +
        "let __w;\n" +
        "$: __w =__f({" + Object.keys(propsobj).map(function (key) { return key + ":" + propsobj[key]; }).join(",") + "});\n" +
        "</script>\n" +
        "<svelte:component this={__w.component}  {...(__w.props||{})}/>";
    return { name: name, code: code };
};
