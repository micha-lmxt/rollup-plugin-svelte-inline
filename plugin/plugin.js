"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var PREFIX = "";
var path_1 = __importDefault(require("path"));
var process_1 = require("./Svelte/process");
exports.inlineSvelte = function () {
    var replacer = {};
    var resolvedIds = new Map();
    var addReplacer = function (name, code) {
        replacer[name] = code;
        resolvedIds.set(path_1.default.resolve(name), replacer[name]);
    };
    return {
        name: "rollup-plugin-inline-svelte",
        transform: function (code, id) {
            console.log("transform: " + id);
            if (id.endsWith(".svelte")) {
                process_1.processSvelte(code, addReplacer, id);
            }
        },
        resolveId: function (id, importer) {
            if (id in replacer)
                return PREFIX + id;
            if (importer) {
                // eslint-disable-next-line no-param-reassign
                if (importer.startsWith(PREFIX))
                    importer = importer.slice(PREFIX.length);
                var resolved = path_1.default.resolve(path_1.default.dirname(importer), id);
                if (resolvedIds.has(resolved))
                    return PREFIX + resolved;
            }
        },
        load: function (id) {
            if (id.startsWith(PREFIX)) {
                // eslint-disable-next-line no-param-reassign
                id = id.slice(PREFIX.length);
                return id in replacer ? replacer[id] : resolvedIds.get(id);
            }
        }
    };
};
exports.default = exports.inlineSvelte;
