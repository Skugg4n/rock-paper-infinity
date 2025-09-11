const ICONS = [
  'zap', 'star', 'timer', 'zap-off', 'atom', 'gem', 'file-text', 'scissors',
  'battery-charging', 'repeat-2', 'chevrons-right', 'battery-plus',
  'clover', 'copy', 'combine', 'menu', 'factory', 'crown', 'minus'
];

const cache = {};

export async function preloadIcons() {
  await Promise.all(
    ICONS.map(async name => {
      const res = await fetch(`graphics/${name}.svg`);
      const text = await res.text();
      const template = document.createElement('template');
      template.innerHTML = text.trim();
      cache[name] = template.content.firstElementChild;
    })
  );
}

export function getIcon(name, className = '') {
  const svg = cache[name]?.cloneNode(true);
  if (!svg) return document.createElement('span');
  const classes = ['lucide', `lucide-${name}`];
  if (className) classes.push(...className.split(' '));
  svg.setAttribute('class', classes.join(' '));
  return svg;
}

export function replaceIcons(root = document) {
  root.querySelectorAll('i[data-lucide]').forEach(el => {
    const name = el.getAttribute('data-lucide');
    const svg = getIcon(name, el.getAttribute('class'));
    el.replaceWith(svg);
  });
}
