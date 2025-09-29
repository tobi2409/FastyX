class TestComponent extends HTMLElement {
    // 1. Definiere, welche Attribute beobachtet werden
    static get observedAttributes() {
        return ['title', 'color']; // Attribute, die auf Änderungen reagieren
    }

    connectedCallback() {
        this.render();
    }

    // 2. Reagiere auf Attributänderungen
    attributeChangedCallback(name, oldValue, newValue) {
        this.render(); // Einfach neu rendern
    }

    // 3. HTML-Inhalt abhängig von Attributen erzeugen
    render() {
        const title = this.getAttribute('title') || 'Standard Titel';
        const color = this.getAttribute('color') || 'lightblue';

        this.innerHTML = `
            <div data-layout="default">
                <div data-align="top" style="background:${color}">${title}</div>
                <div data-align="left">Links</div>
                <div data-align="bottom">Unten</div>
                <div data-align="right">Rechts</div>
                <div data-align="client">Mitte</div>
            </div>
        `;
    }
}

// Registrieren
customElements.define("test-component", TestComponent);
