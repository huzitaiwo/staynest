(() => {
  "use strict";
  const SN = window.StayNest || {};
  const SITE = "StayNest";
  const origin = location.origin;

  const meta = (attr, key, value) => {
    if (!value) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.append(el);
    }
    el.setAttribute("content", value);
  };

  const abs = (url) => (url ? new URL(url, location.href).href : "");

  const apply = ({ title, description, image, type = "website" }) => {
    if (title) document.title = title;
    const desc =
      description ||
      document.querySelector('meta[name="description"]')?.content ||
      "";
    meta("name", "description", desc);

    let canon = document.head.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement("link");
      canon.rel = "canonical";
      document.head.append(canon);
    }
    canon.href = origin + location.pathname + location.search;

    meta("property", "og:site_name", SITE);
    meta("property", "og:type", type);
    meta("property", "og:title", document.title);
    meta("property", "og:description", desc);
    meta("property", "og:url", canon.href);
    meta("property", "og:image", abs(image || "/assets/images/og-cover.jpg"));
    meta("name", "twitter:card", "summary_large_image");
    meta("name", "twitter:title", document.title);
    meta("name", "twitter:description", desc);
    meta("name", "twitter:image", abs(image || "/assets/images/og-cover.jpg"));
  };

  const jsonLd = (data) => {
    let el = document.getElementById("ld-json");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "ld-json";
      document.head.append(el);
    }
    el.textContent = JSON.stringify(data);
  };

  /* Property page */
  const forProperty = () => {
    const id = new URLSearchParams(location.search).get("id");
    const p = id && SN.findProperty ? SN.findProperty(id) : null;
    if (!p) return false;

    const price = p.price ?? p.nightly;
    const loc = [p.city, p.country].filter(Boolean).join(", ");
    const description = (
      p.summary ||
      p.description ||
      `Stay at ${p.title} in ${loc}.`
    ).slice(0, 155);
    const image = p.image || (p.images && p.images[0]) || "";

    apply({
      title: `${p.title} · ${loc} · ${SITE}`,
      description,
      image,
      type: "article",
    });

    const ld = {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      name: p.title,
      description,
      image: abs(image),
      url: location.href,
      address: {
        "@type": "PostalAddress",
        addressLocality: p.city,
        addressCountry: p.country,
      },
    };
    if (price) ld.priceRange = `$${price} / night`;
    const s = SN.reviews?.summary?.(p.id);
    if (s && s.count) {
      ld.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: Number(s.average).toFixed(1),
        reviewCount: s.count,
      };
    }
    jsonLd(ld);
    return true;
  };

  /* Home page */
  const forHome = () => {
    jsonLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE,
      url: origin + "/",
      potentialAction: {
        "@type": "SearchAction",
        target: `${origin}/search.html?q={query}`,
        "query-input": "required name=query",
      },
    });
  };

  const run = () => {
    const page = document.body.dataset.page;
    if (page === "property") {
      if (!forProperty()) apply({});
      /* remote listings arrive after sign-in: refresh the tags then */
      window.addEventListener("sn:listings-ready", forProperty);
    } else {
      apply({});
      if (page === "home") forHome();
    }
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", run)
    : run();
})();
