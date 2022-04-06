import { readAsBase64Img } from "./parser/unzip";

const cache = {}

const svgElement = (element, data) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', element);
  el.definition = data;
  el.onclick = (e) => {
    e.stopPropagation()
    parser.props(el);
  }
  return el
}

const parser = {
  svg: null,
  parse: (data) => {
    parser.svg = document.getElementById('svg');
    parser.svg.innerHTML = '';
    parser.defs = svgElement('defs');
    parser.svg.appendChild(parser.defs);
    parser.children(data.children, parser.svg);
  },
  artboard: async (data, container) => {
    const el = svgElement('g', data)
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'artboard');
    container.appendChild(el)
    parser.children(data.artboard.children, el);
  },
  group: async (data, container) => {
    const el = svgElement('g', data)
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'group');
    el.setAttributeNS(null, 'style', await parser.style(data, el))
    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
    }
    container.appendChild(el)
    parser.children(data.group.children, el);
  },
  syncRef: async (data, container) => {
    const el = svgElement('g', data)
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'syncRef');
    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
    }
    container.appendChild(el)
    if (data.group) parser.children(data.group.children, el);
  },
  text: async (data, container) => {
    const el = svgElement('text', data)
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'text');

    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
    }
    el.setAttributeNS(null, 'style', await parser.style(data, el))

    if (data.text.paragraphs) {
      data.text.paragraphs.forEach(p => {
        p.lines.forEach(async (l) => {
          const tspan = svgElement('tspan', data)
          tspan.setAttributeNS(null, 'x', l[0].x);
          tspan.setAttributeNS(null, 'y', l[0].y);
          tspan.appendChild(document.createTextNode(data.text.rawText.substr(l[0].from, l[0].to - l[0].from)))
          tspan.setAttributeNS(null, 'style', await parser.style(l[0], el))
          el.appendChild(tspan)
        })
      })
    } else {
      el.appendChild(document.createTextNode(data.text.rawText))
    }

    container.appendChild(el)
  },
  shape: async (data, container) => {

    // shapes are special
    const { shape } = data;

    const el = svgElement(shape.type, data)
    el.setAttributeNS(null, 'id', data.id)
    el.setAttributeNS(null, 'class', 'shape');

    switch (shape.type) {
      case 'rect':
        el.setAttributeNS(null, 'x', shape.x);
        el.setAttributeNS(null, 'y', shape.y);
        el.setAttributeNS(null, 'width', shape.width);
        el.setAttributeNS(null, 'height', shape.height);
        if (shape.r) {
          el.setAttributeNS(null, 'rx', shape.r[0]);
          el.setAttributeNS(null, 'ry', shape.r[0]);
        }
        break;
      case 'circle':
        el.setAttributeNS(null, 'id', shape.id)
        el.setAttributeNS(null, 'cx', shape.cx);
        el.setAttributeNS(null, 'cy', shape.cy);
        el.setAttributeNS(null, 'r', shape.r);
        break;
      case 'path':
        el.setAttributeNS(null, 'd', shape.path)
        break;
      case 'line':
        el.setAttributeNS(null, 'x1', shape.x1)
        el.setAttributeNS(null, 'y1', shape.y1)
        el.setAttributeNS(null, 'x2', shape.x2)
        el.setAttributeNS(null, 'y2', shape.y2)
        break;
      default:
        console.warn(`Unknown shape ${shape.type}`)
    }

    el.setAttributeNS(null, 'style', await parser.style(data, el))
    container.appendChild(el)
    if (data.transform) {
      el.setAttributeNS(null, 'transform', `translate(${data.transform.tx} ${data.transform.ty})`)
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
            const pattern = svgElement('pattern');
            pattern.setAttributeNS(null, 'id', resourceId);
            pattern.setAttributeNS(null, 'width', '100%');
            pattern.setAttributeNS(null, 'height', '100%');
            pattern.setAttributeNS(null, 'viewBox', `0 0 ${def.pattern.width} ${def.pattern.height}`);
            pattern.setAttributeNS(null, 'preserveAspectRatio', 'xMidYMid slice');
            if (!cache[resourceId]) {
              const resourceEntry = parser.entries[`resources/${resourceId}`];
              cache[resourceId] = await readAsBase64Img(resourceEntry);
            }
            const image = svgElement('image');
            image.setAttributeNS(null, 'href', cache[resourceId]);
            image.setAttributeNS(null, 'width', def.pattern.width);
            image.setAttributeNS(null, 'height', def.pattern.height);
            pattern.appendChild(image);
            parser.defs.appendChild(pattern);

            el.setAttributeNS(null, 'fill', `url(#${resourceId})`)
          }
          else if (def.type === 'gradient') {

            const resourceId = def.id + 'gradient';

            const linearGradient = svgElement('linearGradient');
            linearGradient.setAttributeNS(null, 'id', resourceId);
            linearGradient.setAttributeNS(null, 'x1', def.gradient.x1);
            linearGradient.setAttributeNS(null, 'y1', def.gradient.y1);
            linearGradient.setAttributeNS(null, 'x2', def.gradient.x2);
            linearGradient.setAttributeNS(null, 'y2', def.gradient.y2);
            linearGradient.setAttributeNS(null, 'gradientUnits', def.gradient.units);

            def.gradient.meta.ux.gradientResources.stops.forEach(s => {
              const stop = svgElement('stop');
              stop.setAttributeNS(null, 'offset', s.offset);
              stop.setAttributeNS(null, 'stop-color', parser.color2(s.color));
              if ('undefined' !== typeof s.color.alpha) stop.setAttributeNS(null, 'stop-opacity', s.color.alpha);
              linearGradient.appendChild(stop);
            })

            parser.defs.appendChild(linearGradient);
            el.setAttributeNS(null, 'fill', `url(#${resourceId})`)
          }
          else console.log("Unknown fill", def);
          break;
        case 'stroke':
          if (def.color) el.setAttributeNS(null, 'stroke', parser.color(def.color))
          else console.log(`Unknown stroke: ${def}`);

          if (def.width) el.setAttributeNS(null, 'stroke-width', def.type === 'none' ? 0 : def.width / 5);
          break;
        case 'font': 
          if (def.size) el.setAttributeNS(null, 'font-size', def.size + 'px');
          if (def.postscriptName) style += 'font-family: \'' + def.postscriptName + '\';';
          else if (def.family) style += 'font-family: \'' + def.family+'-'+def.style + '\';';
          break;
        case 'opacity': 
          style += 'opacity: ' + def + ';';
          break;
        default:
          console.log(`Unkown style.${attr}`);
      }
    }

    // clip path ?
    if (data.meta && data.meta.ux && data.meta.ux.viewportHeight) {
      const { offsetX, offsetY, viewportWidth, viewportHeight } = data.meta.ux;
      const resourceId = data.id + 'clip';
      const clipPath = svgElement('clipPath');
      clipPath.setAttributeNS(null, 'id', resourceId);
      const rect = svgElement('rect');
      rect.setAttributeNS(null, 'x', offsetX);
      rect.setAttributeNS(null, 'y', offsetY);
      rect.setAttributeNS(null, 'width', viewportWidth);
      rect.setAttributeNS(null, 'height', viewportHeight);
      clipPath.appendChild(rect);
      parser.defs.appendChild(clipPath);
      el.setAttributeNS(null, 'clip-path', `url(#${resourceId})`)
    }

    if (data.style.filters && data.style.filters[0] && data.style.filters[0].visible === false) {
      style += 'display:none;';
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
  },
  color2: c => {
    if (c.mode === 'RGB') {
      const { r, g, b } = c.value;
      return `rgb(${r},${g},${b})`;
    }
  }
}

export default parser;