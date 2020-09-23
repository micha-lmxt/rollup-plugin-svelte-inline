"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var InlineComponent = "\n<script>\n    export let __z;\n</script>\n" + /* prop __z can be false. Then return nothing */ "\n{#if !__z}\n    {''}\n    " + /* handle array */ "\n{:else if Array.isArray(__z)}\n    {#each __z as zi (zi.key)}\n        <svelte:self __z={zi}/>\n    {/each}\n    " + /* handle inline components */ "\n{:else if __z.component!==undefined}\n    <svelte:component this={__z.component} {...(__z.props||{})}/>\n{:else}\n    {__z}\n{/if}\n";
exports.getBaseReplacer = function () {
    return { 'rollup-plugin-svelte-inline/InlineComponent.svelte': InlineComponent };
};
