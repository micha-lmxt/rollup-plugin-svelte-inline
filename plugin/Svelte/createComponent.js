"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSvelteComponents = function (components) {
    return components.map(function (v) { return createComponent(v); });
};
var createComponent = function (rec) {
    console.log("-------------------------------------------");
    console.log(rec.code);
    var name = rec.name, props = rec.props;
    var code = "<script>" +
        props.filter(function (v) { return !v.startsWith("_b"); }).map(function (v) { return "export let " + v; }).join(";") + ";" +
        props.filter(function (v) { return v.startsWith("_b"); }).map(function (v) { return ("export let " + v + ";\n$: " + v + "(" + v.slice(2) + ");\n"); }).join(";") + ";" +
        "</script>" +
        rec.code;
    console.log(code);
    console.log("-------------------------------------------");
    return { name: name, code: code };
};
