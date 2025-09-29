class PersonModel {
    constructor() {
        this.items = [
            { name: "Alice", age: 30 },
            { name: "Bob", age: 25 },
            { name: "Charlie", age: 40 }
        ]
    }

    append(name, age) {
        this.items.push({ name: name, age: age })
    }
}

const personModel = new PersonModel()
personModel.append("Tobias", 30)

class PersonViewModel {
    constructor() {
        this.items = personModel.items.map(e => ({ ...e, show: true }))
    }

    append(name, age) {
        this.items.push({ name: name, age: age, show: true })
    }
}

// ViewModel-Instanz
const personViewModel = reactive(new PersonViewModel(), () => {
    personModel.items = personViewModel.items.map(({ show, ...rest }) => rest)
    render(document.getElementById("templateRoot"), personViewModel)
})

// --- Event-Handling ---
document.getElementById("addItem").addEventListener("click", () => {
  personViewModel.items.push({
    name: "Neues Item",
    age: Math.floor(Math.random() * 50) + 20,
    show: true
  });
});

document.getElementById("templateRoot").addEventListener("click", (e) => {
  if (e.target.dataset.action === "toggle") {
    const div = e.target.closest(".item");
    const index = Array.from(div.parentNode.children).indexOf(div);
    personViewModel.items[index].show = !personViewModel.items[index].show;
  }
});

// --- Initial Render ---
render(document.getElementById("templateRoot"), personViewModel);