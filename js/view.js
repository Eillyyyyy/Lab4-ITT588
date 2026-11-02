
const escapeHTML = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

export class FamilyView {
  constructor() {
    this.tree = document.getElementById("treeContainer");
    this.tableBody = document.getElementById("membersTableBody");
    this.stats = document.getElementById("statisticsContainer");
    this.modal = document.getElementById("profileModal");
    this.profile = document.getElementById("profileContent");
  }

  showPage(page) {
    document.querySelectorAll(".page").forEach(section => {
      section.classList.toggle("active", section.id === `page-${page}`);
    });

    document.querySelectorAll(".nav-link").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });

    document.getElementById("breadcrumbPage").textContent = ({
      tree: "Family Tree",
      members: "Family Members",
      statistics: "Statistics"
    })[page];

    document.getElementById("sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Build the family tree using parent and spouse relationships.
  renderTree(groups, onMemberClick, people = Object.values(groups).flat()) {
    if (!people.length) {
      this.tree.innerHTML = `
        <div class="empty-state">
          No family members match these filters.
        </div>`;
      return;
    }

    const peopleMap = new Map(people.map(person => [person.id, person]));
    const rendered = new Set();

    // Find the spouse of a person from the JSON relationship data.
    const getPartner = person => {
      const spouseRecord = (person.spouses || []).find(
        item => peopleMap.has(item.personId)
      );

      return spouseRecord
        ? peopleMap.get(spouseRecord.personId)
        : null;
    };

    // Find children belonging to this couple.
    const getChildren = (person, partner) => {
      return people.filter(child => {
        const relatedToPerson =
          child.fatherId === person.id ||
          child.motherId === person.id;

        const relatedToPartner = partner && (
          child.fatherId === partner.id ||
          child.motherId === partner.id
        );

        return relatedToPerson || relatedToPartner;
      });
    };

    const renderFamily = (person, depth = 0) => {
      if (!person || rendered.has(person.id)) return "";

      const partner = getPartner(person);

      rendered.add(person.id);

      if (partner) {
        rendered.add(partner.id);
      }

      const coupleHTML = `
        <div class="family-couple">
          ${this.personCard(person)}
          ${partner ? `
            <span class="spouse-connector" title="Spouse">♥</span>
            ${this.personCard(partner)}
          ` : ""}
        </div>
      `;

      const children = getChildren(person, partner)
        .filter(child => !rendered.has(child.id))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      const childrenHTML = children.length
        ? `
          <div class="family-children">
            ${children.map(child => `
              <div class="family-child">
                ${renderFamily(child, depth + 1)}
              </div>
            `).join("")}
          </div>
        `
        : "";

      return `
        <div class="family-unit" data-depth="${depth}">
          ${coupleHTML}
          ${childrenHTML}
        </div>
      `;
    };

    // Do not treat spouses of descendants as separate family roots.
    const spousesOfMembersWithParents = new Set();

    people.forEach(person => {
      if (person.fatherId || person.motherId) {
        (person.spouses || []).forEach(spouse => {
          spousesOfMembersWithParents.add(spouse.personId);
        });
      }
    });

    // Root members have no recorded parents and are not spouses
    // of someone who already belongs to a younger generation.
    const roots = people.filter(person =>
      !person.fatherId &&
      !person.motherId &&
      !spousesOfMembersWithParents.has(person.id)
    );

    const rootHTML = roots
      .filter(person => !rendered.has(person.id))
      .map(person => renderFamily(person))
      .join("");

    // Include any remaining unconnected members so they are not lost.
    const remainingHTML = people
      .filter(person => !rendered.has(person.id))
      .map(person => renderFamily(person))
      .join("");

    this.tree.innerHTML = `
      <div class="family-tree-chart">
        ${rootHTML}
        ${remainingHTML}
      </div>
    `;

    this.tree.querySelectorAll("[data-person-id]").forEach(card => {
      card.addEventListener("click", () => {
        onMemberClick(card.dataset.personId);
      });
    });
  }

  personCard(person) {
    const deceased = Boolean(person.deathYear);
    const genderClass = (person.gender || "").toLowerCase();

    return `
      <button
        type="button"
        class="person-card ${genderClass}
          ${person.isInLaw ? "in-law" : ""}
          ${deceased ? "deceased" : ""}"
        data-person-id="${escapeHTML(person.id)}"
      >
        <span class="person-top">
          <span class="person-avatar">
            ${person.gender === "Male" ? "♂" : "♀"}
          </span>
          <span class="person-id">${escapeHTML(person.id)}</span>
        </span>

        <strong>${escapeHTML(person.fullName)}</strong>

        <span class="person-years">
          ${escapeHTML(person.birthYear)}
          – ${escapeHTML(person.deathYear || "Present")}
        </span>

        <span class="person-meta">
          ${escapeHTML(person.profession)}
        </span>

        <span class="person-tags">
          ${person.isInLaw ? "<i>IN-LAW</i>" : ""}
          ${deceased ? "<i>DECEASED</i>" : ""}
        </span>
      </button>
    `;
  }

  renderMembers(people, onMemberClick) {
    this.tableBody.innerHTML = people.length
      ? people.map(person => `
        <tr>
          <td>
            <button class="member-name" data-person-id="${escapeHTML(person.id)}">
              ${escapeHTML(person.fullName)}
              <small>${escapeHTML(person.id)}</small>
            </button>
          </td>
          <td>${escapeHTML(person.gender)}</td>
          <td>${escapeHTML(person.birthYear)}</td>
          <td>
            <span class="generation-pill">
              Gen ${escapeHTML(person.generation)}
            </span>
          </td>
          <td>${escapeHTML(person.place)}</td>
          <td>
            <span class="status-pill ${
              person.deathYear ? "deceased-status" : "living-status"
            }">
              ${person.deathYear ? "Deceased" : "Living"}
            </span>
          </td>
        </tr>
      `).join("")
      : `
        <tr>
          <td colspan="6" class="table-empty">No members found.</td>
        </tr>
      `;

    this.tableBody.querySelectorAll("[data-person-id]").forEach(button => {
      button.addEventListener("click", () => {
        onMemberClick(button.dataset.personId);
      });
    });

    document.getElementById("memberResultCount").textContent =
      `${people.length} result${people.length === 1 ? "" : "s"}`;

    document.getElementById("directoryCount").textContent = people.length;
  }

  renderStatistics(stats) {
    const currentYear = new Date().getFullYear();

    const personSummary = person =>
      person
        ? `${escapeHTML(person.fullName)} · ${statsAge(person, currentYear)} years`
        : "—";

    this.stats.innerHTML = `
      <div class="stats-grid">
        ${this.statCard("Total members", stats.total, "Across all generations", "♧")}
        ${this.statCard("Living members", stats.living, "Currently living", "♥")}
        ${this.statCard("Deceased members", stats.deceased, "Remembered family members", "✦")}
        ${this.statCard("Average age", `${stats.averageAge.toFixed(1)} yrs`, "Age at present or year of passing", "◷")}
      </div>

      <div class="highlight-grid">
        <article class="highlight-card">
          <span>OLDEST MEMBER</span>
          <strong>${personSummary(stats.oldest)}</strong>
          <small>${stats.oldest ? `Born ${stats.oldest.birthYear}` : ""}</small>
        </article>

        <article class="highlight-card">
          <span>YOUNGEST MEMBER</span>
          <strong>${personSummary(stats.youngest)}</strong>
          <small>${stats.youngest ? `Born ${stats.youngest.birthYear}` : ""}</small>
        </article>
      </div>

      <div class="charts-grid">
        ${this.barCard("Members by generation", stats.generations, "generation", "members")}
        ${this.barCard("Gender distribution", stats.gender, "gender", "members")}
        ${this.barCard("Family by location", stats.locations, "location", "members")}
        ${this.barCard("Blood group distribution", stats.bloodGroups, "blood", "members")}
      </div>
    `;
  }

  statCard(title, value, note, icon) {
    return `
      <article class="stat-card">
        <div class="stat-card-top">
          <span>${title}</span>
          <i>${icon}</i>
        </div>
        <strong>${value}</strong>
        <small>${note}</small>
      </article>
    `;
  }

  barCard(title, data, type, suffix) {
    const entries = Object.entries(data).sort((a, b) =>
      String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })
    );

    const max = Math.max(1, ...entries.map(([, value]) => value));

    return `
      <article class="chart-card">
        <h3>${title}</h3>
        <div class="bar-list">
          ${entries.map(([label, value]) => `
            <div class="bar-row">
              <div class="bar-label">
                <span>
                  ${type === "generation"
                    ? `Generation ${escapeHTML(label)}`
                    : escapeHTML(label)}
                </span>
                <strong>${value}</strong>
              </div>
              <div class="bar-track">
                <i style="width:${(value / max) * 100}%"></i>
              </div>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }

  showProfile(person, relations, onNavigate) {
    const relationBlock = (title, people) => `
      <div class="relation-group">
        <h4>${title}</h4>

        ${people.length
          ? people.map(p => `
            <button class="relation-link" data-relation-id="${escapeHTML(p.id)}">
              <span class="mini-avatar ${(p.gender || "").toLowerCase()}">
                ${p.gender === "Male" ? "♂" : "♀"}
              </span>
              <span>
                <strong>${escapeHTML(p.fullName)}</strong>
                <small>${escapeHTML(p.id)}</small>
              </span>
              <span>↗</span>
            </button>
          `).join("")
          : `<p class="no-relations">No records available</p>`
        }
      </div>
    `;

    const spouses = relations.spouses.map(item => item.person);

    this.profile.innerHTML = `
      <div class="profile-cover ${(person.gender || "").toLowerCase()}">
        <span class="profile-avatar">
          ${person.gender === "Male" ? "♂" : "♀"}
        </span>
        <span class="profile-label">
          ${person.isInLaw ? "IN-LAW" : "FAMILY MEMBER"}
          · ${person.deathYear ? "DECEASED" : "LIVING"}
        </span>
      </div>

      <div class="profile-main">
        <p class="eyebrow">
          ${escapeHTML(person.id)} · GENERATION ${escapeHTML(person.generation)}
        </p>

        <h2 id="profileName">${escapeHTML(person.fullName)}</h2>

        <p class="profile-subtitle">
          ${escapeHTML(person.profession)} · ${escapeHTML(person.place)}
        </p>

        <div class="detail-grid">
          <div><small>GENDER</small><strong>${escapeHTML(person.gender)}</strong></div>
          <div><small>BIRTH YEAR</small><strong>${escapeHTML(person.birthYear)}</strong></div>
          <div><small>DEATH YEAR</small><strong>${escapeHTML(person.deathYear || "—")}</strong></div>
          <div><small>AGE</small><strong>${this.ageLabel(person)}</strong></div>
          <div><small>BLOOD GROUP</small><strong>${escapeHTML(person.bloodGroup || "—")}</strong></div>
          <div><small>GENERATION</small><strong>${escapeHTML(person.generation)}</strong></div>
          <div class="detail-wide">
            <small>ADDRESS</small>
            <strong>${escapeHTML(person.address)}, ${escapeHTML(person.place)}</strong>
          </div>
        </div>

        <div class="relations">
          <h3>Family connections</h3>
          ${relationBlock("Parents", relations.parents)}
          ${relationBlock("Spouse", spouses)}
          ${relationBlock("Children", relations.children)}
          ${relationBlock("Siblings", relations.siblings)}
        </div>
      </div>
    `;

    this.modal.classList.add("open");
    this.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    this.profile.querySelectorAll("[data-relation-id]").forEach(button => {
      button.addEventListener("click", () => {
        onNavigate(button.dataset.relationId);
      });
    });
  }

  ageLabel(person) {
    return `${statsAge(person, new Date().getFullYear())} years`;
  }

  closeProfile() {
    this.modal.classList.remove("open");
    this.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  showError(message) {
    this.tree.innerHTML = `
      <div class="error-state">
        <strong>Unable to load family data</strong>
        <p>${escapeHTML(message)}</p>
        <p>Run this website with VS Code Live Server so the JSON file can be fetched.</p>
      </div>
    `;
  }
}

function statsAge(person, currentYear) {
  return Math.max(
    0,
    (person.deathYear || currentYear) - person.birthYear
  );
}
