(() => {
  const SN = (window.StayNest = window.StayNest || {});
  const icon = (n) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  // Same markup as the homepage cards, plus an optional rating line.
  SN.cardHTML = (p, { reveal = true } = {}) => `
<article class="card${reveal ? " reveal" : ""}" data-id="${p.id}">
  <div class="card__media">
    <img src="${p.image}" alt="${p.title} in ${p.city}, ${p.country}" width="640" height="533" loading="lazy">
    <span class="tag">${p.type}</span>
    <button class="save" type="button" aria-pressed="false" aria-label="Save ${p.title}" data-save="${p.id}">${icon("heart")}</button>
  </div>
  <div class="card__body">
    <p class="card__kicker">${p.area}</p>
    <div class="card__head">
      <div>
        <h3 class="card__title"><a class="card__link" href="property.html?id=${p.id}">${p.title}</a></h3>
        <p class="card__loc">${p.city}, ${p.country}</p>
        <p class="card__meta">${icon("star")}<span>${p.rating.toFixed(2)} (${p.reviews})</span><span aria-hidden="true">·</span><span>Sleeps ${p.guests}</span></p>
      </div>
      <span class="card__go" aria-hidden="true">${icon("arrow-up-right")}</span>
    </div>
    <div class="card__foot">
      <p class="card__note">${p.note}</p>
      <p class="price"><strong>€${p.price}</strong> <span>night</span></p>
    </div>
  </div>
</article>`;
})();
