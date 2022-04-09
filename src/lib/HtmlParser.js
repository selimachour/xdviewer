import { readAsBase64Img } from "./parser/unzip";

const cache = {}

const domElement = (element, data) => {
  const el = document.createElement(element);

  if (data) {
    el.id = data.id;
    el.className = data.type;
    el.definition = data;
  }

  el.onclick = (e) => {
    e.stopPropagation()
    parser.props(el);
  }
  return el
}

const parser = {
  svg: null,

  parse: (data, art) => {

    const { x, y, width, height } = art['uxdesign#bounds'];

    parser.svg = document.getElementById('svg');
    parser.svg.innerHTML = '';

    parser.svg.style.width = width + 'px'
    parser.svg.style.height = height + 'px'
    parser.svg.style.overflow = 'hidden'

    const container = domElement('div');
    container.style.transform = `translate(${-x}px, ${-y}px)`

    parser.svg.appendChild(container)

    parser.children(data.children, container);
  },
  applyTransform(el, data) {
    if (data.transform) {
      const { a, b, c, d, tx, ty } = data.transform;
      el.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${tx}, ${ty})`;
    }
  },
  artboard: async (data, container) => {
    const el = domElement('div', data)
    container.appendChild(el)
    parser.children(data.artboard.children, el)
  },
  group: async (data, container) => {
    const el = domElement('div', data)
    parser.applyTransform(el, data);
    await parser.style(data, el)
    container.appendChild(el)
    parser.children(data.group.children, el);
  },
  syncRef: async (data, container) => {
    const el = domElement('div', data)
    parser.applyTransform(el, data);
    container.appendChild(el)

    if (data.group) parser.children(data.group.children, el);
  },
  text: async (data, container) => {
    const el = domElement('div', data)
    await parser.style(data, el)
    parser.applyTransform(el, data);

    if (data.text.paragraphs) {
      data.text.paragraphs.forEach(p => {
        p.lines.forEach(async (l) => {
          const tspan = domElement('span', data)
          tspan.appendChild(document.createTextNode(data.text.rawText.substr(l[0].from, l[0].to - l[0].from)))
          tspan.style.left = l[0].x + 'px';
          tspan.style.top = l[0].y + 'px';
          el.appendChild(tspan)
        })
      })
    } else {
      el.appendChild(document.createTextNode(data.text.rawText))
    }

    // in html y represents the top left corner of the text unlike the svg
    const fontSize = parseInt(el.style.fontSize);
    el.style.top = -fontSize + 'px';

    container.appendChild(el)
  },
  shape: async (data, container) => {

    // shapes are special
    const { shape } = data;

    let el = domElement('div', data)

    switch (shape.type) {
      case 'rect':
        el.style.left = shape.x + 'px';
        el.style.top = shape.y + 'px';
        el.style.width = shape.width + 'px';
        el.style.height = shape.height + 'px';

        if (shape.r) {
          const [tl, tr, br, bl] = shape.r;
          el.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
        }
        break;

      case 'circle':
        el.setAttribute('id', shape.id)
        el.setAttribute('cx', shape.cx);
        el.setAttribute('cy', shape.cy);
        el.setAttribute('r', shape.r);
        break;

      case 'path':
        el.setAttribute('d', shape.path)
        break;

      case 'line':
        el.setAttribute('x1', shape.x1)
        el.setAttribute('y1', shape.y1)
        el.setAttribute('x2', shape.x2)
        el.setAttribute('y2', shape.y2)
        break;

      default:
        console.warn(`Unknown shape ${shape.type}`)
    }

    await parser.style(data, el);
    container.appendChild(el);

    parser.applyTransform(el, data)
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

    const { style } = data;


    // opacity
    if (style.opacity) {
      el.style.opacity = style.opacity;
    }

    // blendMode
    if (style.blendMode) {
      el.style.mixBlendMode = style.blendMode;
    }

    // isolation
    if (style.isolation) {
      el.style.isolation = style.isolation;
    }

    // fill
    if (style.fill) {

      // fill can be color of text or background color of rectangle ...
      const cssProp = data.type === 'text' ? 'color': 'backgroundColor';

      if (style.fill.type === 'none') el.style[cssProp] = 'none';

      else if (style.fill.color) el.style[cssProp] =  parser.color(style.fill.color);

      else if (style.fill.type === 'pattern') {

        if (style.fill.pattern.meta && style.fill.pattern.meta.ux) {
          const { scaleBehavior, uid, offsetX, offsetY, scale, scaleX, scaleY } = style.fill.pattern.meta.ux

          const resourceId = uid;
          // pattern.setAttribute('width', '100%');
          // pattern.setAttribute('height', '100%');
          // pattern.setAttribute('viewBox', `0 0 ${style.fill.pattern.width} ${style.fill.pattern.height}`);
          // pattern.setAttribute('preserveAspectRatio', 'xMidYMid slice');

          // unzip image if needed
          if (!cache[resourceId]) {
            const resourceEntry = parser.entries[`resources/${resourceId}`];
            cache[resourceId] = await readAsBase64Img(resourceEntry);
          }

          // image
          el.style.backgroundImage = `url('${cache[resourceId]}')`
          el.style.backgroundRepeat = 'no-repeat';

          // scaling
          if (scaleBehavior) {
            if (scaleBehavior === 'fill') {
              el.style.backgroundSize = `${100 * scaleX}% ${100 * scaleY}%`;
            } else {
              el.style.backgroundSize = scaleBehavior;
            }
          }

          // positioning
          el.style.backgroundPositionX = (1 - offsetX) * 100 + '%';
          el.style.backgroundPositionY = (1 - offsetY) * 100 + '%';

          // const image = domElement('image');
          // image.setAttribute('href', cache[resourceId]);
          // image.setAttribute('width', style.fill.pattern.width);
          // image.setAttribute('height', style.fill.pattern.height);
          // pattern.appendChild(image);
          // parser.defs.appendChild(pattern);
        }

      }
      else if (style.fill.type === 'gradient') {

        // const resourceId = style.fill.id + 'gradient';

        // const linearGradient = domElement('linearGradient');
        // linearGradient.setAttribute('id', resourceId);
        // linearGradient.setAttribute('x1', style.fill.gradient.x1);
        // linearGradient.setAttribute('y1', style.fill.gradient.y1);
        // linearGradient.setAttribute('x2', style.fill.gradient.x2);
        // linearGradient.setAttribute('y2', style.fill.gradient.y2);
        // linearGradient.setAttribute('gradientUnits', style.fill.gradient.units);

        // style.fill.gradient.meta.ux.gradientResources.stops.forEach(s => {
        //   const stop = domElement('stop');
        //   stop.setAttribute('offset', s.offset);
        //   stop.setAttribute('stop-color', parser.color2(s.color));
        //   if ('undefined' !== typeof s.color.alpha) stop.setAttribute('stop-opacity', s.color.alpha);
        //   linearGradient.appendChild(stop);
        // })

        // parser.defs.appendChild(linearGradient);
        // el.setAttribute('fill', `url(#${resourceId})`)
      }
      else console.log("Unknown fill", style.fill.type);

    }

    // stroke
    if (style.stroke) {
      if (style.stroke.color) el.style.borderColor = parser.color(style.stroke.color);
      else console.log(`Unknown stroke: ${style.stroke}`);

      if (style.stroke.width) el.style.borderWidth = style.stroke.type === 'none' ? 0 : style.stroke.width + 'px';
    }

    // font
    if (style.font) {
      if (style.font.size) el.style.fontSize = style.font.size + 'px';

      if (style.font.postscriptName) el.style.fontFamily = `'${style.font.postscriptName}'`;
      else if (style.font.family) el.style.fontFamily = `'${style.font.family+'-'+style.font.style}'`;
    }

    // missing some ?
    for(let attr in data.style) {
      if (!['opacity', 'blendMode', 'isolation', 'fill', 'stroke', 'font'].includes(attr)) {
        console.log(`Unkown style.${attr}`);
      }
    }

    // clip path ?
    if (data.meta && data.meta.ux && data.meta.ux.viewportHeight) {
      // const { offsetX, offsetY, viewportWidth, viewportHeight } = data.meta.ux;
      // const resourceId = data.id + 'clip';
      // const clipPath = domElement('clipPath');
      // clipPath.setAttribute('id', resourceId);
      // const rect = domElement('rect');
      // rect.setAttribute('x', offsetX);
      // rect.setAttribute('y', offsetY);
      // rect.setAttribute('width', viewportWidth);
      // rect.setAttribute('height', viewportHeight);
      // clipPath.appendChild(rect);
      // parser.defs.appendChild(clipPath);
      // el.setAttribute('clip-path', `url(#${resourceId})`)
    }

    if (data.style.xfilters && data.style.xfilters[0] && data.style.xfilters[0].visible === false) {
      //style += 'display:none;';
    }
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