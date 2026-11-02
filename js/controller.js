
import { FamilyModel } from "./model.js";
import { FamilyView } from "./view.js";

const model = new FamilyModel();
const view = new FamilyView();

let currentSort = {
  key: "fullName",
  direction: "asc"
};

let filteredMembers = [];

function openMember(id) {
  const person = model.findMember(id);

  if (!person) return;

  view.showProfile(person, {
    parents: model.getParents(id),
    spouses: model.getSpouses(id),
    children: model.getChildren(id),
    siblings: model.getSiblings(id)
  }, openMember);
}

function renderTree() {
  const filtered = model.filterMembers({
    generation: document.getElementById("generationFilter").value,
    gender: document.getElementById("genderFilter").value,
    status: document.getElementById("statusFilter").value
  });

  const searched = model.searchMembers(
    document.getElementById("treeSearch").value,
    filtered
  );

  view.renderTree(
    model.groupByGeneration(searched),
    openMember,
    searched
  );

  document.getElementById("treeMemberCount").textContent =
    searched.length;
}

function sortMembers(people) {
  const { key, direction } = currentSort;

  return [...people].sort((a, b) => {
    const left = a[key] ?? "";
    const right = b[key] ?? "";

    const result =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(
            String(right),
            undefined,
            { numeric: true }
          );

    return direction === "asc" ? result : -result;
  });
}

function renderMembers() {
  const searched = model.searchMembers(
    document.getElementById("memberSearch").value
  );

  filteredMembers = sortMembers(searched);

  view.renderMembers(filteredMembers, id => {
    view.showPage("tree");
    openMember(id);
  });
}

function bindEvents() {
  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      view.showPage(page);

      if (page === "tree") renderTree();

      if (page === "members") renderMembers();

      if (page === "statistics") {
        view.renderStatistics(model.getStatistics());
      }
    });
  });

  [
    "treeSearch",
    "generationFilter",
    "genderFilter",
    "statusFilter"
  ].forEach(id => {
    const element = document.getElementById(id);

    element.addEventListener(
      id === "treeSearch" ? "input" : "change",
      renderTree
    );
  });

  document.getElementById("resetFilters").addEventListener("click", () => {
    document.getElementById("treeSearch").value = "";

    [
      "generationFilter",
      "genderFilter",
      "statusFilter"
    ].forEach(id => {
      document.getElementById(id).value = "all";
    });

    renderTree();
  });

  document.getElementById("memberSearch")
    .addEventListener("input", renderMembers);

  document.querySelectorAll("[data-sort]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.sort;

      currentSort = {
        key,
        direction:
          currentSort.key === key && currentSort.direction === "asc"
            ? "desc"
            : "asc"
      };

      renderMembers();
    });
  });

  document.getElementById("closeProfile")
    .addEventListener("click", () => view.closeProfile());

  document.getElementById("profileModal")
    .addEventListener("click", event => {
      if (event.target.id === "profileModal") {
        view.closeProfile();
      }
    });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      view.closeProfile();
    }
  });

  document.getElementById("mobileMenu")
    .addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
}

async function init() {
  document.getElementById("todayLabel").textContent =
    new Intl.DateTimeFormat("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date());

  try {
    await model.load();

    const generations = [
      ...new Set(model.people.map(person => person.generation))
    ].sort((a, b) => a - b);

    document.getElementById("generationFilter").innerHTML =
      '<option value="all">All generations</option>' +
      generations.map(generation =>
        `<option value="${generation}">Generation ${generation}</option>`
      ).join("");

    bindEvents();

    renderTree();

    view.renderStatistics(model.getStatistics());

  } catch (error) {
    console.error(error);
    view.showError(error.message);
  }
}

init();
