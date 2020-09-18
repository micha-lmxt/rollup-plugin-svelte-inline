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
        props.map(function (v) {
            if (v.startsWith("_b")) {
                return "export let " + v + ";\n$: " + v + "(" + v.slice(2) + ");\n";
            }
            return "export let " + v;
        }).join(";") +
        "</script>" +
        rec.code;
    console.log(code);
    console.log("-------------------------------------------");
    return { name: name, code: code };
};
