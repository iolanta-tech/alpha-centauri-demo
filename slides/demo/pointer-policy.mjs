export function walkPointerDown({ hitDestination } = {}) {
    return {
        allowLook: true,
        capture: true,
        hitDestination: hitDestination ?? null,
    };
}

export function walkPointerUp({ hitDestination, currentDestination, moved } = {}) {
    return {
        select: Boolean(hitDestination && !moved && hitDestination !== currentDestination),
    };
}
