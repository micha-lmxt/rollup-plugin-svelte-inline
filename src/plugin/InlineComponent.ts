const InlineComponent = `
<script>
    export let z;
</script>
{#if !z}
    {''}
{:else if Array.isArray(z)}
    {#each z as zi (zi.key)}
        <svelte:self z={zi}/>
    {/each}
{:else if z.component!==undefined}
    <svelte:component this={z.component} {...(z.props||{})}/>
{:else}
    {z}
{/if}
`
export const getBaseReplacer = ()=>{
    return {'rollup-plugin-svelte-inline/InlineComponent.svelte':InlineComponent}
}