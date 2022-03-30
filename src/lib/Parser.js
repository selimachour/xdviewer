
const cache = {}

const parser = {
  artboard: async (data, container) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'artboard');
    container.appendChild(el)
    parser.children(data.artboard.children, el);
  },
  group: async (data, container) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'group');
    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
    }
    container.appendChild(el)
    parser.children(data.group.children, el);
  },
  syncRef: async (data, container) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'syncRef');
    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
    }
    container.appendChild(el)
    if (data.group) parser.children(data.group.children, el);
  },
  text: async (data, container) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'text');

    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
    }
    el.setAttributeNS(null, 'style', await parser.style(data))

    if (data.text.paragraphs) {
      data.text.paragraphs.forEach(p => {
        p.lines.forEach(async (l) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
          tspan.setAttributeNS(null, 'x', l[0].x);
          tspan.setAttributeNS(null, 'y', l[0].y);
          tspan.appendChild(document.createTextNode(data.text.rawText.substr(l[0].from, l[0].to - l[0].from)))
          tspan.setAttributeNS(null, 'style', await parser.style(l[0]))
          el.appendChild(tspan)
        })
      })
    } else {
      el.appendChild(document.createTextNode(data.text.rawText))
    }

    container.appendChild(el)
  },
  shape: async (data, container) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'shape');
    el.setAttributeNS(null, 'style', await parser.style(data, el))
    container.appendChild(el)
    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
    }
    if (parser[data.shape.type]) {
      parser[data.shape.type](data.shape, el);
    } else {
      console.log(`Unknown Shape: ${data.shape.type}`);
    }
  },
  children: (children, container) => {
    if (!children) return;
    children.forEach(child => {
      if (parser[child.type]) {
        parser[child.type](child, container);
      } else {
        console.log(`Unhandled type: ${child.type}`);
      }
    })
  },
  rect: (data, container) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'x', data.x);
    el.setAttributeNS(null, 'y', data.y);
    el.setAttributeNS(null, 'width', data.width);
    el.setAttributeNS(null, 'height', data.height);
    if (data.r) {
      el.setAttributeNS(null, 'rx', data.r[0]);
      el.setAttributeNS(null, 'ry', data.r[0]);
    }
    container.appendChild(el)
  },
  circle: (data, container) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'cx', data.cx);
    el.setAttributeNS(null, 'cy', data.cy);
    el.setAttributeNS(null, 'r', data.r);
    container.appendChild(el)
  },
  style: async (data, el) => {
    if (!data.style) return '';

    let style = '';

    for(let attr in data.style) {
      const def = data.style[attr];
      switch(attr) {
        case 'fill': 
          if (def.color) style += 'fill: ' + parser.color(def.color) + ';';
          else if (def.type === 'pattern') {
            const resourceId = def.pattern.meta.ux.uid;
            const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');

            if (!cache[resourceId]) {
              const resourceEntry = parser.entries.find(e => e.filename === `resources/${resourceId}`);
              cache[resourceId] = await parser.readAsBase64Img(resourceEntry);
            }
            img.setAttributeNS(null, 'href', cache[resourceId]);
            el.appendChild(img);
          }
          else console.log("Unknown fill", def);
          break;
        case 'stroke': 
          if (def.color) style += 'stroke: ' + parser.color(def.color) + ';';
          else console.log(`Unknown stroke: ${def}`);
          style += 'stroke-width: ' + (def.width/5) + ';';
          break;
          case 'font': 
          if (def.size) style += 'font-size: ' + def.size + 'px;';
          if (def.postscriptName) style += 'font-family: \'' + def.postscriptName + '\';';
          if (def.family) style += 'font-family: \'' + def.family+'-'+def.style + '\';';
        case 'opacity': 
          style += 'opacity: ' + def + ';';
          break;
      }
    }
    return style
  },
  color: c => {
    if (c.mode === 'RGB') {
      const { r, g, b } = c.value;
      if (c.alpha) 
        return `rgba(${r},${g},${b}, ${c.alpha})`;
      else
        return `rgb(${r},${g},${b})`;
    }
  }
}

export default parser;