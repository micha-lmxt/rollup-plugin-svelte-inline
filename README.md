# rollup-plugin-svelte-inline

A plugin that enables you to write simple components in the script part of your .svelte file. Also it allowes you to use React-like conditions and array mappings instead of #if and #each directives. 

## Get started

Currently the code is quite "hacky", so it is not published to npm. So clone the repo:
```
git clone https://github.com/micha-lmxt/rollup-plugin-svelte-inline
```
switch to your project folder and use 
```
npm install "../path/to/rollup-plugin-svelte-inline
```
Then load the plugin in your rollup.config.js
```javascript
//rollup.config.js
...
import inlineSvelte from 'rollup-plugin-svelte-inline';
...
export default {
  ...
  plugins: [
		inlineSvelte(),
		svelte({...
    
```
Make sure that the inline plugin comes before the svelte plugin.

Now a few new things should be possible, thought syntax highlighting may not work correctly in vs code:

### Inline Components
You can write component syntax in the Script
```javascript
//App.svelte
<script>
  const svelteRef = <a href="https://svelte.dev/tutorial">Svelte tutorial</a>;
</script>
{svelteRef}
```
bind: should work, events should work, except event forwarding and | modifiers.

### Alternate Logic Syntax
You can write React-like logic syntax in the HTML part of the .svelte file:
```javascript
//App.svelte
<div>{someboolean ? <div>abc</div> : "abc"}</div>
<div>{someboolean && <input bind:value/>}</div>
<!--instead of -->
<div>{#if someboolean}
  <div>abc</div>
  {:else}
  abc
  {/if}
```
### Arrays instead of each
Also, this is possible:
```javascript
//App.svelte
<script>
  let myarray = [1,2,3,5].map(v=>(<div key={i}>Number is {v}</div>))
</script>
<div>{myarray}</div>
<!-- or directly in place -->
<div>{}</div>
```



### Not working

- Event forwarding in inline Components
- "|" modifiers
- keyed {#each} blocks currently kill the plugin. 





