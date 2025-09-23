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

// --- Template-Expansion ---

function expandEachTag(eachElement, model, context = {}) {
  const arrayName = eachElement.getAttribute("of"); // z.B. "items" oder "item.children"
  const asName = eachElement.getAttribute("as") || "item";

  const items = resolvePath(arrayName, model, context) || [];
  return items.flatMap(item => {
    const newContext = { ...context, [asName]: item };
    return expandChildren(eachElement, model, newContext);
  });
}

function expandIfTag(ifElement, model, context = {}) {
    const testExpr = ifElement.getAttribute("test");
    const value = resolvePath(testExpr, model, context);

    if (value) {
        return expandChildren(ifElement, model, context)
    }

    return []
}

function expandTemplate(templateElement, model, context = {}) {
  if (templateElement.tagName === "EACH") {
    return expandEachTag(templateElement, model, context);
  }

  if (templateElement.tagName === 'IF') {
    return expandIfTag(templateElement, model, context)
  }

  const newEl = document.createElement(templateElement.tagName);
  newEl.dataset.cloned = "true";

  // Text + Attribute interpolieren
  const directInnerText = getDirectInnerText(templateElement);
  if (directInnerText) {
    newEl.innerText = directInnerText; // erstmal setzen
    newEl.dataset.templateInnerText = directInnerText; // Original sichern
  }

  // Attribute kopieren
  for (const attr of Array.from(templateElement.attributes)) {
    newEl.setAttribute(attr.name, attr.value);
  }

  // Text + Attribute interpolieren
  applyInterpolations(newEl, model, context);

  // Kinder expandieren
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
    const parent = child.parentNode;

    switch (child.tagName) {
      case "EACH": {
        parent.querySelectorAll('[data-cloned="true"]').forEach(oCE => oCE.remove());
        const expanded = expandEachTag(child, model, context);
        expanded.forEach(el => parent.insertBefore(el, child));
        child.style.display = "none";
        break;
      }

      case "IF": {
        parent.querySelectorAll('[data-cloned="true"]').forEach(oCE => oCE.remove());
        const expanded = expandIfTag(child, model, context);
        expanded.forEach(el => parent.insertBefore(el, child));
        child.style.display = "none";
        break;
      }

      default: {
        applyInterpolations(child, model, context);
        render(child, model, context); // rekursiv
      }
    }
  });
}