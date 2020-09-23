const InlineComponent = `
<script>
    export let __z;
</script>
` + /* prop __z can be false. Then return nothing */`
{#if !__z}
    {''}
    ` + /* handle array */`
{:else if Array.isArray(__z)}
    {#each __z as zi (zi.key)}
        <svelte:self __z={zi}/>
    {/each}
    `+/* handle inline components */`
{:else if __z.component!==undefined}
    <svelte:component this={__z.component} {...(__z.props||{})}/>
{:else}
    {__z}
{/if}
`

export const getBaseReplacer = ()=>{
    return {'rollup-plugin-svelte-inline/InlineComponent.svelte':InlineComponent}
}


