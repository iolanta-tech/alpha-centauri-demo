export const WORLD_UNITS_PER_AU = 1;
const EARTH_RADIUS_AU = 0.000042634;

// Faria et al. (2022), as catalogued by the NASA Exoplanet Archive, gives
// Proxima Centauri a radius of 0.141 solar radii.
export const PROXIMA_CENTAURI = {
    spectralType: "M5.5V",
    description: "red dwarf",
    massSolar: 0.122,
    radiusSolar: 0.141,
    radiusAu: 0.0006557,
    source: "https://exoplanetarchive.ipac.caltech.edu/overview/Proxima%20Centauri%20b",
};

export const ALPHA_CENTAURI_AB = {
    separationFromProximaAu: 13_000,
    relativeSemimajorAxisAu: 23.5,
    eccentricity: 0.524,
    relativeSemimajorAxisAu: 23.5,
    periodYears: 79.9,
    // Presentation pose: a rigid sky orientation for the distant pair.
    skyDirection: [-0.56, 0.24, -0.79],
    a: { spectralType: "G2V", massSolar: 1.079, radiusSolar: 1.2174 },
    b: { spectralType: "K1V", massSolar: 0.909, radiusSolar: 0.8591 },
    source: "https://www.cambridge.org/core/journals/publications-of-the-astronomical-society-of-australia/article/abs/alpha-centauri/7ED97A40788D66BF0D70B46759E6CA23",
};

// NASA lists the planetary radii as estimates.
export const PROXIMA_PLANETS = {
    "proxima-b": {
        name: "Proxima Centauri b",
        massEarth: 1.055,
        estimatedRadiusEarth: 1.02,
        semiMajorAxisAu: 0.04848,
        orbitalPeriodDays: 11.2,
        source: "https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/",
        radiusStatus: "estimated",
    },
    "proxima-d": {
        name: "Proxima Centauri d",
        massEarth: 0.26,
        estimatedRadiusEarth: 0.692,
        semiMajorAxisAu: 0.02881,
        orbitalPeriodDays: 5.1,
        source: "https://science.nasa.gov/exoplanet-catalog/proxima-centauri-d/",
        radiusStatus: "estimated",
    },
};

export function planetRadiusAu(planet) {
    const facts = PROXIMA_PLANETS[planet];
    if (!facts) throw new Error(`Unknown planet: ${planet}`);
    return facts.estimatedRadiusEarth * EARTH_RADIUS_AU;
}

export function planetCaption(planet) {
    const facts = PROXIMA_PLANETS[planet];
    if (!facts) throw new Error(`Unknown planet: ${planet}`);
    return `M ${facts.massEarth} M⊕ · R≈${facts.estimatedRadiusEarth} R⊕ · a ${facts.semiMajorAxisAu} AU · P ${facts.orbitalPeriodDays} d`;
}

export function starCaption(id) {
    if (id === "proxima-space" || id === "proxima") {
        return `${PROXIMA_CENTAURI.spectralType} ${PROXIMA_CENTAURI.description} · M ${PROXIMA_CENTAURI.massSolar} M☉ · R ${PROXIMA_CENTAURI.radiusSolar} R☉`;
    }
    if (id === "binary") {
        const { a, b, relativeSemimajorAxisAu, eccentricity } = ALPHA_CENTAURI_AB;
        return `A ${a.spectralType} · B ${b.spectralType} · M ${a.massSolar}+${b.massSolar} M☉ · a ${relativeSemimajorAxisAu} AU · e ${eccentricity}`;
    }
    if (id === "alpha-cen-a") {
        const { a } = ALPHA_CENTAURI_AB;
        return `${a.spectralType} · M ${a.massSolar} M☉ · R ${a.radiusSolar.toFixed(3)} R☉`;
    }
    if (id === "alpha-cen-b") {
        const { b } = ALPHA_CENTAURI_AB;
        return `${b.spectralType} · M ${b.massSolar} M☉ · R ${b.radiusSolar.toFixed(3)} R☉`;
    }
    throw new Error(`Unknown star destination: ${id}`);
}

export function destinationCaption(id) {
    if (PROXIMA_PLANETS[id]) return planetCaption(id);
    return starCaption(id);
}

export const STAGES = [
    {
        id: "proxima-b",
        key: "1",
        label: "Proxima Centauri b",
        controls: "orbit",
    },
    {
        id: "proxima-d",
        key: "2",
        label: "Proxima Centauri d",
        controls: "orbit",
    },
    {
        id: "proxima-space",
        key: "3",
        label: "Proxima system",
        controls: "orbit",
    },
    {
        id: "binary",
        key: "4",
        label: "Alpha Centauri A/B",
        controls: "orbit",
    },
    {
        id: "alpha-cen-a",
        label: "Alpha Centauri A",
        controls: "orbit",
    },
    {
        id: "alpha-cen-b",
        label: "Alpha Centauri B",
        controls: "orbit",
    },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((stage) => [stage.id, stage]));
export const STAGE_BY_KEY = Object.fromEntries(STAGES.filter((stage) => stage.key).map((stage) => [stage.key, stage]));

export function validateStages(stages = STAGES) {
    const ids = new Set(stages.map((stage) => stage.id));
    if (ids.size !== stages.length) throw new Error("Stage identifiers must be unique");
    stages.forEach((stage) => {
        if (stage.controls !== "orbit") {
            throw new Error(`Missing controls for ${stage.id}`);
        }
    });
    if (!["proxima-b", "proxima-d", "proxima-space", "binary"].every((id) => ids.has(id))) {
        throw new Error("The Alpha Centauri locations are incomplete");
    }
    return true;
}

validateStages();
