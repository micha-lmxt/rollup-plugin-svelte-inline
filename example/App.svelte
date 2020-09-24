<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	export let name : string;

	// Define components inline:
	const svelteRef = <a href="https://svelte.dev/tutorial">Svelte tutorial</a>;
	// bind: works too!
	const inputfield = <input bind:value={name} type="text"/>;

	let u : boolean;
	$: u = name.length > 1;
	let v : boolean;
	$: v = name.length < 7 ;
	let getIn = false;

	// Arrays work too!
	const visit : JSX.Element[] = ("Or visit ").split("")
		.concat("rollup-plugin-svelte-inline".split("").map(v=>(<a href="https://github.com/micha-lmxt/rollup-plugin-svelte-inline">{v}</a>)))
		.concat((" to learn about inline components").split(""))
		.map((v,i)=>(<p style="min-width:6px" in:fly={{ y: 50, duration: 80, delay: (i + 4) * 80 }}>{v}</p>));

	onMount(()=>{getIn=true;});
	
</script>

<main>

	<!-- Prefer this notation instead of #if?-->
	<h1>Hello { u &&  v && <strong>{name}</strong>}!</h1>
	{inputfield}

	<!-- Or prefer this notation instead of #if?-->
	{name.toLowerCase().startsWith("w") ? <h1>the name starts with "W"</h1> : <h6>the name does not start with "W"</h6>}

	<p>Visit the {svelteRef} to learn how to build Svelte apps.</p>
	
	<!--Could also replace by 	<div>{getIn && visit}</div> -->
	<div>{#if getIn}{visit}{/if}</div>

	

</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
	div {
		display: inline-flex;
	}
</style>