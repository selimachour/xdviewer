<script>
  import JSONTree from 'svelte-json-tree';

  export let el;
  let treeView = false;
  let elements = [];
  let selectedElement = null;

  $: {
    elements = []

    let element = el;
    while(element) {
      const elProps = { element, props: [] }
      element.getAttributeNames().forEach(attr => {
        if (element.getAttribute(attr)) elProps.props[attr] = element.getAttribute(attr)
      })
      elements.push(elProps)
      element = element.parentElement;
      if (element.id === 'svg') break;
    }
  }

</script>
<div class="tableWrapper">
  <table>
    {#each elements as element}
      <tr>
        <th class="el" colspan="2" on:click={() => selectedElement = element.element }>{element.element.nodeName}</th>
      </tr>
      {#each Object.entries(element.props) as [attr, value]}
        <tr>
          <th>{attr}</th>
          <td><div>{value.replace(/;/g,';\n')}</div></td>
        </tr>
      {/each}
    {/each}
  </table>
  {#if selectedElement}
  <label>
    <input type="checkbox" bind:checked={treeView}> Tree view
  </label>
  <div style="overflow-x: auto">
    {#if treeView}
    <JSONTree value={selectedElement.definition} />
    {:else}
    <pre>{JSON.stringify(selectedElement.definition, null, '  ')}</pre>
    {/if}
  </div>
  {/if}
</div>

<style>

table {
  margin: 1em;
  border-collapse: collapse;
  background-color: #fff;
  font-size: 0.7em;
  font-family: monospace;
}

th, td {
  border: 1px solid #eee;
  padding: 0.25em;
}
th {
  text-align: left;
  padding-right: 1em;
}
th.el {
  background-color: #ccc;
}

div {
  overflow: hidden;
  white-space: pre;
}

.tableWrapper {
  overflow: auto;
}

pre {
  font-size: 0.8em;
}

</style>