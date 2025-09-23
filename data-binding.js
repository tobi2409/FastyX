function reactive(obj, callback) {
    return new Proxy(obj, {
        get(target, prop) {
            const value = target[prop];
            if (value && typeof value === 'object') return reactive(value, callback);
            return value;
        },
        
        set(target, prop, value) {
            target[prop] = value;
            callback();
            return true;
        }
    });
    }

function getDirectInnerText(el) {
    return Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join("");
}

// Globale Registry für Recursive-Templates
const recursiveTemplates = {};

// --- Hilfsfunktionen ---

function interpolateText(template, model, context) {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    const value = resolvePath(key, model, context);
    return value !== undefined ? value : "";
  });
}

function interpolateAttributes(node, model, context) {
  for (const attr of Array.from(node.attributes)) {
    if (!attr.name.match(/^data-template/)) {
      const key = "template" + attr.name;
      const tplValue = node.dataset[key] || attr.value;
      if (/\{\{.*?\}\}/.test(tplValue)) {
        node.dataset[key] = tplValue; // Original speichern
        node.setAttribute(attr.name, interpolateText(tplValue, model, context));
      }
    }
  }
}

function applyInterpolations(node, model, context) {
  const templateText = node.dataset.templateInnerText || getDirectInnerText(node);
  if (templateText && /\{\{.*?\}\}/.test(templateText)) {
    node.dataset.templateInnerText = templateText;
    node.innerText = interpolateText(templateText, model, context);
  }
  interpolateAttributes(node, model, context);
}

// --- Helper für Templates ---

function expandEachTag(eachElement, model, context = {}) {
  const arrayName = eachElement.getAttribute("of");
  const asName = eachElement.getAttribute("as") || "item";

  const items = resolvePath(arrayName, model, context) || [];
  return items.flatMap(item => {
    const newContext = { ...context, [asName]: item };
    return expandChildren(eachElement, model, newContext);
  });
}

function renderIfTag(node, model, context) {
  const testExpr = node.getAttribute("test");
  const value = resolvePath(testExpr, model, context);

  if (!node._ifTemplateNodes) {
    node._ifTemplateNodes = Array.from(node.childNodes).map(n => n.cloneNode(true));
  }

  while (node.firstChild) node.removeChild(node.firstChild);

  if (value) {
    node._ifTemplateNodes.forEach(n => node.appendChild(n.cloneNode(true)));
    render(node, model, context);
  }
}

function renderRecursiveTemplate(node, model, context) {
  let templateOf = null;

  if (node.hasAttribute("name")) {
    const name = node.getAttribute("name");
    recursiveTemplates[name] = node;
    templateOf = node.getAttribute("of");

    Array.from(node.children).forEach(n => {
      applyInterpolations(n, model, { ...context, [name + ".of"]: templateOf });
      render(n, model, context);
    });

  } else if (node.hasAttribute("use")) {
    console.log('TEST')
    const refName = node.getAttribute("use");
    const refTemplate = recursiveTemplates[refName];
    if (refTemplate) {
      templateOf = node.getAttribute("of");

      const clone = refTemplate.cloneNode(true);

      Array.from(clone.children).forEach(n => {
        applyInterpolations(n, model, { ...context, [refName + ".of"]: templateOf });
        render(n, model, context);
      });

      while (node.firstChild) node.removeChild(node.firstChild);
      Array.from(clone.childNodes).forEach(n => node.appendChild(n));
    }
  } else {
    Array.from(node.children).forEach(n => {
      applyInterpolations(n, model, context);
      render(n, model, context);
    });
  }
}

// --- Handler-Registry ---

const tagHandlers = {
  EACH: {
    expand: (node, model, context) => expandEachTag(node, model, context),
    render: (node, model, context) => {
      const parent = node.parentNode;
      parent.querySelectorAll('[data-cloned="true"]').forEach(n => n.remove());
      const expanded = expandEachTag(node, model, context);
      expanded.forEach(el => parent.insertBefore(el, node));
      node.style.display = "none";
    }
  },

  IF: {
    expand: (node) => [node.cloneNode(true)],
    render: (node, model, context) => renderIfTag(node, model, context)
  },

  "RECURSIVE-TEMPLATE": {
    expand: (node) => [node.cloneNode(true)],
    render: (node, model, context) => renderRecursiveTemplate(node, model, context)
  }
};

// --- Expansion ---

function expandTemplate(templateElement, model, context = {}) {
  const tag = templateElement.tagName;
  if (tagHandlers[tag]) {
    return tagHandlers[tag].expand(templateElement, model, context);
  }

  const newEl = document.createElement(templateElement.tagName);
  newEl.dataset.cloned = "true";

  const directInnerText = getDirectInnerText(templateElement);
  if (directInnerText) {
    newEl.innerText = directInnerText;
    newEl.dataset.templateInnerText = directInnerText;
  }

  for (const attr of Array.from(templateElement.attributes)) {
    newEl.setAttribute(attr.name, attr.value);
  }

  applyInterpolations(newEl, model, context);

  const children = expandChildren(templateElement, model, context);
  children.forEach(c => newEl.appendChild(c));

  return [newEl];
}

function expandChildren(parentTemplate, model, context = {}) {
  const childTemplates = parentTemplate.querySelectorAll(":scope > *");
  return Array.from(childTemplates).flatMap(child =>
    expandTemplate(child, model, context)
  );
}

// --- Rendering ---

function render(root, model, context = {}) {
  const rootChildren = root.querySelectorAll(":scope > *");
  rootChildren.forEach(child => {
    const tag = child.tagName;
    if (tagHandlers[tag]) {
      tagHandlers[tag].render(child, model, context);
    } else {
      applyInterpolations(child, model, context);
      render(child, model, context);
    }
  });
}


// Hilfsfunktion: löst "item.children" oder "modelKey.subKey" im Kontext/Model auf
function resolvePath(path, model, context) {
  const parts = path.split('.');
  let current = context.hasOwnProperty(parts[0]) ? context[parts[0]] : model[parts[0]];

  for (let i = 1; i < parts.length; i++) {
    if (current == null) return undefined;
    current = current[parts[i]];
  }
  return current;
}