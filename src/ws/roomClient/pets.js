'use strict';

const { BLOCKED_ABILITIES } = require('./constants');

const isAbilityName = (x) => {
  if (typeof x !== 'string') return false;
  const name = x.trim();
  if (!name) return false;
  return !BLOCKED_ABILITIES.has(name.toLowerCase());
};

const extractPets = (slot) => {
  const data = slot?.data || slot;
  const petSlots = data?.petSlots;
  if (!Array.isArray(petSlots)) return [];
  return petSlots
    .map((pet, index) => {
      if (!pet) return null;
      const id = pet.id || '';
      const name = pet.name || '';
      const species = pet.petSpecies || '';
      const hunger = Number.isFinite(pet.hunger) ? Number(pet.hunger) : null;
      const mutations = Array.isArray(pet.mutations)
        ? pet.mutations.filter(Boolean)
        : [];
      return { id, name, species, hunger, index, mutations };
    })
    .filter(Boolean);
};

const normalizePetMutations = (mutations) => {
  const list = Array.isArray(mutations) ? mutations : [];
  const lower = list.map((entry) => String(entry || '').trim().toLowerCase());
  const known = [];
  if (lower.includes('gold')) known.push('Gold');
  if (lower.includes('rainbow')) known.push('Rainbow');
  return known.length ? known.join(', ') : 'None';
};

const formatPetMutations = (slot) => {
  if (!slot) return 'slot not found';
  const data = slot?.data || slot;
  const petSlots = Array.isArray(data?.petSlots) ? data.petSlots : [];
  if (!petSlots.length) return 'no pets';
  const parts = [];
  petSlots.forEach((pet, index) => {
    if (!pet) return;
    const label = pet.name || pet.petSpecies || `Pet ${index + 1}`;
    const mutationLabel = normalizePetMutations(pet.mutations);
    parts.push(`${label}: ${mutationLabel}`);
  });
  return parts.length ? parts.join(' | ') : 'no pets';
};

module.exports = { extractPets, formatPetMutations, isAbilityName };
