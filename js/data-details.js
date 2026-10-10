(() => {
  const SN = (window.StayNest = window.StayNest || {});

  SN.host = {
    name: "Handsome",
    initial: "H",
    since: 2022,
    rating: 4.9,
    responseRate: 98,
    responseTime: "within an hour",
  };
  SN.fees = { cleaningRate: 0.12, serviceRate: 0.1, taxRate: 0.07 };

  const gallery = (id) =>
    [id, `${id}-2`, `${id}-3`, `${id}-4`, `${id}-5`].map(
      (n) => `assets/images/${n}.jpg`,
    );
  SN.galleries = {
    "casa-alma": gallery("casa-alma"),
    "rue-charonne": gallery("rue-charonne"),
    "slope-house": gallery("slope-house"),
  };

  SN.about = {
    "casa-alma":
      "A whitewashed house set among pines and dunes a few minutes from the beach. Three bedrooms open onto a shaded pergola and a long pool, and the kitchen is built for slow, shared lunches. Evenings are quiet, with little to hear but birdsong and the sea.",
    "rue-charonne":
      "A light-filled one-bedroom on a lively street in the 11th, with tall windows, herringbone floors and a reading corner by the open window. Cafés, markets and the Bastille are a short walk away, and the metro is around the corner.",
    "slope-house":
      "A timber-and-glass house on the slopes below Table Mountain, with views across the city to the bay. Two bedrooms, a deck with a plunge pool, and a living room that opens fully to the evening air.",
    "riad-tamarind":
      "A traditional riad built around a quiet courtyard in the heart of the medina, with a small plunge pool, shaded seating and rooms that stay cool through the day. The souks and main square are a short walk away, but the house itself is calm.",
    "kamo-machiya":
      "A restored wooden townhouse near the Kamo river, with tatami rooms, a small inner garden and a deep bath. Temples and lantern-lit lanes are within walking distance, and the neighbourhood stays quiet after dark.",
    "christianshavn-loft":
      "A bright top-floor loft above the canals, with exposed beams, a proper desk and a kitchen made for slow breakfasts. Bicycles are the easiest way to reach the harbour, the old city and the waterfront cafés.",
    "villa-ponta":
      "A spacious villa a short walk from the clifftop paths, with a private pool, four bedrooms and a terrace that catches the evening sun. Built for families and friends who want room to spread out.",
    "marais-studio":
      "A compact studio facing a stone courtyard in the Marais, with a proper kitchen, a workspace and plenty of light. Galleries, bakeries and the river are all within an easy walk.",
    "camps-bay-terrace":
      "A modern villa above Camps Bay with a pool, four bedrooms and a terrace made for long evenings. The beach and restaurants are a short drive down the hill, and the mountain is right behind you.",
    "medina-roof-suite":
      "A simple, bright suite with its own roof terrace in the medina. Breakfast is best taken up on the roof, and the lanes below are lively by day and calm by night.",
    "arashiyama-cabin":
      "A small timber cabin on the edge of Arashiyama, with a wood-panelled bedroom, a compact kitchen and a deck facing the trees. The bamboo grove and river are an easy walk, and early mornings are the best time to go.",
    "harbour-bath-house":
      "A converted harbour building on Refshaleøen with water on three sides. Two bedrooms, a long shared table and big windows onto the harbour, with waterside food and swimming close by.",
  };

  SN.areas = {
    Comporta:
      "Rice fields, pine woods and long empty beaches south of Lisbon. Life here is slow: lunch outdoors, a swim, and not much else on the agenda.",
    Paris:
      "A neighbourhood of cafés, small galleries and street markets, with the metro close by and most of the city reachable on foot or by bike.",
    "Cape Town":
      "Steep streets under Table Mountain, with restaurants, hiking trails and the Atlantic coast all within a short drive.",
    Marrakech:
      "Inside the old walls the lanes are narrow and busy by day. The souks, the main square and a handful of quiet gardens are all close.",
    Kyoto:
      "Wooden townhouses, temples and quiet lanes, with the river and the old districts reachable on foot or by bus.",
    Copenhagen:
      "Canals, harbour baths and bike lanes everywhere. Cafés and waterside spots are never far, and the old city is a short ride away.",
    Lagos:
      "Golden cliffs, small coves and grottoes along the Algarve coast, with the old town and its harbour a short drive away.",
  };

  SN.reviewPool = [
    {
      rating: 5,
      date: "2026-09",
      text: "Exactly as described, and better in person. We barely left the house, and the little details made it feel looked after.",
    },
    {
      rating: 5,
      date: "2026-08",
      text: "Easy arrival, a spotless space and a host who answered every question quickly. We would stay again without thinking twice.",
    },
    {
      rating: 5,
      date: "2026-07",
      text: "The location was ideal for slow mornings and long walks. Everything we needed was within reach, and it was quiet at night.",
    },
    {
      rating: 4,
      date: "2026-06",
      text: "Beautiful place and good value. The only small note is that the Wi-Fi was slow one evening, but it did not spoil the stay.",
    },
    {
      rating: 5,
      date: "2026-05",
      text: "A thoughtful, calm space. Check-in was smooth and the house had everything we hoped for, plus a few things we did not.",
    },
    {
      rating: 5,
      date: "2026-04",
      text: "We came for a long weekend and wished it was longer. Comfortable beds, good light and a kitchen that worked properly.",
    },
  ];
})();
