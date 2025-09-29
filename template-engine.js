const recursiveTemplates = {}
const compiledTemplates = new WeakMap() // Cache für nicht-rekursive Templates

function getDirectInnerText(el) {
    return Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join("");
}

function resolvePath(path, model, context) {
  const parts = path.split('.');
  let current = context.hasOwnProperty(parts[0]) ? context[parts[0]] : model[parts[0]];
  for (let i = 1; i < parts.length; i++) {
    if (current == null) return undefined;
    current = current[parts[i]];
  }
  return current;
}

// --- Interpolation ---
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
        node.dataset[key] = tplValue;
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

// --- Template-Expansion ---
function expandEachTag(eachElement, model, context = {}) {
  let arrayName
  if (eachElement.hasAttribute('of')) {
    arrayName = eachElement.getAttribute("of");
  } else if (eachElement.hasAttribute('of-rec')) {
    arrayName = recursiveTemplates[eachElement.getAttribute('of-rec')].getAttribute('of')
  }
  const items = resolvePath(arrayName, model, context) || [];
  const asName = eachElement.getAttribute("as") || "item";

  return items.flatMap(item => {
    const newContext = { ...context, [asName]: item };
    return expandChildren(eachElement, model, newContext);
  });
}

function expandIfTag(ifElement, model, context = {}) {
    const testExpr = ifElement.getAttribute("test");
    const value = resolvePath(testExpr, model, context);
    return value ? expandChildren(ifElement, model, context) : [];
}

function expandRecursiveTemplateTag(recursiveTemplateElement, model, context = {}) {
    if (recursiveTemplateElement.hasAttribute('name')) {
        recursiveTemplates[recursiveTemplateElement.getAttribute('name')] =
            recursiveTemplateElement.cloneNode(true)
    }
    if (recursiveTemplateElement.hasAttribute('use') && recursiveTemplateElement.hasAttribute('of')) {
        recursiveTemplates[recursiveTemplateElement.getAttribute('use')]
            .setAttribute('of', recursiveTemplateElement.getAttribute('of'))
        return expandChildren(recursiveTemplates[recursiveTemplateElement.getAttribute('use')], model, context)
    }
    return expandChildren(recursiveTemplateElement, model, context)
}

function expandTemplate(templateElement, model, context = {}) {
  // Cache-Abfrage
  if (compiledTemplates.has(templateElement)) {
    const cached = compiledTemplates.get(templateElement)
    return cached(model, context)
  }

  // Normaler Ablauf
  if (templateElement.tagName === "EACH") {
    return expandEachTag(templateElement, model, context)
  }
  if (templateElement.tagName === 'IF') {
    return expandIfTag(templateElement, model, context)
  }
  if (templateElement.tagName === 'RECURSIVE-TEMPLATE') {
    return expandRecursiveTemplateTag(templateElement, model, context)
  }

  // "Kompilierung" vorbereiten: eine Factory-Funktion in den Cache legen
  const factory = (model, context) => {
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
  };

  compiledTemplates.set(templateElement, factory);
  return factory(model, context);
}

function expandChildren(parentTemplate, model, context = {}) {
  const childTemplates = parentTemplate.querySelectorAll(":scope > *");
  return Array.from(childTemplates).flatMap(child =>
    expandTemplate(child, model, context)
  );
}

// --- Rendering ---
function render(root, model, context = {}) {
  root.querySelectorAll('[data-cloned="true"]').forEach(oCE => oCE.remove());

  const rootChildren = root.querySelectorAll(":scope > *");
  rootChildren.forEach(child => {
    const parent = child.parentNode;
    switch (child.tagName) {
      case "EACH": {
        const expanded = expandEachTag(child, model, context);
        expanded.forEach(el => parent.insertBefore(el, child));
        child.style.display = "none";
        break;
      }
      case "IF": {
        const expanded = expandIfTag(child, model, context);
        expanded.forEach(el => parent.insertBefore(el, child));
        child.style.display = "none";
        break;
      }
      case "RECURSIVE-TEMPLATE": {
        const expanded = expandRecursiveTemplateTag(child, model, context);
        expanded.forEach(el => parent.insertBefore(el, child));
        child.style.display = "none";
        break;
      }
      default: {
        applyInterpolations(child, model, context);
        render(child, model, context);
      }
    }
  });
}
