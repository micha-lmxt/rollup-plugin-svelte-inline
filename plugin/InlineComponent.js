"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var InlineComponent = "\n<script>\n    export let z;\n</script>\n{#if !z}\n    {''}\n{:else if Array.isArray(z)}\n    {#each z as zi (zi.key)}\n        <svelte:self z={zi}/>\n    {/each}\n{:else if z.component!==undefined}\n    <svelte:component this={z.component} {...(z.props||{})}/>\n{:else}\n    {z}\n{/if}\n";
exports.getBaseReplacer = function () {
    return { 'rollup-plugin-svelte-inline/InlineComponent.svelte': InlineComponent };
};
