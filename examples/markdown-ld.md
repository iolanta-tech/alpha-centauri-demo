---
"@context":
  "@import": https://json-ld.org/contexts/dollar-convenience.jsonld
  schema: https://schema.org/
  dbo: http://dbpedia.org/ontology/
  dbp: http://dbpedia.org/property/
  dbr: http://dbpedia.org/resource/
  name: schema:name

  is-orbited-by:
    "@reverse": dbp:star

$id: dbr:Proxima_Centauri
$type: dbo:Star
name: Proxima Centauri
is-orbited-by:

  - $id: dbr:Proxima_Centauri_b
    $type: dbo:Planet
    name: Proxima Centauri b

  - $id: dbr:Proxima_Centauri_d
    $type: dbo:Planet
    name: Proxima Centauri d
---

# Proxima Centauri

A red dwarf with frequent flares.

## Proxima Centauri b

Possibly tidally locked; maybe rocky; mass similar to Earth.

Located in the star's habitable zone, so might have liquid water on the surface.

## Proxima Centauri d

Likely rocky; more like Mercury.
