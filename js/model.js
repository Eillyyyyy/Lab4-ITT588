
const DATA_URL = new URL("../data/people.json", import.meta.url);

export class FamilyModel {
  constructor() {
    this.people = [];
  }

  async load() {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Unable to load people.json (${response.status})`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("people.json must contain an array.");
    }

    this.people = data;
    this.validate();

    return this.people;
  }

  validate() {
    const ids = new Set(this.people.map(person => person.id));

    if (ids.size !== this.people.length) {
      throw new Error("Duplicate member IDs found.");
    }

    for (const person of this.people) {
      for (const relationId of [
        person.fatherId,
        person.motherId,
        ...(person.spouses || []).map(s => s.personId)
      ]) {
        if (relationId && !ids.has(relationId)) {
          throw new Error(
            `Invalid relationship ID ${relationId} for ${person.id}.`
          );
        }
      }
    }
  }

  findMember(id) {
    return this.people.find(person => person.id === id) || null;
  }

  getParents(id) {
    const person = this.findMember(id);

    if (!person) return [];

    return [
      this.findMember(person.fatherId),
      this.findMember(person.motherId)
    ].filter(Boolean);
  }

  getSpouses(id) {
    const person = this.findMember(id);

    if (!person) return [];

    return (person.spouses || [])
      .map(item => ({
        person: this.findMember(item.personId),
        status: item.status
      }))
      .filter(item => item.person);
  }

  getChildren(id) {
    return this.people.filter(
      person => person.fatherId === id || person.motherId === id
    );
  }

  getSiblings(id) {
    const person = this.findMember(id);

    if (!person || (!person.fatherId && !person.motherId)) {
      return [];
    }

    return this.people.filter(other =>
      other.id !== id &&
      (
        (person.fatherId && other.fatherId === person.fatherId) ||
        (person.motherId && other.motherId === person.motherId)
      )
    );
  }

  groupByGeneration(people = this.people) {
    return people.reduce((groups, person) => {
      (groups[person.generation] ||= []).push(person);
      return groups;
    }, {});
  }

  searchMembers(query, people = this.people) {
    const term = query.trim().toLocaleLowerCase();

    if (!term) return [...people];

    return people.filter(person =>
      [
        person.fullName,
        person.place,
        person.profession,
        person.id,
        person.address
      ].some(value =>
        String(value || "").toLocaleLowerCase().includes(term)
      )
    );
  }

 
filterMembers({
  generation = "all",
  gender = "all",
  status = "all"
} = {}) {
  return this.people.filter(person =>
    (generation === "all" ||
      String(person.generation) === String(generation)) &&
    (gender === "all" || person.gender === gender) &&
    (status === "all" ||
      (status === "living" && !person.deathYear) ||
      (status === "deceased" && Boolean(person.deathYear)) ||
      (status === "inlaw" && person.isInLaw))
  );
}


  getAge(person, currentYear = new Date().getFullYear()) {
    return Math.max(
      0,
      (person.deathYear || currentYear) - person.birthYear
    );
  }

  getStatistics(currentYear = new Date().getFullYear()) {
    const total = this.people.length;

    const living = this.people.filter(p => !p.deathYear);
    const deceased = this.people.filter(p => p.deathYear);

    const ages = this.people.map(
      p => this.getAge(p, currentYear)
    );

    const oldest = [...this.people].sort(
      (a, b) => this.getAge(b, currentYear) - this.getAge(a, currentYear)
    )[0] || null;

    const youngest = [...this.people].sort(
      (a, b) => this.getAge(a, currentYear) - this.getAge(b, currentYear)
    )[0] || null;

    const countBy = (key, fallback = "Unknown") =>
      this.people.reduce((acc, p) => {
        const value = p[key] || fallback;
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {});

    return {
      total,
      living: living.length,
      deceased: deceased.length,

      averageAge: total
        ? ages.reduce((sum, age) => sum + age, 0) / total
        : 0,

      oldest,
      youngest,

      generations: countBy("generation"),
      gender: countBy("gender"),
      locations: countBy("place"),
      bloodGroups: countBy("bloodGroup")
    };
  }
}
