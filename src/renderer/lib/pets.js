import { getHungerLimit, getPetLabel } from './utils.js';

export const renderPets = (pets) => {
  const petList = document.getElementById('petList');
  if (!petList) return;
  petList.innerHTML = '';
  const entries = Array.isArray(pets) ? pets : [];
  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pet-empty';
    empty.textContent = 'No pets';
    petList.appendChild(empty);
    return;
  }
  entries.forEach((pet) => {
    const item = document.createElement('div');
    item.className = 'pet-item';

    const labelWrap = document.createElement('span');
    labelWrap.className = 'pet-label';

    const icon = document.createElement('img');
    icon.className = 'item-sprite sprite-placeholder';
    icon.alt = '';
    icon.loading = 'lazy';
    icon.decoding = 'async';

    const name = document.createElement('span');
    name.className = 'label';
    name.textContent = getPetLabel(pet);

    labelWrap.appendChild(icon);
    labelWrap.appendChild(name);

    const hunger = document.createElement('span');
    hunger.className = 'pet-hunger';
    const limit = getHungerLimit(pet.species);
    if (Number.isFinite(pet.hunger) && limit) {
      const pct = Math.min(100, Math.max(0, (pet.hunger / limit) * 100));
      hunger.textContent = `${Math.round(pct)}%`;
    } else {
      hunger.textContent = '-';
    }

    item.appendChild(labelWrap);
    item.appendChild(hunger);
    petList.appendChild(item);

    const species = pet.species || '';
    if (window.spriteResolver?.getIcon && species) {
      const request = window.spriteResolver.getIcon({
        shop: 'pet',
        item: species,
        size: 16,
        mutation: pet.mutations,
      });
      if (request && typeof request.then === 'function') {
        request
          .then((url) => {
            if (!url) return;
            icon.src = url;
            icon.classList.remove('sprite-placeholder');
          })
          .catch(() => {});
      }
    }
  });
};

export const buildTrayPets = (session) => {
  if (!session || !Array.isArray(session.pets)) return [];
  return session.pets.map((pet) => {
    const label = getPetLabel(pet);
    const limit = getHungerLimit(pet.species);
    let hungerPct = null;
    if (Number.isFinite(pet.hunger) && limit) {
      hungerPct = Math.min(100, Math.max(0, (pet.hunger / limit) * 100));
    }
    return { label, hungerPct };
  });
};
